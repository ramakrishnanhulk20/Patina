import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PUBLISHED_APP_ADDRESS,
  RESOLVABLE_SOURCES,
  VERDICT_BANDS,
  acceptedSigners,
  checkThreshold,
  clearLookupCache,
  expectedSigner,
  isResolvableSource,
  lookupByUsername,
  normalizeHandle,
  resolveIdentity,
} from "./mcp-lookup.ts";
import { verdict, type PatinaScore } from "./score.ts";
import { PATINA_APP_ADDRESS, PATINA_APP_ADDRESS_LOWER } from "./patina-address.ts";
import { ensureProfile, newProfileId, recordSource, setUsername } from "./store.ts";
import { getAddress } from "viem";

/**
 * These tests run against the store's in-memory fallback, because no Upstash
 * credentials are configured under `npm test`. That is exactly the ground the
 * MCP tools have to stand on in a preview deploy too, so it is worth testing.
 */

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const yearsAgo = (years: number) => new Date(Date.now() - years * YEAR_MS).toISOString();

/** A profile with a GitHub account of a given age, published under a name. */
async function publishProfile(username: string, accountAgeYears: number, handle = username) {
  const id = newProfileId();
  await ensureProfile(id);
  await recordSource(
    id,
    "github",
    {
      scope: "github.profile",
      readAt: new Date().toISOString(),
      externalId: handle,
      evidence: { github: { username: handle, createdAt: yearsAgo(accountAgeYears), repositoryCount: 12 } },
    },
    50,
  );
  const claimed = await setUsername(id, username);
  assert.equal(claimed.ok, true, `test setup failed to claim the name ${username}`);
  clearLookupCache();
  return id;
}

/**
 * The typo guard.
 *
 * Patina's address is a 42-character hex string that appears in the docs, on
 * the offline verifier, and in every "is this genuine" comparison. Retyping it
 * once produced a doubled character, which would have shipped a verification
 * snippet that reports every real attestation as forged: quiet, and it makes
 * Patina look like the dishonest party.
 *
 * EIP-55 checksums make that catchable. `getAddress` recomputes the mixed-case
 * checksum and throws, or returns something different, if a single hex digit
 * is wrong. So one assertion covers the whole class of error.
 */
test("Patina's published address is a real, correctly checksummed address", () => {
  assert.doesNotThrow(
    () => getAddress(PATINA_APP_ADDRESS),
    "the address fails its EIP-55 checksum, so a character is wrong",
  );
  assert.equal(getAddress(PATINA_APP_ADDRESS), PATINA_APP_ADDRESS, "casing must be canonical");
  assert.equal(PATINA_APP_ADDRESS.length, 42);
  assert.equal(PATINA_APP_ADDRESS_LOWER, PATINA_APP_ADDRESS.toLowerCase());
  assert.equal(PUBLISHED_APP_ADDRESS, PATINA_APP_ADDRESS, "the MCP layer must use the shared one");
});

/**
 * The drift guard.
 *
 * VERDICT_BANDS exists so a tool description can tell a model what a score
 * MEANS. It is a copy of thresholds that live in score.ts, and a copy that
 * silently goes stale would have every agent in the world confidently
 * misreporting what a Patina number represents. So assert the copy against the
 * real function at every boundary, including just below each one.
 */
test("the documented verdict bands match what score.ts actually returns", () => {
  const asScore = (total: number): PatinaScore => ({
    total,
    components: [],
    oldestSignal: null,
    sourcesConnected: [],
  });

  for (const band of VERDICT_BANDS) {
    assert.equal(
      verdict(asScore(band.min)),
      band.verdict,
      `score ${band.min} should read "${band.verdict}"`,
    );
  }

  // One point below each band must fall into the next one down, which is what
  // proves the boundaries are where the table claims and not merely inside it.
  for (const band of VERDICT_BANDS) {
    if (band.min === 0) continue;
    const below = verdict(asScore(band.min - 1));
    assert.notEqual(below, band.verdict, `score ${band.min - 1} must not read "${band.verdict}"`);
  }

  assert.equal(verdict(asScore(100)), "Deeply worn in");
  assert.equal(verdict(asScore(0)), "Not much to go on yet");
});

test("handles are normalised from whatever shape an agent has", () => {
  assert.equal(normalizeHandle("torvalds"), "torvalds");
  assert.equal(normalizeHandle("@torvalds"), "torvalds");
  assert.equal(normalizeHandle("  @torvalds  "), "torvalds");
  assert.equal(normalizeHandle("https://github.com/torvalds"), "torvalds");
  assert.equal(normalizeHandle("https://github.com/torvalds/"), "torvalds");
  assert.equal(normalizeHandle("github.com/torvalds?tab=repositories"), "torvalds");
  assert.equal(normalizeHandle("https://www.linkedin.com/in/someone-123"), "someone-123");
  assert.equal(normalizeHandle(""), "");
});

test("only the three handle-bearing sources are resolvable", () => {
  assert.deepEqual([...RESOLVABLE_SOURCES], ["github", "instagram", "linkedin"]);

  for (const source of ["github", "instagram", "linkedin"]) {
    assert.equal(isResolvableSource(source), true, `${source} should resolve`);
  }

  // These store an internal platform id, or no id at all. Offering them would
  // be a tool that silently never matches.
  for (const source of ["youtube", "spotify", "steam", "amazon", "uber", "", "twitter"]) {
    assert.equal(isResolvableSource(source), false, `${source} must not resolve`);
  }
});

test("an unsupported source is refused with an explanation, not an error", async () => {
  const result = await resolveIdentity({ source: "youtube", handle: "@someone" });

  assert.equal(result.supported, false);
  assert.equal(result.found, false);
  assert.equal(result.score, null);
  assert.match(result.note, /cannot look people up/i);
});

/**
 * The one that matters most.
 *
 * `identityOf` in normalize.ts can key a YouTube record on an EMAIL when the
 * payload carries no channel id. An open, keyless resolver over that would
 * answer "does this email address belong to a real person with history", one
 * address at a time. The refusal has to happen before any handle cleanup, so a
 * leading-@ strip can never reshape an address into something that looks like
 * a handle.
 */
test("email addresses are refused as lookup keys on every source", async () => {
  for (const source of RESOLVABLE_SOURCES) {
    const result = await resolveIdentity({ source, handle: "someone@gmail.com" });

    assert.equal(result.found, false, `${source} must not resolve an email`);
    assert.equal(result.supported, false);
    assert.equal(result.score, null);
    assert.equal(result.yearsOfHistory, null);
    assert.match(result.note, /does not accept email/i);
  }
});

/**
 * The privacy constraint, asserted on the actual returned object rather than
 * trusted from the code. If somebody later adds a username or a source list to
 * this response, this fails.
 */
test("resolve_identity returns score and tenure only, never identity", async () => {
  await publishProfile("resolvable_person", 9, "veteran-dev");

  const result = await resolveIdentity({ source: "github", handle: "veteran-dev" });

  assert.equal(result.found, true);
  assert.equal(typeof result.score, "number");
  assert.equal(typeof result.yearsOfHistory, "number");

  const keys = Object.keys(result).sort();
  assert.deepEqual(keys, ["found", "note", "score", "supported", "yearsOfHistory"]);

  const serialised = JSON.stringify(result);
  assert.ok(!serialised.includes("resolvable_person"), "must never leak the Patina username");
  assert.ok(!serialised.includes("veteran-dev"), "must never echo the platform handle back");
  assert.ok(!serialised.includes("sourcesConnected"), "must never list connected platforms");
  assert.ok(!serialised.includes("components"), "must never include the score breakdown");
});

test("a handle nobody has connected resolves to a clean not-found", async () => {
  const result = await resolveIdentity({ source: "github", handle: "nobody-has-this-handle-xyz" });

  assert.equal(result.found, false);
  assert.equal(result.supported, true);
  assert.equal(result.score, null);
  assert.match(result.note, /says nothing about whether the account is genuine/i);
});

test("a profile with no public username is not resolvable by handle", async () => {
  // Connected accounts, but never claimed a name. Being findable here would
  // publish somebody who never opted into being public.
  const id = newProfileId();
  await ensureProfile(id);
  await recordSource(
    id,
    "github",
    {
      scope: "github.profile",
      readAt: new Date().toISOString(),
      externalId: "private-person",
      evidence: { github: { username: "private-person", createdAt: yearsAgo(11), repositoryCount: 4 } },
    },
    60,
  );
  clearLookupCache();

  const result = await resolveIdentity({ source: "github", handle: "private-person" });
  assert.equal(result.found, false, "an unpublished profile must stay unpublished");
});

test("an unknown username is a clean answer, not a thrown error", async () => {
  const result = await lookupByUsername("definitely-not-a-real-patina-user");

  assert.equal(result.found, false);
  if (result.found) return;
  assert.match(result.reason, /No Patina profile/i);
  assert.match(result.reason, /not evidence of anything/i);
});

test("a published profile carries tenure to one decimal place", async () => {
  await publishProfile("tenured", 12.5, "tenured-dev");

  const result = await lookupByUsername("tenured");
  assert.equal(result.found, true);
  if (!result.found) return;

  assert.equal(result.username, "tenured");
  assert.equal(typeof result.score, "number");
  assert.ok(result.yearsOfHistory !== null, "a dated GitHub account must yield tenure");

  // The public HTTP API only exposes oldestYear, an integer. Reading the store
  // directly is what keeps the decimal, and the decimal is the entire product.
  assert.ok(result.yearsOfHistory! > 12.3 && result.yearsOfHistory! < 12.7);
  assert.equal(result.verdict, verdict({
    total: result.score,
    components: [],
    oldestSignal: null,
    sourcesConnected: [],
  }));
});

test("check_threshold refuses to answer without a bar", async () => {
  const result = await checkThreshold({ username: "tenured" });

  assert.equal(result.pass, false);
  assert.match(result.reason, /No bar was given/i);
});

test("check_threshold passes and fails on years, with a quotable reason", async () => {
  await publishProfile("decade_person", 10.4, "decade-dev");

  const passes = await checkThreshold({ username: "decade_person", minYears: 5 });
  assert.equal(passes.pass, true);
  assert.equal(passes.found, true);
  assert.match(passes.reason, /decade_person passes/);
  assert.match(passes.reason, /at or above 5/);

  const fails = await checkThreshold({ username: "decade_person", minYears: 20 });
  assert.equal(fails.pass, false);
  assert.match(fails.reason, /does not pass/);
  assert.match(fails.reason, /below 20/);
});

test("check_threshold requires every supplied bar to pass", async () => {
  await publishProfile("mixed_person", 9);

  const result = await checkThreshold({
    username: "mixed_person",
    minYears: 2,
    minScore: 100,
  });

  assert.equal(result.pass, false, "clearing years alone is not enough when a score bar is set");
  assert.match(result.reason, /below 100/);
});

test("an unknown person is reported as unknown rather than as a failure", async () => {
  const result = await checkThreshold({ username: "no-such-person-at-all", minScore: 50 });

  assert.equal(result.pass, false);
  assert.equal(result.found, false);
  assert.equal(result.score, null);
  assert.match(result.reason, /Treat this as unknown, not as a failure/i);
});

/**
 * With no signing key configured, the score must still be served. It just
 * arrives unsigned, and the expected-signer fallback still tells a verifier
 * what address to compare against.
 */
test("a deployment with no signing key still serves scores, unsigned", async () => {
  const saved = process.env.VANA_APP_PRIVATE_KEY;
  delete process.env.VANA_APP_PRIVATE_KEY;

  try {
    clearLookupCache();
    await publishProfile("unsigned_person", 7);

    const result = await lookupByUsername("unsigned_person");
    assert.equal(result.found, true);
    if (!result.found) return;

    assert.equal(result.attestation, null, "no key means no signature, not a crash");
    assert.equal(expectedSigner(), PUBLISHED_APP_ADDRESS);
  } finally {
    if (saved) process.env.VANA_APP_PRIVATE_KEY = saved;
    clearLookupCache();
  }
});

/**
 * A preview deploy holds a throwaway key. If verification compared only
 * against that key, the preview would call every genuine live attestation a
 * forgery, which is the worst possible answer from a tool whose job is telling
 * real from fake. The published address must always be accepted.
 */
test("verification always accepts Patina's published address, whatever this deployment holds", () => {
  const saved = process.env.VANA_APP_PRIVATE_KEY;

  try {
    // A key that is definitely not Patina's (Hardhat account #0).
    process.env.VANA_APP_PRIVATE_KEY =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    const signers = acceptedSigners();
    assert.equal(signers.canonical, PUBLISHED_APP_ADDRESS, "the published address is canonical");
    assert.notEqual(signers.configured, null, "a different local key is reported separately");
    assert.notEqual(
      signers.configured?.toLowerCase(),
      PUBLISHED_APP_ADDRESS.toLowerCase(),
      "a throwaway key must never be mistaken for the published one",
    );

    delete process.env.VANA_APP_PRIVATE_KEY;
    assert.equal(acceptedSigners().configured, null, "no key means nothing extra is accepted");
    assert.equal(acceptedSigners().canonical, PUBLISHED_APP_ADDRESS);
  } finally {
    if (saved) process.env.VANA_APP_PRIVATE_KEY = saved;
    else delete process.env.VANA_APP_PRIVATE_KEY;
  }
});
