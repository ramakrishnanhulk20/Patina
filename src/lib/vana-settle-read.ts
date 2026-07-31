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
import { controllerFor, type SourceId } from "./vana";

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
 * A previous version stripped the accessRecord (to dodge an earlier, different
 * gateway 400) and swallowed the failure, so every paid read died on
 * "still requires payment after escrow settlement" with the real cause hidden.
 * Every error here is now surfaced.
 */

const network = process.env.VANA_NETWORK === "moksha" ? "moksha" : "mainnet";
const env = process.env.VANA_ENV === "dev" ? "dev" : "production";
const chainId = network === "mainnet" ? 1480 : 14800;

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
    // data-access fee and clears any owed registration. Surface failures rather
    // than swallowing them, so a bad settle is visible in the next log.
    let settleError: string | undefined;
    try {
      const receipt = await authorizeGrantPayment({
        payerAddress: account.address,
        required,
        config: escrow,
      });
      console.info("[vana/settle] gateway settle ok", {
        requestId,
        source,
        opId: receipt.opId,
        amount: receipt.amount,
        registrationPaid: receipt.breakdown?.registrationPaid,
      });
    } catch (err) {
      settleError = err instanceof Error ? err.message : String(err);
      console.error("[vana/settle] gateway settle failed", { requestId, source, error: settleError });
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
