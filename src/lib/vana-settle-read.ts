import {
  AccessNotApprovedError,
  authorizeGrantPayment,
  buildEscrowPaymentHeader,
  buildPersonalServerDataReadRequest,
  createDefaultAccessRequestClient,
  getDirectEndpoints,
  parsePersonalServerPaymentRequired,
  PaymentRequiredError,
  paymentResponseMetadataFromHeader,
  PersonalServerReadError,
  type ApprovedDataResult,
  type EscrowPaymentConfig,
  type PersonalServerPaymentOperation,
} from "@opendatalabs/vana-sdk/server";
import { CONTRACTS, createEscrowGatewayClient } from "@opendatalabs/vana-sdk";
import { privateKeyToAccount } from "viem/accounts";
import { controllerFor, SOURCES, type SourceId } from "./vana";

/**
 * Paid Personal Server read, settled through the escrow gateway.
 *
 * The Vana docs say `readApprovedData` handles the 402 automatically by signing
 * an X-PAYMENT header and letting the Personal Server settle server-side. On
 * mainnet, for this app, that path does NOT settle — the read comes back 402
 * with `"registrationOwed": true`. The gateway itself tells us what it wants:
 *
 *   POST /v1/escrow/pay -> 400 "accessRecord is required when dataAccessFee > 0"
 *
 * So we settle client-side through the gateway, INCLUDING the accessRecord the
 * Personal Server handed us in the 402 challenge (`authorizeGrantPayment` passes
 * it through). That single call pays the data-access fee AND clears the pending
 * registration. Then we re-read; the Personal Server now sees a settled op and
 * returns the data.
 *
 * The one remaining failure is a real one the user can fix: if the source they
 * connected collected EMPTY on Vana's side, the gateway has no data point to
 * charge for and answers "dataPointId ... not found in gateway". That is not a
 * payment fault — it is an empty source — so it is raised as SourceEmptyError
 * and turned into "check your source" guidance rather than a scary error.
 */

const network = process.env.VANA_NETWORK === "moksha" ? "moksha" : "mainnet";
const env = process.env.VANA_ENV === "dev" ? "dev" : "production";
const chainId = network === "mainnet" ? 1480 : 14800;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The escrow gateway reports a dataPointId as "not found" when the source the
 * user connected collected EMPTY on Vana's side (or has not finished collecting
 * yet). There is no data to charge for, so the read can never settle — this is
 * a user-fixable situation, not a payment fault.
 */
function isDataPointMissing(text: string | undefined): boolean {
  return typeof text === "string" && /not found in gateway/i.test(text);
}

/** Friendly, source-named explanation shown when a source collected no data. */
export function emptySourceMessage(source: SourceId): string {
  const label = SOURCES[source]?.label ?? source;
  return `We couldn't read any data from your ${label}. It may be empty, private, or still collecting on Vana.`;
}

/**
 * Thrown when the source has no readable data. Carries a `code` the API route
 * turns into a 422 and the connect UI turns into "check your source" guidance,
 * instead of a scary payment error.
 */
export class SourceEmptyError extends Error {
  readonly code = "SOURCE_EMPTY";
  readonly details: unknown;
  constructor(source: SourceId, details?: unknown) {
    super(emptySourceMessage(source));
    this.name = "SourceEmptyError";
    this.details = details;
  }
}

function escrowConfig(account: ReturnType<typeof privateKeyToAccount>): EscrowPaymentConfig {
  const endpoints = getDirectEndpoints(env);
  const escrowContract = CONTRACTS.DataPortabilityEscrow.addresses[
    chainId as 1480 | 14800
  ] as `0x${string}`;

  return {
    client: createEscrowGatewayClient(endpoints.escrowGatewayUrl),
    escrowContract,
    chainId,
    signTypedData: (args) => account.signTypedData(args),
  };
}

export async function readApprovedDataSettled(
  source: SourceId,
  requestId: string,
): Promise<ApprovedDataResult> {
  const privateKey = process.env.VANA_APP_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing VANA_APP_PRIVATE_KEY");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const controller = controllerFor(source);
  const status = await controller.getAccessRequestStatus(requestId);

  if (
    (status.status !== "approved" && status.status !== "ready_for_read") ||
    !status.personalServerUrl ||
    !status.grantId ||
    !status.scope
  ) {
    throw new AccessNotApprovedError(
      "Request is not approved or is missing grantId/scope/personalServerUrl",
      {
        requestId,
        status: status.status,
        hasPersonalServerUrl: Boolean(status.personalServerUrl),
        hasGrantId: Boolean(status.grantId),
        hasScope: Boolean(status.scope),
      },
    );
  }

  const escrow = escrowConfig(account);
  const signMessage = (message: string | Uint8Array) =>
    account.signMessage({
      message: typeof message === "string" ? message : { raw: message },
    });

  const buildRequest = () =>
    buildPersonalServerDataReadRequest({
      personalServerUrl: status.personalServerUrl!,
      scope: status.scope!,
      grantId: status.grantId!,
      signMessage,
    });

  let req = await buildRequest();
  let res = await fetch(req.url, { method: req.method, headers: req.headers });

  if (res.status === 402) {
    const required = (await parsePersonalServerPaymentRequired(
      res,
      status.grantId!,
    )) as PersonalServerPaymentOperation;

    console.info("[vana/settle] challenge", {
      requestId,
      source,
      opType: required.opType,
      amount: required.amount,
      asset: required.asset,
      hasAccessRecord: Boolean(required.accessRecord),
      dataPointId: required.accessRecord?.dataPointId,
    });

    // Settle through the escrow gateway WITH the accessRecord. This pays the
    // data-access fee and clears any owed registration. A "not found in gateway"
    // means the data point is not there yet (empty source, or Vana still
    // registering it), so retry once briefly before deciding it is empty.
    let settleError: string | undefined;
    let settled = false;
    for (let attempt = 0; attempt < 2 && !settled; attempt += 1) {
      if (attempt > 0) await sleep(1500);
      try {
        const receipt = await authorizeGrantPayment({
          payerAddress: account.address,
          required,
          config: escrow,
        });
        settled = true;
        settleError = undefined;
        console.info("[vana/settle] gateway settle ok", {
          requestId,
          source,
          opId: receipt.opId,
          amount: receipt.amount,
          registrationPaid: receipt.breakdown?.registrationPaid,
        });
      } catch (err) {
        settleError = err instanceof Error ? err.message : String(err);
        console.error("[vana/settle] gateway settle failed", {
          requestId,
          source,
          attempt,
          error: settleError,
        });
        // Only a missing data point is worth retrying; other errors will not heal.
        if (!isDataPointMissing(settleError)) break;
      }
    }

    // A missing data point after retrying means the source is empty/unreadable.
    // Surface it as user-fixable guidance, not a payment failure.
    if (!settled && isDataPointMissing(settleError)) {
      throw new SourceEmptyError(source, {
        grantId: required.grantId,
        dataPointId: required.accessRecord?.dataPointId,
        settleError,
      });
    }

    // Re-read. The op is now settled on the gateway, so a plain read should
    // return the data. Fall back to presenting the signed payment as proof if
    // the Personal Server still wants to see it.
    req = await buildRequest();
    res = await fetch(req.url, { method: req.method, headers: req.headers });

    if (res.status === 402) {
      const paymentHeader = await buildEscrowPaymentHeader({
        payerAddress: account.address,
        required,
        config: escrow,
      });
      req = await buildRequest();
      res = await fetch(req.url, {
        method: req.method,
        headers: { ...req.headers, "X-PAYMENT": paymentHeader },
      });
    }

    if (res.status === 402) {
      const body = await res.text().catch(() => "");
      console.error("[vana/settle] still 402 after settlement", {
        requestId,
        source,
        settleError,
        body: body.slice(0, 1500),
      });
      // If the data point is missing here too, it is the empty-source case.
      if (isDataPointMissing(settleError) || isDataPointMissing(body)) {
        throw new SourceEmptyError(source, {
          grantId: required.grantId,
          settleError,
          personalServerBody: body.slice(0, 500),
        });
      }
      throw new PaymentRequiredError(
        "Personal Server still requires payment after escrow settlement",
        {
          scope: status.scope,
          grantId: required.grantId,
          asset: required.asset,
          amount: required.amount,
          settleError,
          personalServerBody: body.slice(0, 1000),
        },
      );
    }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new PersonalServerReadError(
      `Personal Server read failed: ${res.status} ${res.statusText}`,
      res.status,
      { scope: status.scope, body: detail.slice(0, 500) },
    );
  }

  const data = await res.json();
  const payment = paymentResponseMetadataFromHeader(res.headers.get("X-PAYMENT-RESPONSE"));

  // Best-effort: tells Vana the read is done so the approval tab can close.
  const endpoints = getDirectEndpoints(env);
  const accessClient = createDefaultAccessRequestClient({
    baseUrl: endpoints.accessRequestBaseUrl,
    approvalBaseUrl: endpoints.approvalAppBaseUrl,
    appAddress: account.address,
    signMessage,
  });
  try {
    await accessClient.acknowledgeRead?.(requestId);
  } catch (err) {
    console.warn("[vana/settle] acknowledgeRead failed", {
      requestId,
      error: err instanceof Error ? err.message : err,
    });
  }

  return {
    scope: status.scope!,
    data,
    payment,
  };
}
