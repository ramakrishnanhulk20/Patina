import { privateKeyToAccount } from "viem/accounts";
import { recoverMessageAddress } from "viem";
import { PATINA_APP_ADDRESS, PATINA_APP_ADDRESS_LOWER } from "./patina-address.ts";

/**
 * A portable, tamper-proof, EXPIRING Patina score.
 *
 * A score on a page is only as trustworthy as the page. This signs a short,
 * human-readable statement with Patina's own key. Anyone can recover the signer
 * from the message and the signature and check it against the published
 * address, with no call back to us. That offline property is the whole reason
 * to build this on Vana rather than behind an OAuth wall, and everything below
 * is arranged to protect it.
 *
 * TWO THINGS CHANGED, and they were shipped together on purpose.
 *
 * 1. THEY NOW EXPIRE. An attestation used to record the date it was issued and
 *    nothing else, and verification only checked the signature. So a statement
 *    fetched today would still verify in five years, long after the profile had
 *    changed, gone quiet, or been deleted. For a product whose entire subject
 *    is time, a claim that never goes stale was the most consequential thing
 *    wrong with it.
 *
 *    The expiry travels INSIDE the signed message. That matters more than it
 *    looks: a revocation list would have fixed the same problem by making every
 *    verifier call Patina, which would have destroyed offline verification and
 *    turned Patina into a dependency for the people who integrated precisely
 *    because it was not one. A date in the message costs a verifier nothing.
 *
 * 2. THEY HAVE THEIR OWN KEY. Signing used to be done with the same key that
 *    holds and spends the escrow balance. The old comment here said, correctly,
 *    that signing a message cannot move funds. That was true and beside the
 *    point: the risk was never what signing does, it was that one secret was
 *    the blast radius for everything. A leak drained the money AND let anybody
 *    forge Patina's word about anybody.
 *
 *    Nothing had to be migrated, because attestations are generated fresh on
 *    every request rather than stored, so there was no back catalogue to break.
 *    Copies held by third parties age out on their own now that expiry exists,
 *    which is exactly why the two changes belong in one release.
 */

/**
 * How long a signed score stays good for.
 *
 * Thirty days is a compromise between two real costs. Shorter, and an app that
 * caches a score has to re-fetch constantly, which makes Patina feel like an
 * uptime dependency. Longer, and somebody can present a statement about a
 * profile that has since been deleted. A month is roughly how long a Patina
 * score stays true anyway: the underlying number only moves when somebody
 * connects another source.
 */
export const ATTESTATION_VALID_DAYS = 30;

const VALID_MS = ATTESTATION_VALID_DAYS * 24 * 60 * 60 * 1000;

/**
 * The key that signs scores, which should NOT be the one holding the money.
 *
 * Falls back to the escrow key when no dedicated one is set, so an existing
 * deployment keeps working the moment this ships rather than breaking on a
 * missing variable. The fallback is reported by `usingSharedKey` below and
 * surfaced on the admin page, because a security improvement nobody can tell
 * is switched off is not one.
 */
function signingKey(): { key: string; dedicated: boolean } {
  const dedicated = process.env.PATINA_ATTESTATION_KEY?.trim();
  if (dedicated) return { key: dedicated, dedicated: true };

  const shared = process.env.VANA_APP_PRIVATE_KEY;
  if (!shared) throw new Error("Missing PATINA_ATTESTATION_KEY and VANA_APP_PRIVATE_KEY");
  return { key: shared, dedicated: false };
}

function account() {
  return privateKeyToAccount(signingKey().key as `0x${string}`);
}

/**
 * Does the key actually in use match the address Patina publishes?
 *
 * THE MOST DAMAGING SILENT FAILURE IN THE SYSTEM, and until now nothing looked
 * for it. The published address lives in the code and the signing key lives in
 * the hosting settings, so the two are edited in different places, at different
 * times, by hand. Get them out of step and everything keeps working: scores
 * render, the API answers, no error appears anywhere. The only symptom is that
 * every verifier in the world is told that every genuine Patina score is a
 * forgery. Quietly, and in a way that makes Patina look like the liar.
 *
 * That is exactly the class of mistake a person cannot be asked to catch by
 * being careful, because there is nothing to notice. So the app checks itself
 * and says so on the admin page.
 *
 * Returns `matches: false` on a preview or local deployment holding its own
 * test key, which is correct and expected rather than an emergency; the caller
 * decides how loudly to say it. ``configured`` is null when no key works at all.
 */
export function signerCheck(): {
  matches: boolean;
  published: string;
  configured: string | null;
} {
  let configured: string | null = null;
  try {
    configured = attestationSigner();
  } catch {
    configured = null;
  }
  return {
    matches: configured !== null && configured.toLowerCase() === PATINA_APP_ADDRESS_LOWER,
    published: PATINA_APP_ADDRESS,
    configured,
  };
}

/** True when scores are still being signed by the key that holds the escrow. */
export function usingSharedKey(): boolean {
  try {
    return !signingKey().dedicated;
  } catch {
    return false;
  }
}

/** The address every attestation is signed by, and verified against. */
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
  /** After this moment the statement is stale and must not be accepted. */
  expiresAt: string;
};

/**
 * The exact string that gets signed. Deterministic, so a verifier can reproduce
 * it, and self-describing, so a person reading one understands it without
 * documentation.
 *
 * `expiresAt` sits inside the signed bytes rather than beside them in the JSON.
 * A field outside the signature is a suggestion: anybody handing on a stale
 * attestation would simply edit it, and the signature would still check out.
 */
function canonicalMessage(
  input: AttestationInput,
  app: string,
  issuedAt: string,
  expiresAt: string,
): string {
  return [
    "Patina score attestation",
    "",
    `username: ${input.username}`,
    `score: ${input.score}/100`,
    `verdict: ${input.verdict}`,
    `oldest: ${input.oldestYear ?? "none"}`,
    `sources: ${input.sources}`,
    `issuedAt: ${issuedAt}`,
    `expiresAt: ${expiresAt}`,
    `app: ${app}`,
  ].join("\n");
}

export async function buildAttestation(input: AttestationInput): Promise<ScoreAttestation> {
  const acct = account();
  const now = Date.now();
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + VALID_MS).toISOString();
  const message = canonicalMessage(input, acct.address, issuedAt, expiresAt);
  const signature = await acct.signMessage({ message });
  return { app: acct.address, message, signature, issuedAt, expiresAt };
}

/** Pull the expiry back out of a signed message, for a verifier checking one. */
export function expiryOf(message: string): Date | null {
  const found = /^expiresAt: (.+)$/m.exec(message);
  if (!found) return null;
  const date = new Date(found[1].trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

export type VerifyResult = {
  /** Genuine AND still current. The only value worth trusting. */
  valid: boolean;
  /** The signature really is Patina's, whatever the date says. */
  signatureValid: boolean;
  /** Signed, but past its expiry. Not a forgery, just out of date. */
  expired: boolean;
  /** When it lapses, or lapsed. Null on the older format that carried none. */
  expiresAt: Date | null;
};

/**
 * What a consumer runs to check an attestation.
 *
 * Reports the two failures SEPARATELY, because they mean opposite things and
 * conflating them is how a verifier ends up calling an honest person a forger.
 * A bad signature means somebody made it up. An expired one means they were
 * telling the truth a while ago and need to fetch a fresh copy.
 *
 * An attestation with no expiry line at all is treated as expired rather than
 * as valid forever. Those are the old format, they are exactly the statements
 * this change exists to retire, and the safe reading of "no stated lifetime" is
 * not "unlimited".
 */
export async function verifyAttestation(params: {
  app: `0x${string}`;
  message: string;
  signature: `0x${string}`;
  /** Override for testing, or to check what a statement looked like earlier. */
  at?: Date;
}): Promise<VerifyResult> {
  const expiresAt = expiryOf(params.message);
  const now = (params.at ?? new Date()).getTime();
  const expired = expiresAt === null || expiresAt.getTime() <= now;

  let signatureValid = false;
  try {
    const recovered = await recoverMessageAddress({
      message: params.message,
      signature: params.signature,
    });
    signatureValid = recovered.toLowerCase() === params.app.toLowerCase();
  } catch {
    signatureValid = false;
  }

  return { valid: signatureValid && !expired, signatureValid, expired, expiresAt };
}
