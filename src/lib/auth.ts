import { connect, createSessionRelay } from "@opendatalabs/connect/server";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Signing in, purely to learn who somebody is.
 *
 * `mode: "auth"` asks Vana to authenticate the person and hand back their
 * wallet address without touching any data, without a grant, and without a
 * fee. That address is the same on every device they own, because the same
 * Google login produces the same embedded wallet.
 *
 * This is the only reliable identity available to us. The older Direct SDK that
 * drives the actual data reads never reveals who the user is: it returns a
 * grant id, a scope and a Personal Server URL, and nothing that survives a
 * change of browser. Keying profiles off a cookie instead meant one person on
 * two devices became two people with two half-finished scores.
 */

const RELAY_URL = "https://session-relay.vana.org";
const DEV_RELAY_URL = "https://dev.session-relay.vana.org";

function environment(): "dev" | "prod" {
  return process.env.VANA_NETWORK === "mainnet" ? "prod" : "dev";
}

function privateKey(): `0x${string}` {
  const key = process.env.VANA_APP_PRIVATE_KEY;
  if (!key) throw new Error("VANA_APP_PRIVATE_KEY is not set");
  return key as `0x${string}`;
}

export type AuthStart = {
  sessionId: string;
  connectUrl: string;
  expiresAt: string;
};

export async function startAuth(): Promise<AuthStart> {
  const result = await connect({
    privateKey: privateKey(),
    mode: "auth",
    appUrl: process.env.VANA_APP_URL ?? "https://patinadata.xyz",
    dataSource: "Patina",
    environment: environment(),
  });

  return {
    sessionId: result.sessionId,
    connectUrl: result.connectUrl,
    expiresAt: result.expiresAt,
  };
}

export type AuthStatus =
  | { status: "pending" }
  | { status: "approved"; address: string }
  | { status: "denied" | "expired"; reason?: string };

/** One poll. The caller drives the loop so a hung session cannot pin a request open. */
export async function pollAuth(sessionId: string): Promise<AuthStatus> {
  const relay = createSessionRelay({
    privateKey: privateKey(),
    granteeAddress: appAddressFromKey(),
    sessionRelayUrl: environment() === "prod" ? RELAY_URL : DEV_RELAY_URL,
  });

  const result = await relay.pollSession(sessionId);

  if (result.status === "approved") {
    const address = result.grant?.userAddress;
    if (!address) return { status: "pending" };
    return { status: "approved", address };
  }

  if (result.status === "denied" || result.status === "expired") {
    return { status: result.status, reason: result.reason };
  }

  // "claimed" means the user has opened it but not finished. Still pending to us.
  return { status: "pending" };
}

/** Derived rather than configured, so it can never disagree with the key in use. */
function appAddressFromKey(): `0x${string}` {
  return privateKeyToAccount(privateKey()).address;
}
