import {
  AccessNotApprovedError,
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
 * Paid Personal Server read.
 *
 * Do NOT call `/v1/escrow/pay` with the challenge `accessRecord`. Web Personal
 * Servers mint local `dataPointId`s the gateway does not know, which 400s as:
 *   accessRecord.dataPointId … not found in gateway
 *
 * Correct flow (stock SDK / Career Quest):
 *   402 → sign X-PAYMENT (may include accessRecord in the PS-bound payload)
 *       → optional gateway soft-lock WITHOUT accessRecord
 *       → retry the Personal Server with X-PAYMENT
 * The Personal Server verifies the signature and settles.
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
      opId: required.opId,
      amount: required.amount,
      asset: required.asset,
      hasAccessRecord: Boolean(required.accessRecord),
      dataPointId: required.accessRecord?.dataPointId,
      paymentNonce: required.paymentNonce,
    });

    const paymentHeader = await buildEscrowPaymentHeader({
      payerAddress: account.address,
      required,
      config: escrow,
    });

    // Soft-lock on the gateway using the same signature, but never attach the
    // PS-local accessRecord (that is what 400'd with dataPointId not found).
    try {
      await payFromSignedHeaderWithoutAccessRecord({
        escrow,
        payerAddress: account.address,
        paymentHeader,
      });
      console.info("[vana/settle] gateway pay ok (no accessRecord)");
    } catch (err) {
      console.warn("[vana/settle] gateway pay skipped/failed", {
        requestId,
        source,
        error: err instanceof Error ? err.message : err,
      });
    }

    req = await buildRequest();
    res = await fetch(req.url, {
      method: req.method,
      headers: { ...req.headers, "X-PAYMENT": paymentHeader },
    });

    if (res.status === 402) {
      const body = await res.text().catch(() => "");
      console.error("[vana/settle] still 402 after X-PAYMENT", {
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
          dataPointId: required.accessRecord?.dataPointId,
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

async function payFromSignedHeaderWithoutAccessRecord(params: {
  escrow: EscrowPaymentConfig;
  payerAddress: `0x${string}`;
  paymentHeader: string;
}): Promise<void> {
  const json = Buffer.from(params.paymentHeader, "base64").toString("utf8");
  const decoded = JSON.parse(json) as {
    payload?: {
      message?: {
        opType?: string;
        opId?: string;
        asset?: string;
        amount?: string;
        paymentNonce?: string;
      };
      signature?: string;
    };
  };

  const message = decoded.payload?.message;
  const signature = decoded.payload?.signature;
  if (
    !message?.opType ||
    !message.opId ||
    !message.asset ||
    !message.amount ||
    !message.paymentNonce ||
    !signature
  ) {
    throw new Error("Could not decode X-PAYMENT payload for gateway pay");
  }

  await params.escrow.client.payForOp({
    payerAddress: params.payerAddress,
    opType: message.opType,
    opId: message.opId as `0x${string}`,
    asset: message.asset as `0x${string}`,
    amount: message.amount,
    paymentNonce: message.paymentNonce,
    signature: signature as `0x${string}`,
  });
}
