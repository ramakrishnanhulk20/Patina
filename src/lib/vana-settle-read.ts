import {
  AccessNotApprovedError,
  authorizeGrantPayment,
  buildEscrowPaymentHeader,
  buildPersonalServerDataReadRequest,
  createDefaultAccessRequestClient,
  getDirectEndpoints,
  parsePersonalServerPaymentRequired,
  PaymentRequiredError,
  PersonalServerReadError,
  type EscrowPaymentConfig,
  type PersonalServerPaymentOperation,
} from "@opendatalabs/vana-sdk/server";
import { CONTRACTS, createEscrowGatewayClient } from "@opendatalabs/vana-sdk";
import { privateKeyToAccount } from "viem/accounts";
import { controllerFor, env, network } from "./vana.ts";
import { scopesFor, SOURCE_SPECS } from "./sources.ts";
import { countAsync } from "./metrics.ts";
import type { SourceId } from "./score.ts";

/**
 * Paid Personal Server reads, settled through the escrow gateway.
 *
 * TWO PROBLEMS ARE SOLVED HERE, and the second one is new in v2.
 *
 * 1. THE 402 THAT DOES NOT SETTLE ITSELF.
 *
 * The Vana docs say `readApprovedData` handles the 402 automatically by signing
 * an X-PAYMENT header and letting the Personal Server settle server-side. On
 * mainnet, for this app, that path does NOT settle: the read comes back 402
 * with `"registrationOwed": true`. The gateway itself tells us what it wants:
 *
 *   POST /v1/escrow/pay -> 400 "accessRecord is required when dataAccessFee > 0"
 *
 * So we settle client-side through the gateway, INCLUDING the accessRecord the
 * Personal Server handed us in the 402 challenge. That single call pays the
 * data-access fee AND clears the pending registration. Then we re-read.
 *
 * 2. READING EVERY SCOPE ON ONE GRANT, AND ONLY THEN ACKNOWLEDGING.
 *
 * A source now covers up to four scopes. `readApprovedData` reads exactly one
 * (whichever `status.scope` reports) and then calls `acknowledgeRead`, which
 * moves the request to `completed`. The SDK is explicit that `completed` is
 * terminal and NOT read-ready, because "the browser Personal Server may no
 * longer be serving it".
 *
 * So acknowledging after the first scope would burn the grant with three scopes
 * unread, and the user would have paid for data they never received. Every
 * scope is read first, in parallel, and the acknowledgement happens once at the
 * very end.
 *
 * The same sentence explains why reads cannot be deferred: the Personal Server
 * is up while the USER is. There is one window, it is now, and it closes when
 * they close the tab.
 */

const chainId = network === "mainnet" ? 1480 : 14800;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The escrow gateway reports a dataPointId as "not found" when the source the
 * user connected collected EMPTY on Vana's side (or has not finished collecting
 * yet). There is no data to charge for, so the read can never settle. This is a
 * user-fixable situation, not a payment fault.
 */
function isDataPointMissing(text: string | undefined): boolean {
  return typeof text === "string" && /not found in gateway/i.test(text);
}

/**
 * Whether a failure means "this grant does not cover that scope" rather than
 * "something broke".
 *
 * Logged loudly and separately, because it is the one assumption in v2 that has
 * not been confirmed against a live grant: that a grant issued for four scopes
 * will serve reads for all four rather than only for `status.scope`. If that
 * assumption is wrong, this is the message that will say so, and the fallback is
 * one grant per scope at four times the approval trips.
 */
function isScopeNotGranted(text: string | undefined): boolean {
  return typeof text === "string" && /scope|not granted|unauthorized|forbidden/i.test(text);
}

/** Friendly, source-named explanation shown when a source collected no data. */
export function emptySourceMessage(source: SourceId): string {
  const label = SOURCE_SPECS[source]?.label ?? source;
  return `We couldn't read any data from your ${label}. It may be empty, private, or still importing in Vana Desktop.`;
}

/**
 * Thrown when a source has no readable data at all. Carries a `code` the API
 * route turns into a 422 and the connect UI turns into "check your source"
 * guidance, instead of a scary payment error.
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

export type ScopeRead = { scope: string; data: unknown };
export type ScopeFailure = { scope: string; error: string; notGranted: boolean };

export type SourceRead = {
  source: SourceId;
  reads: ScopeRead[];
  failures: ScopeFailure[];
  /** True when a fee was actually settled during this attempt. */
  paid: boolean;
};

/**
 * Thrown when the money moved and the data did not.
 *
 * Its own class because it is the one failure the user is owed an explanation
 * for. Everything else here is "try again"; this one is "you were charged and
 * you got nothing", and saying that plainly is the difference between a bug and
 * a betrayal.
 */
export class PaidButFailedError extends Error {
  readonly code = "PAID_BUT_FAILED";
  readonly details: unknown;
  constructor(source: SourceId, cause: unknown) {
    super(
      `Your ${SOURCE_SPECS[source]?.label ?? source} data was paid for but did not come back. ` +
        "Nothing was saved and you were not charged for it: Patina covers the fee, not you. " +
        "Try connecting it again.",
    );
    this.name = "PaidButFailedError";
    this.details = cause instanceof Error ? cause.message : cause;
  }
}

type ReadContext = {
  /**
   * Set the moment the escrow gateway accepts a payment for any scope.
   *
   * The distinction it exists to preserve: a read that fails BEFORE settlement
   * cost the user nothing and can simply be retried, while one that fails
   * AFTER has spent real money for nothing. Those look identical from the
   * outside and need opposite things said about them. Without this, both came
   * back as "something went wrong" and the second case was invisible to
   * everybody, including the person who paid for it.
   */
  paid: { any: boolean };
  personalServerUrl: string;
  grantId: string;
  account: ReturnType<typeof privateKeyToAccount>;
  escrow: EscrowPaymentConfig;
  signMessage: (message: string | Uint8Array) => Promise<`0x${string}`>;
};

/**
 * Read ONE scope against an already-approved grant, settling the 402 if the
 * Personal Server asks for payment. Throws on failure; the caller decides
 * whether one dead scope kills the whole source.
 */
async function readScopeSettled(
  source: SourceId,
  requestId: string,
  scope: string,
  ctx: ReadContext,
): Promise<unknown> {
  const buildRequest = () =>
    buildPersonalServerDataReadRequest({
      personalServerUrl: ctx.personalServerUrl,
      scope,
      grantId: ctx.grantId,
      signMessage: ctx.signMessage,
    });

  let req = await buildRequest();
  let res = await fetch(req.url, { method: req.method, headers: req.headers });

  if (res.status === 402) {
    const required = (await parsePersonalServerPaymentRequired(
      res,
      ctx.grantId,
    )) as PersonalServerPaymentOperation;

    console.info("[vana/settle] challenge", {
      requestId,
      source,
      scope,
      opType: required.opType,
      amount: required.amount,
      asset: required.asset,
      hasAccessRecord: Boolean(required.accessRecord),
      dataPointId: required.accessRecord?.dataPointId,
    });

    // Settle through the escrow gateway WITH the accessRecord. This pays the
    // data-access fee and clears any owed registration. A "not found in gateway"
    // means the data point is not there yet (empty scope, or Vana still
    // registering it), so retry once briefly before deciding it is empty.
    let settleError: string | undefined;
    let settled = false;
    for (let attempt = 0; attempt < 2 && !settled; attempt += 1) {
      if (attempt > 0) await sleep(1500);
      try {
        const receipt = await authorizeGrantPayment({
          payerAddress: ctx.account.address,
          required,
          config: ctx.escrow,
        });
        settled = true;
        settleError = undefined;
        ctx.paid.any = true;
        console.info("[vana/settle] gateway settle ok", {
          requestId,
          source,
          scope,
          opId: receipt.opId,
          amount: receipt.amount,
          registrationPaid: receipt.breakdown?.registrationPaid,
        });
      } catch (err) {
        settleError = err instanceof Error ? err.message : String(err);
        console.error("[vana/settle] gateway settle failed", {
          requestId,
          source,
          scope,
          attempt,
          error: settleError,
        });
        // Only a missing data point is worth retrying; other errors will not heal.
        if (!isDataPointMissing(settleError)) break;
      }
    }

    if (!settled && isDataPointMissing(settleError)) {
      throw new PersonalServerReadError(`No data collected for ${scope}`, 404, {
        scope,
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
        payerAddress: ctx.account.address,
        required,
        config: ctx.escrow,
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
        scope,
        settleError,
        body: body.slice(0, 1500),
      });
      throw new PaymentRequiredError(
        "Personal Server still requires payment after escrow settlement",
        { scope, grantId: required.grantId, settleError, personalServerBody: body.slice(0, 1000) },
      );
    }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new PersonalServerReadError(
      `Personal Server read failed: ${res.status} ${res.statusText}`,
      res.status,
      { scope, body: detail.slice(0, 500) },
    );
  }

  return res.json();
}

/**
 * Read every scope this source's grant covers, then acknowledge once.
 *
 * Partial success is success. If GitHub returns three of four scopes, that is a
 * good read and the person keeps their source; the missing scope simply scores
 * nothing. Only a source where EVERY scope failed is an empty source, because
 * that is the case the user can actually do something about.
 */
export async function readSourceSettled(
  source: SourceId,
  requestId: string,
): Promise<SourceRead> {
  const privateKey = process.env.VANA_APP_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing VANA_APP_PRIVATE_KEY");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const controller = controllerFor(source);
  const status = await controller.getAccessRequestStatus(requestId);

  if (
    (status.status !== "approved" && status.status !== "ready_for_read") ||
    !status.personalServerUrl ||
    !status.grantId
  ) {
    throw new AccessNotApprovedError(
      "Request is not approved or is missing grantId/personalServerUrl",
      {
        requestId,
        status: status.status,
        hasPersonalServerUrl: Boolean(status.personalServerUrl),
        hasGrantId: Boolean(status.grantId),
        hasScope: Boolean(status.scope),
      },
    );
  }

  const signMessage = (message: string | Uint8Array) =>
    account.signMessage({
      message: typeof message === "string" ? message : { raw: message },
    });

  const paid = { any: false };

  const ctx: ReadContext = {
    paid,
    personalServerUrl: status.personalServerUrl,
    grantId: status.grantId,
    account,
    escrow: escrowConfig(account),
    signMessage,
  };

  /**
   * `status.scope` first, then the rest.
   *
   * The reported scope is the one guaranteed to be readable. Putting it first
   * means that if the multi-scope assumption turns out to be wrong, we still
   * come away with one good read instead of a coin flip, and the logs say
   * exactly which of the others were refused.
   */
  const declared = scopesFor(source);
  const ordered = status.scope
    ? [status.scope, ...declared.filter((scope) => scope !== status.scope)]
    : declared;

  const settled = await Promise.allSettled(
    ordered.map(async (scope) => ({ scope, data: await readScopeSettled(source, requestId, scope, ctx) })),
  );

  const reads: ScopeRead[] = [];
  const failures: ScopeFailure[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      reads.push(result.value);
      return;
    }
    const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
    const notGranted = isScopeNotGranted(error) && ordered[index] !== status.scope;
    failures.push({ scope: ordered[index], error, notGranted });
  });

  if (failures.some((failure) => failure.notGranted)) {
    // The one v2 assumption that has not been proven against a live grant. If
    // this fires, the fix is one access request per scope: more approval trips,
    // same money, no change to anything else.
    console.error("[vana/settle] MULTI-SCOPE GRANT REFUSED", {
      requestId,
      source,
      readableScope: status.scope,
      refused: failures.filter((f) => f.notGranted).map((f) => f.scope),
    });
    // Counted as well as logged, so this reaches the admin page instead of
    // sitting in a log stream nobody opens. It is the loudest thing in the
    // codebase and it was, until now, completely silent in practice.
    countAsync("multi_scope_refused", source);
  }

  console.info("[vana/settle] source read", {
    requestId,
    source,
    ok: reads.map((read) => read.scope),
    failed: failures.map((failure) => failure.scope),
  });

  if (reads.length === 0) {
    /**
     * Empty and paid-for are different problems with different owners.
     *
     * An empty source is the user's to fix: nothing imported, or the wrong
     * account. A source that was PAID for and still returned nothing is ours,
     * and telling somebody to go check their import when the fault was at this
     * end would send them off to fix something that was never broken.
     */
    if (paid.any) {
      console.error("[vana/settle] PAID AND GOT NOTHING", { requestId, source, failures });
      throw new PaidButFailedError(source, failures[0]?.error);
    }
    throw new SourceEmptyError(source, { requestId, failures });
  }

  /**
   * Acknowledge exactly once, after every scope has been read.
   *
   * This moves the request to `completed`, which is terminal. Doing it any
   * earlier would strand the remaining scopes behind a Personal Server that is
   * no longer serving them.
   */
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

  return { source, reads, failures, paid: paid.any };
}
