import { privateKeyToAccount } from "viem/accounts";
import { recoverMessageAddress } from "viem";

/**
 * A portable, tamper-proof Patina score.
 *
 * A score on a page is only as trustworthy as the page. This signs a short,
 * human-readable statement, "Patina attests that <name> scored <n>", with the
 * app's own key. Anyone can recover the signer from the message and signature
 * and check it equals Patina's public app address (the same one that pays for
 * reads on Vana), with no call back to us. That is what makes the score
 * portable: another app can carry it around and verify it offline, which is the
 * whole promise of building on Vana rather than behind an OAuth wall.
 *
 * Signing a message cannot move funds. It is an EIP-191 personal_sign, not a
 * transaction. So using the escrow key here is safe.
 */

function account() {
  const key = process.env.VANA_APP_PRIVATE_KEY;
  if (!key) throw new Error("Missing VANA_APP_PRIVATE_KEY");
  return privateKeyToAccount(key as `0x${string}`);
}

/** Patina's on-chain app address. The identity every attestation is signed by. */
export function attestationSigner(): `0x${string}` {
  return account().address;
}

export type AttestationInput = {
  username: string;
  score: number;
  verdict: string;
  oldestYear: number | null;
  sources: number;
};

export type ScoreAttestation = {
  app: `0x${string}`;
  message: string;
  signature: `0x${string}`;
  issuedAt: string;
};

/** The exact string that gets signed. Deterministic, so a verifier can reproduce it. */
function canonicalMessage(input: AttestationInput, app: string, issuedAt: string): string {
  return [
    "Patina score attestation",
    "",
    `username: ${input.username}`,
    `score: ${input.score}/100`,
    `verdict: ${input.verdict}`,
    `oldest: ${input.oldestYear ?? "none"}`,
    `sources: ${input.sources}`,
    `issuedAt: ${issuedAt}`,
    `app: ${app}`,
  ].join("\n");
}

export async function buildAttestation(input: AttestationInput): Promise<ScoreAttestation> {
  const acct = account();
  const issuedAt = new Date().toISOString();
  const message = canonicalMessage(input, acct.address, issuedAt);
  const signature = await acct.signMessage({ message });
  return { app: acct.address, message, signature, issuedAt };
}

/**
 * What a consumer runs to check an attestation: recover the signer and confirm
 * it is the claimed app. Exported so the behaviour is documented and testable;
 * external verifiers can do the same with any EIP-191 library.
 */
export async function verifyAttestation(params: {
  app: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}): Promise<boolean> {
  try {
    const recovered = await recoverMessageAddress({
      message: params.message,
      signature: params.signature,
    });
    return recovered.toLowerCase() === params.app.toLowerCase();
  } catch {
    return false;
  }
}
