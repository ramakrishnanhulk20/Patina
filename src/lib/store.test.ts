import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFERRAL_QUALIFIES_AT,
  ensureProfile,
  evidenceOf,
  getProfile,
  isPersistent,
  linkSessionToWallet,
  newProfileId,
  resolveProfileId,
  profileIdForCode,
  profilesClaiming,
  recordSource,
  referralTally,
  scoredProfileCount,
  standingOf,
  topProfiles,
} from "./store.ts";

/**
 * Vercel's Upstash integration and Upstash's own SDK name the SAME credentials
 * differently. Reading only one pair means the app boots fine, silently falls
 * back to memory, and loses every profile on the next cold start. This is the
 * regression test for that, because the failure is invisible without one.
 */
test("Redis credentials are recognised under either naming convention", () => {
  const saved = {
    u: process.env.UPSTASH_REDIS_REST_URL,
    t: process.env.UPSTASH_REDIS_REST_TOKEN,
    ku: process.env.KV_REST_API_URL,
    kt: process.env.KV_REST_API_TOKEN,
  };

  const clear = () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  };

  try {
    clear();
    assert.equal(isPersistent(), false, "no credentials means no persistence");

    clear();
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    assert.equal(isPersistent(), true, "Upstash's own variable names must work");

    clear();
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    process.env.KV_REST_API_TOKEN = "token";
    assert.equal(isPersistent(), true, "Vercel integration's KV_ names must work");

    clear();
    process.env.KV_REST_API_URL = "https://example.upstash.io";
    assert.equal(isPersistent(), false, "a URL with no token is not usable");
  } finally {
    clear();
    if (saved.u) process.env.UPSTASH_REDIS_REST_URL = saved.u;
    if (saved.t) process.env.UPSTASH_REDIS_REST_TOKEN = saved.t;
    if (saved.ku) process.env.KV_REST_API_URL = saved.ku;
    if (saved.kt) process.env.KV_REST_API_TOKEN = saved.kt;
  }
});

/**
 * These run against the in-memory backend (no Redis env vars in test), which is
 * the same code path production uses via the same interface.
 */

const record = (username: string, createdAt: string) => ({
  scope: "github.profile",
  readAt: new Date().toISOString(),
  externalId: username,
  evidence: { github: { username, createdAt, repositoryCount: 10 } },
});

test("a profile gets one stable referral code, resolvable back to the profile", async () => {
  const id = newProfileId();
  const first = await ensureProfile(id);
  const second = await ensureProfile(id);

  assert.equal(first.referralCode, second.referralCode);
  assert.match(first.referralCode, /^[a-z2-9]{7}$/);
  assert.equal(await profileIdForCode(first.referralCode), id);
});

test("a referrer is credited only once the invited person clears the bar", async () => {
  const referrer = await ensureProfile(newProfileId());
  const code = referrer.referralCode;

  const weakId = newProfileId();
  await ensureProfile(weakId, code);
  await recordSource(weakId, "github", record("throwaway", "2026-06-01T00:00:00Z"), 4, code);

  let tally = await referralTally(code);
  assert.equal(tally.invited, 1, "the visit still counts as an invite");
  assert.equal(tally.qualified, 0, "but a score of 4 earns the referrer nothing");

  const realId = newProfileId();
  await ensureProfile(realId, code);
  await recordSource(
    realId,
    "github",
    record("veteran", "2012-01-01T00:00:00Z"),
    REFERRAL_QUALIFIES_AT + 25,
    code,
  );

  tally = await referralTally(code);
  assert.equal(tally.invited, 2);
  assert.equal(tally.qualified, 1);
});

test("crossing the bar twice cannot inflate a tally", async () => {
  const referrer = await ensureProfile(newProfileId());
  const code = referrer.referralCode;

  const id = newProfileId();
  await ensureProfile(id, code);

  await recordSource(id, "github", record("a", "2012-01-01T00:00:00Z"), 55, code);
  await recordSource(id, "youtube", record("a", "2012-01-01T00:00:00Z"), 70, code);
  await recordSource(id, "spotify", record("a", "2012-01-01T00:00:00Z"), 78, code);

  const tally = await referralTally(code);
  assert.equal(tally.qualified, 1, "three sources from one person is still one person");
});

test("the referrer on a profile is set once and never rewritten", async () => {
  const first = await ensureProfile(newProfileId());
  const second = await ensureProfile(newProfileId());

  const id = newProfileId();
  await ensureProfile(id, first.referralCode);
  // A second visit carrying a different code must not steal the credit.
  await ensureProfile(id, second.referralCode);

  const profile = await getProfile(id);
  assert.equal(profile?.referredBy, first.referralCode);
});

test("the same underlying account is traceable across separate sessions", async () => {
  const a = newProfileId();
  const b = newProfileId();

  await recordSource(a, "github", record("samehuman", "2013-01-01T00:00:00Z"), 50);
  await recordSource(b, "github", record("SameHuman", "2013-01-01T00:00:00Z"), 50);

  const claimants = await profilesClaiming("github", "samehuman");
  assert.equal(claimants.length, 2, "clearing cookies does not create a second person");
  assert.ok(claimants.includes(a) && claimants.includes(b));
});

test("scored profiles are rankable, which the reward promise depends on", async () => {
  const before = await scoredProfileCount();

  const low = newProfileId();
  const mid = newProfileId();
  const high = newProfileId();

  await recordSource(low, "github", record("low", "2025-01-01T00:00:00Z"), 11);
  await recordSource(high, "github", record("high", "2011-01-01T00:00:00Z"), 81);
  await recordSource(mid, "github", record("mid", "2018-01-01T00:00:00Z"), 44);

  assert.equal(await scoredProfileCount(), before + 3);

  const top = await topProfiles(500);
  const positions = [low, mid, high].map((id) => top.findIndex((row) => row.id === id));
  assert.ok(positions.every((p) => p !== -1), "every scoring profile must appear in the ranking");

  const [pLow, pMid, pHigh] = positions;
  assert.ok(pHigh < pMid && pMid < pLow, "ranking must be highest score first");

  const standing = await standingOf(high, 50);
  assert.ok(standing.rank !== null && standing.rank >= 1);
  assert.equal(standing.inTheMoney, true);
});

test("a rescored profile moves in the ranking rather than duplicating", async () => {
  const id = newProfileId();

  await recordSource(id, "github", record("climber", "2012-01-01T00:00:00Z"), 30);
  await recordSource(id, "youtube", {
    scope: "youtube.profile",
    readAt: new Date().toISOString(),
    externalId: "climber",
    evidence: { youtube: { joinedDate: "2010-01-01T00:00:00Z" } },
  }, 72);

  const top = await topProfiles(500);
  const mine = top.filter((row) => row.id === id);

  assert.equal(mine.length, 1, "one profile must occupy exactly one place");
  assert.equal(mine[0].score, 72, "the ranking must hold the latest score");
});

/**
 * The bug this whole layer exists to kill: one person connecting on a phone and
 * a laptop used to become two profiles with two partial scores, two rows in the
 * ranking, and two claims on one reward share.
 */
test("one person on two devices ends up as one profile", async () => {
  const wallet = "0xAbC0000000000000000000000000000000000001";
  const phone = newProfileId();
  const laptop = newProfileId();

  // Phone: connects YouTube, then signs in.
  await recordSource(phone, "youtube", {
    scope: "youtube.profile",
    readAt: "2026-07-01T00:00:00Z",
    externalId: "chan",
    evidence: { youtube: { joinedDate: "2012-04-01T00:00:00Z", videoCount: 9 } },
  }, 40);
  await linkSessionToWallet(phone, wallet, () => 40);

  // Laptop: different browser, same human, signs in and connects GitHub.
  await linkSessionToWallet(laptop, wallet, () => 40);
  const laptopProfileId = await resolveProfileId(laptop);
  await recordSource(laptopProfileId, "github", record("dev", "2013-01-01T00:00:00Z"), 66);

  // Both browsers must now resolve to the same profile.
  assert.equal(await resolveProfileId(phone), await resolveProfileId(laptop));

  const merged = await getProfile(await resolveProfileId(phone));
  assert.ok(merged, "the merged profile must exist");
  assert.ok(merged!.sources.youtube, "the phone's source survived the merge");
  assert.ok(merged!.sources.github, "the laptop's source is there too");

  const evidence = evidenceOf(merged!);
  assert.equal(evidence.youtube?.joinedDate, "2012-04-01T00:00:00Z");
  assert.equal(evidence.github?.username, "dev");
});

test("merging leaves exactly one row in the standings, not two", async () => {
  const wallet = "0xAbC0000000000000000000000000000000000002";
  const phone = newProfileId();

  await recordSource(phone, "github", record("solo", "2014-01-01T00:00:00Z"), 35);
  const before = await topProfiles(1000);
  assert.ok(before.some((r) => r.id === phone), "the anonymous profile is ranked first time round");

  await linkSessionToWallet(phone, wallet, () => 35);

  const after = await topProfiles(1000);
  assert.ok(
    !after.some((r) => r.id === phone),
    "the orphaned cookie profile must leave the standings",
  );
  assert.ok(
    after.some((r) => r.id === wallet.toLowerCase()),
    "the wallet profile takes its place",
  );
});

test("a referral link shared before signing in keeps working afterwards", async () => {
  const wallet = "0xAbC0000000000000000000000000000000000003";
  const session = newProfileId();

  const anon = await ensureProfile(session);
  const sharedCode = anon.referralCode;

  await linkSessionToWallet(session, wallet, () => 0);

  const owner = await profileIdForCode(sharedCode);
  assert.equal(owner, wallet.toLowerCase(), "the code someone already shared must still resolve");
});

test("signing in on a device that never connected anything loses nothing", async () => {
  const wallet = "0xAbC0000000000000000000000000000000000004";
  const first = newProfileId();
  const fresh = newProfileId();

  await recordSource(first, "github", record("keeper", "2011-01-01T00:00:00Z"), 70);
  await linkSessionToWallet(first, wallet, () => 70);

  // A brand new browser signs in to the same wallet and must not wipe anything.
  await linkSessionToWallet(fresh, wallet, () => 70);

  const profile = await getProfile(wallet.toLowerCase());
  assert.equal(profile?.sources.github?.externalId, "keeper");
  assert.equal(Object.keys(profile!.sources).length, 1);
});

test("evidence from every source is merged for scoring", async () => {
  const id = newProfileId();

  await recordSource(id, "github", record("dev", "2012-01-01T00:00:00Z"), 40);
  await recordSource(id, "youtube", {
    scope: "youtube.profile",
    readAt: new Date().toISOString(),
    externalId: "chan",
    evidence: { youtube: { joinedDate: "2011-05-02T00:00:00Z", videoCount: 12 } },
  }, 60);

  const profile = await getProfile(id);
  const evidence = evidenceOf(profile!);

  // A grant only ever covers the latest source, so the earlier one has to
  // survive in storage or the score silently collapses on the second connect.
  assert.equal(evidence.github?.username, "dev");
  assert.equal(evidence.youtube?.joinedDate, "2011-05-02T00:00:00Z");
});
