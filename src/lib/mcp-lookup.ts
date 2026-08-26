/**
 * What an AI agent is allowed to learn about a Patina profile.
 *
 * This sits between the store and the MCP tools for two reasons.
 *
 *  1. The public HTTP API throws away precision the agent path needs. It
 *     exposes `oldestYear`, an integer, while the scorer already computed
 *     `oldestSignal.years` to one decimal. Tenure is the entire pitch of this
 *     product, so losing up to a year of it on the way out is not acceptable.
 *     Reading the store directly keeps the decimal.
 *  2. The privacy rules for the handle resolver are load-bearing and belong in
 *     one testable place rather than scattered through tool callbacks.
 *
 * Nothing here writes. Every export is a read.
 */

import { evidenceOf, getProfile, profileForUsername, profileIdForAccount } from "./store.ts";
import { scorePatina, verdict, type SourceId } from "./score.ts";
import { attestationSigner, buildAttestation } from "./attest.ts";
import { PATINA_APP_ADDRESS } from "./patina-address.ts";
import { siteUrl } from "./site.ts";

/**
 * Patina's live signing address. Defined in one place (see patina-address.ts)
 * so the docs, the verifier page and this layer cannot drift apart.
 */
export const PUBLISHED_APP_ADDRESS = PATINA_APP_ADDRESS;

/**
 * The verdict bands, spelled out so a tool description can tell a model what a
 * number MEANS. An agent handed `96` otherwise has no idea whether that is
 * good.
 *
 * These mirror `verdict()` in score.ts, which is the only place they are
 * decided. Duplicating them here is a drift risk, so `mcp-lookup.test.ts`
 * asserts every boundary in this table against the real function. If somebody
 * moves a band in score.ts, that test fails rather than this text quietly
 * lying to every agent that reads it.
 */
export const VERDICT_BANDS = [
  { min: 80, verdict: "Deeply worn in" },
  { min: 60, verdict: "Well established" },
  { min: 40, verdict: "Some real history" },
  { min: 20, verdict: "Thin, but genuine so far" },
  { min: 0, verdict: "Not much to go on yet" },
] as const;

/** One sentence a tool description can hand a model to calibrate the number. */
export const SCORE_MEANING =
  "Patina scores 0-100 for how much provable history an account holder has, " +
  "not for how popular or how real-time-verified they are. 80+ (Deeply worn in) " +
  "means a long, multi-year record corroborated across independent platforms. " +
  "60-79 (Well established) is a solid multi-year record. 40-59 (Some real history) " +
  "is genuine but shorter or thinner. 20-39 (Thin, but genuine so far) is an early " +
  "account with a little history. Under 20 (Not much to go on yet) looks freshly " +
  "created, or has almost nothing connected. The inputs, heaviest first: Age (30, " +
  "full marks at 12 years), Continuity (25, how many separate months the person " +
  "was actually present for), Corroboration (15, independent sources agreeing on " +
  "the date), Vouches (12, WHEN other people connected to them rather than how " +
  "many), Depth (10, things made) and Breadth (8, independent accounts). Follower " +
  "counts are deliberately worth almost nothing, because they are purchasable.";

/**
 * What a caller must understand about an unsigned score.
 *
 * The floor is one source proving one real date, and it is deliberately that
 * low. Somebody with a single fifteen-year GitHub history has proved a great
 * deal, and Corroboration already docks a thin profile for having nobody to
 * agree with it, so withholding the signature on top of that punished the same
 * fact twice.
 *
 * What remains unsignable is a profile with no date at all, where an
 * attestation reading "this person's accounts go back to ..." would have
 * nothing to put after the "to".
 */
export const PROVISIONAL_MEANING =
  "A provisional score has no date behind it: nothing the person connected proves " +
  "when anything started, so there is nothing for Patina to attest to. The number " +
  "is still computed honestly, but it carries no attestation. Treat " +
  "provisional:true as 'no evidence either way', never as 'suspicious'. If you " +
  "need a stronger bar than Patina's own, gate on sourcesConnected.length or " +
  "yearsOfHistory rather than on this flag.";

/**
 * Sources whose stored account id is a handle a person could actually type.
 *
 * This is the whole reason `resolve_identity` is restricted. The id Patina
 * stores comes from `identityOf()` in normalize.ts, and what it holds varies
 * by source:
 *
 *   github    -> the GitHub username            (resolvable)
 *   instagram -> the Instagram username         (resolvable)
 *   linkedin  -> the vanity slug from the URL   (resolvable)
 *   youtube   -> prefers `channelId` (UC...), and can fall back to an EMAIL
 *   spotify   -> an opaque Spotify user id
 *   amazon    -> nothing at all; the payload carries no account id
 *   uber      -> nothing at all; same
 *
 * An agent holding "github.com/torvalds" can use the first three and can never
 * supply the rest. Offering them anyway would mean a tool that silently never
 * matches, which is worse than one that says plainly it cannot help.
 *
 * YouTube is excluded for a second and stronger reason: because its id can be
 * an email address, an open resolver over it would answer "does this email
 * have a Patina profile", one address at a time. That is an email enumeration
 * oracle on an endpoint with no key and no login, and no amount of trimming
 * the response fixes it, because `found: true` is itself the disclosure.
 */
export const RESOLVABLE_SOURCES = ["github", "instagram", "linkedin"] as const;
export type ResolvableSource = (typeof RESOLVABLE_SOURCES)[number];

export function isResolvableSource(source: string): source is ResolvableSource {
  return (RESOLVABLE_SOURCES as readonly string[]).includes(source);
}

export type ScoreComponent = {
  key: string;
  label: string;
  points: number;
  max: number;
  detail: string;
};

export type Attestation = {
  app: string;
  message: string;
  signature: string;
  issuedAt: string;
  /**
   * When this statement stops being good, copied out of the signed message.
   *
   * The authoritative value is the one inside `message`, which is what the
   * signature covers. This field is here so an agent can decide how long to
   * hold on to the answer without parsing anything, and must never be the only
   * thing a verifier checks.
   */
  expiresAt: string;
  howToVerify: string;
};

export type ProfileFound = {
  found: true;
  username: string;
  score: number;
  verdict: string;
  /**
   * Years from the oldest provable signal to now, one decimal. Null when
   * nothing connected carries a date, which is a real and reportable state:
   * a profile can score on breadth and standing while proving no tenure at
   * all, and that is exactly the case an agent must not read as "old".
   */
  yearsOfHistory: number | null;
  oldestYear: number | null;
  oldestSource: string | null;
  sourcesConnected: SourceId[];
  components: ScoreComponent[];
  /**
   * True when the profile is below the signing floor. The score is real; the
   * evidence behind it is too thin to certify. See PROVISIONAL_MEANING for what
   * a caller should do with it, which is not "distrust this person".
   */
  provisional: boolean;
  provisionalReason: string | null;
  profileUrl: string;
  docs: string;
  /**
   * Null when this deployment has no signing key configured. The score is
   * still true; it just arrives unsigned, and saying so is better than
   * failing the whole call or implying a signature that is not there.
   */
  attestation: Attestation | null;
};

export type ProfileMissing = {
  found: false;
  username: string;
  reason: string;
};

export type ProfileLookup = ProfileFound | ProfileMissing;

/**
 * Every address that counts as "signed by Patina".
 *
 * There are two, and conflating them produces a wrong answer in a way that
 * matters. `canonical` is the address Patina publishes and the one every live
 * attestation in the wild carries; it is what an agent should compare against.
 * `configured` is whatever key THIS deployment happens to hold, which on a
 * preview deploy or locally is a throwaway testnet key signing nothing anybody
 * has seen.
 *
 * Checking only the configured key makes a preview deployment declare genuine
 * production attestations forged, which is the most damaging possible failure
 * for a tool whose entire job is answering "is this real". Checking only the
 * canonical one means a preview deploy cannot verify the attestations it just
 * produced itself. So accept both, and say which matched.
 */
export function acceptedSigners(): { canonical: string; configured: string | null } {
  let configured: string | null = null;
  try {
    configured = attestationSigner();
  } catch {
    configured = null;
  }

  const sameAsCanonical =
    configured !== null && configured.toLowerCase() === PUBLISHED_APP_ADDRESS.toLowerCase();

  return {
    canonical: PUBLISHED_APP_ADDRESS,
    configured: sameAsCanonical ? null : configured,
  };
}

/**
 * The address an agent should compare a recovered signer against. Always the
 * published one, because that is the claim Patina makes publicly and the only
 * address a third party can check independently.
 */
export function expectedSigner(): string {
  return acceptedSigners().canonical;
}

/**
 * A five minute memo on score lookups.
 *
 * Scores move slowly (the public docs already tell consumers to cache), and
 * MCP calls arrive from Anthropic's shared infrastructure rather than from one
 * user's device, so the same popular username can be asked for repeatedly in a
 * short window. Serverless instances are short-lived, so this is a cheap
 * per-instance win rather than a real cache tier, which is all it needs to be.
 *
 * The attestation is cached with the payload deliberately, and stays valid.
 * The signature covers both `issuedAt` and `expiresAt`, so a verifier
 * recovers the same address either way; the only effect is that both dates can
 * trail the clock by up to five minutes, against a lifetime of thirty days.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; value: ProfileLookup }>();

function cached(key: string): ProfileLookup | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function remember(key: string, value: ProfileLookup): void {
  // Oldest-first eviction. Map preserves insertion order, so the first key is
  // the oldest. Keeps a long-lived instance from growing without bound.
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), value });
}

/** Test seam. Lets a test prove caching without waiting five minutes. */
export function clearLookupCache(): void {
  cache.clear();
}

/**
 * Everything the agent tools know about one public profile.
 *
 * A username nobody holds is NOT an error. "This person has no Patina profile"
 * is a genuine, useful answer to an agent deciding whether to trust somebody,
 * and turning it into a thrown error would make a normal outcome look like a
 * broken server.
 */
export async function lookupByUsername(rawUsername: string): Promise<ProfileLookup> {
  const username = rawUsername.trim();

  if (!username) {
    return { found: false, username, reason: "No username was supplied." };
  }

  const key = username.toLowerCase();
  const hit = cached(key);
  if (hit) return hit;

  const profile = await profileForUsername(username);

  // A profile with no username has not chosen to be public, so it is not
  // reachable here even if it exists under some other key.
  if (!profile || !profile.username) {
    const miss: ProfileMissing = {
      found: false,
      username,
      reason:
        `No Patina profile is published under the name "${username}". ` +
        "That means this person has not connected accounts to Patina, or has not " +
        "made their profile public. It is not evidence of anything about them.",
    };
    remember(key, miss);
    return miss;
  }

  const score = scorePatina(evidenceOf(profile));
  const theVerdict = verdict(score);
  const oldestYear = score.oldestSignal
    ? new Date(score.oldestSignal.date).getUTCFullYear()
    : null;

  const found: ProfileFound = {
    found: true,
    username: profile.username,
    score: score.total,
    verdict: theVerdict,
    yearsOfHistory: score.oldestSignal?.years ?? null,
    oldestYear,
    oldestSource: score.oldestSignal?.source ?? null,
    sourcesConnected: score.sourcesConnected,
    components: score.components.map((component) => ({
      key: component.key,
      label: component.label,
      points: component.points,
      max: component.max,
      detail: component.detail,
    })),
    provisional: score.provisional,
    provisionalReason: score.provisionalReason,
    profileUrl: siteUrl(`/u/${encodeURIComponent(profile.username)}`),
    docs: siteUrl("/docs"),
    // A provisional profile gets no signature, because signing one would make
    // the attestation mean less for everybody who earned theirs.
    attestation: score.provisional
      ? null
      : await attestationFor({
          username: profile.username,
          score: score.total,
          verdict: theVerdict,
          oldestYear,
          sources: score.sourcesConnected.length,
        }),
  };

  remember(key, found);
  return found;
}

/**
 * Sign the score, or report honestly that this deployment cannot.
 *
 * `buildAttestation` throws when VANA_APP_PRIVATE_KEY is absent. Letting that
 * escape would fail the entire tool call over a missing signature, turning a
 * usable answer into an error for no good reason.
 */
async function attestationFor(input: {
  username: string;
  score: number;
  verdict: string;
  oldestYear: number | null;
  sources: number;
}): Promise<Attestation | null> {
  try {
    const attestation = await buildAttestation(input);
    return {
      app: attestation.app,
      message: attestation.message,
      signature: attestation.signature,
      issuedAt: attestation.issuedAt,
      expiresAt: attestation.expiresAt,
      howToVerify:
        "Two checks, both offline. Recover the EIP-191 signer of `message` from " +
        "`signature` (viem recoverMessageAddress, or ethers verifyMessage) and check it " +
        "equals `app`. Then read the `expiresAt` line out of `message` and check it is " +
        "still in the future. Neither needs a call to Patina, which is the point: you are " +
        "not being asked to take Patina's word for any of it.",
    };
  } catch {
    return null;
  }
}

export type ThresholdCheck = {
  pass: boolean;
  reason: string;
  found: boolean;
  score: number | null;
  yearsOfHistory: number | null;
};

/**
 * Does this person clear a bar?
 *
 * The tool agents will actually reach for, because models branch on booleans
 * far more reliably than they interpret a JSON blob. `reason` is written to be
 * quotable straight back to a user.
 */
export async function checkThreshold(params: {
  username: string;
  minScore?: number;
  minYears?: number;
}): Promise<ThresholdCheck> {
  const { username, minScore, minYears } = params;

  if (minScore === undefined && minYears === undefined) {
    return {
      pass: false,
      reason: "No bar was given. Supply min_score, min_years, or both.",
      found: false,
      score: null,
      yearsOfHistory: null,
    };
  }

  const profile = await lookupByUsername(username);

  if (!profile.found) {
    return {
      pass: false,
      reason:
        `No Patina profile is published under "${username}", so there is nothing to ` +
        "measure against the bar. Treat this as unknown, not as a failure.",
      found: false,
      score: null,
      yearsOfHistory: null,
    };
  }

  const failures: string[] = [];
  const passes: string[] = [];

  if (minScore !== undefined) {
    if (profile.score >= minScore) passes.push(`score ${profile.score} is at or above ${minScore}`);
    else failures.push(`score ${profile.score} is below ${minScore}`);
  }

  if (minYears !== undefined) {
    if (profile.yearsOfHistory === null) {
      failures.push(
        `no connected source carries a date, so there is no provable history to compare against ${minYears} years`,
      );
    } else if (profile.yearsOfHistory >= minYears) {
      passes.push(`${profile.yearsOfHistory} years of history is at or above ${minYears}`);
    } else {
      failures.push(`${profile.yearsOfHistory} years of history is below ${minYears}`);
    }
  }

  const pass = failures.length === 0;
  const sources = profile.sourcesConnected.length;
  const across =
    sources === 0
      ? "no connected sources"
      : `${sources} independent ${sources === 1 ? "platform" : "platforms"}`;

  return {
    pass,
    reason: pass
      ? `${profile.username} passes: ${passes.join(", ")}, across ${across}.`
      : `${profile.username} does not pass: ${failures.join(", ")}.`,
    found: true,
    score: profile.score,
    yearsOfHistory: profile.yearsOfHistory,
  };
}

export type IdentityResolution = {
  found: boolean;
  supported: boolean;
  score: number | null;
  yearsOfHistory: number | null;
  note: string;
};

/** Looks like an email address, so must never be used as a lookup key. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Trim a handle down to the part Patina actually stored.
 *
 * Agents hold things like "github.com/torvalds", "@torvalds" or
 * "linkedin.com/in/someone" far more often than they hold a bare slug, and the
 * stored value is always the bare slug. Normalising here costs nothing and is
 * the difference between a tool that usually works and one that usually does
 * not. Case is not handled here because the store lowercases the key itself.
 */
export function normalizeHandle(raw: string): string {
  let handle = raw.trim();

  // Strip a trailing slash first so the last path segment is never empty.
  handle = handle.replace(/\/+$/, "");

  if (handle.includes("/")) {
    const segments = handle.split("/").filter(Boolean);
    handle = segments[segments.length - 1] ?? "";
  }

  // Drop a query string or fragment left on a pasted URL.
  handle = handle.split(/[?#]/)[0] ?? "";

  return handle.replace(/^@+/, "").trim();
}

/**
 * Score and tenure for the person behind a platform handle. Nothing else.
 *
 * DELIBERATELY returns no username, no connected platforms, and no component
 * breakdown. Returning any of them would turn this into a working
 * cross-platform de-anonymisation tool: feed it a GitHub handle, receive the
 * person's Patina profile, and read off every other account they own. That is
 * a privacy hole and a directory rejection, and the constraint is not
 * negotiable. If you are editing this function, that is the rule to keep.
 *
 * Only profiles that have claimed a public username resolve. A profile without
 * one has never opted into being public anywhere else in the product, and an
 * agent lookup is not the place to make it so.
 */
export async function resolveIdentity(params: {
  source: string;
  handle: string;
}): Promise<IdentityResolution> {
  const source = params.source.trim().toLowerCase();
  const raw = params.handle.trim();

  if (!isResolvableSource(source)) {
    return {
      found: false,
      supported: false,
      score: null,
      yearsOfHistory: null,
      note:
        `Patina cannot look people up by their ${source || "(empty)"} handle. ` +
        `Only ${RESOLVABLE_SOURCES.join(", ")} are supported, because those are the ` +
        "only platforms where Patina stores an account id that a person could type. " +
        "For the others it stores an internal platform id that nobody knows offhand. " +
        "This is a limitation of the lookup only. Those platforms still count " +
        "fully toward the score itself.",
    };
  }

  // Checked before any @ stripping, so "someone@gmail.com" cannot be quietly
  // reshaped into something that looks like a handle.
  if (looksLikeEmail(raw)) {
    return {
      found: false,
      supported: false,
      score: null,
      yearsOfHistory: null,
      note:
        "Patina does not accept email addresses here. Looking people up by email " +
        "would let this endpoint be used to test which addresses belong to real " +
        "people, so it is refused regardless of what is stored.",
    };
  }

  const handle = normalizeHandle(raw);

  if (!handle) {
    return {
      found: false,
      supported: true,
      score: null,
      yearsOfHistory: null,
      note: "No handle was supplied.",
    };
  }

  /**
   * One profile per account now, rather than the set v1 kept.
   *
   * That index existed because a browser cookie was the identity, so the same
   * person connecting from a phone and a laptop produced two profiles claiming
   * one GitHub, and the resolver had to pick between them. Identity is the
   * Personal Server now: the second browser folds into the first profile before
   * anything is recorded, so the duplicate the set existed to reconcile is
   * created far more rarely.
   */
  const profileId = await profileIdForAccount(source as SourceId, handle);
  const profile = profileId ? await getProfile(profileId) : null;

  // A profile with no username has never opted into being public anywhere else
  // in the product, and an agent lookup is not the place to make it so.
  const best =
    profile && profile.username
      ? (() => {
          const score = scorePatina(evidenceOf(profile));
          return { score: score.total, yearsOfHistory: score.oldestSignal?.years ?? null };
        })()
      : null;

  if (!best) {
    return {
      found: false,
      supported: true,
      score: null,
      yearsOfHistory: null,
      note:
        `No public Patina profile is linked to that ${source} handle. That means ` +
        "nobody has connected it to Patina, or the owner has not made their profile " +
        "public. It says nothing about whether the account is genuine.",
    };
  }

  return {
    found: true,
    supported: true,
    score: best.score,
    yearsOfHistory: best.yearsOfHistory,
    note:
      "Score and length of history only. Patina deliberately does not reveal which " +
      "Patina profile this is, or what other platforms that person has connected.",
  };
}
