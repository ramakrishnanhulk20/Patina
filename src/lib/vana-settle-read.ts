import {
  AccessNotApprovedError,
  authorizeEscrowPayment,
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
import { Redis } from "@upstash/redis";
import { privateKeyToAccount } from "viem/accounts";
import { controllerFor, type SourceId } from "./vana";

/**
 * Paid read that matches the protocol docs, not only the SDK's header-only path.
 *
 * docs.vana.org §4.5: challenge → settle from escrow → retry with X-PAYMENT.
 * SDK 3.13.4 / PR184 `readPersonalServerData` only signs an X-PAYMENT header and
 * never calls `/v1/escrow/pay`. That leaves Patina stuck on
 * "still requires payment after escrow settlement" while Career Quest (and the
 * docs) expect a real gateway settle first.
 *
 * Here we: probe → authorizeEscrowPayment (payForOp) → retry with X-PAYMENT → ack.
 */

const network = process.env.VANA_NETWORK === "moksha" ? "moksha" : "mainnet";
const env = process.env.VANA_ENV === "dev" ? "dev" : "production";
const chainId = network === "mainnet" ? 1480 : 14800;

function redisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function nextPaymentNonce(payerAddress: string): Promise<bigint> {
  const redis = redisClient();
  if (!redis) return BigInt(Date.now());
  const n = await redis.incr(`patina:v1:vana-payment-nonce:${payerAddress.toLowerCase()}`);
  return BigInt(n);
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
    nonceSource: nextPaymentNonce,
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
      message:
        typeof message === "string"
          ? message
          : { raw: message },
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

  let gatewayReceipt: unknown;
  if (res.status === 402) {
    const required = (await parsePersonalServerPaymentRequired(
      res,
      status.grantId!,
    )) as PersonalServerPaymentOperation;

    console.info("[vana/settle] challenge", {
      requestId,
      source,
      opType: required.opType,
      opId: required.opId,
      amount: required.amount,
      asset: required.asset,
      hasAccessRecord: Boolean(required.accessRecord),
      paymentNonce: required.paymentNonce,
    });

    try {
      gatewayReceipt = await authorizeEscrowPayment({
        payerAddress: account.address,
        required,
        config: escrow,
      });
      console.info("[vana/settle] payForOp ok", {
        requestId,
        source,
        receipt: gatewayReceipt,
      });
    } catch (err) {
      console.error("[vana/settle] payForOp failed", {
        requestId,
        source,
        error: err instanceof Error ? err.message : err,
      });
      throw err;
    }

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

    if (res.status === 402) {
      const body = await res.text().catch(() => "");
      console.error("[vana/settle] still 402 after payForOp", {
        requestId,
        source,
        body: body.slice(0, 1500),
      });
      throw new PaymentRequiredError(
        "Personal Server still requires payment after escrow settlement",
        {
          scope: status.scope,
          grantId: required.grantId,
          asset: required.asset,
          amount: required.amount,
          opType: required.opType,
          gatewayReceipt,
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
  const payment =
    paymentResponseMetadataFromHeader(res.headers.get("X-PAYMENT-RESPONSE")) ??
    (gatewayReceipt as ApprovedDataResult["payment"]);

  // Same ack the controller would send after a successful read.
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
    payment: payment as ApprovedDataResult["payment"],
  };
}
