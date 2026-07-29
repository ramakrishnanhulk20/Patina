import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFERRAL_QUALIFIES_AT,
  ensureProfile,
  evidenceOf,
  getProfile,
  isPersistent,
  adoptProfile,
  claimProfile,
  setUsername,
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
 * The bug this layer exists to kill: one person connecting on a phone and a
 * laptop became two profiles with two partial scores, two rows in the standings,
 * and two claims on a single reward share.
 */
test("one person on two devices ends up as one profile", async () => {
  const phone = newProfileId();
  const laptop = newProfileId();

  await recordSource(phone, "youtube", {
    scope: "youtube.profile",
    readAt: "2026-07-01T00:00:00Z",
    externalId: "chan",
    evidence: { youtube: { joinedDate: "2012-04-01T00:00:00Z", videoCount: 9 } },
  }, 40);

  // The laptop connects something of its own before the two are joined up.
  await recordSource(laptop, "github", record("dev", "2013-01-01T00:00:00Z"), 30);

  const phoneProfile = await getProfile(phone);
  const adopted = await adoptProfile(laptop, phoneProfile!.deviceToken, () => 66);

  assert.ok(adopted, "a valid token must adopt the profile");
  assert.equal(await resolveProfileId(laptop), phone, "both devices now point at one profile");

  const merged = await getProfile(phone);
  assert.ok(merged!.sources.youtube, "the phone's source survived");
  assert.ok(merged!.sources.github, "the laptop's source came across");

  const evidence = evidenceOf(merged!);
  assert.equal(evidence.youtube?.joinedDate, "2012-04-01T00:00:00Z");
  assert.equal(evidence.github?.username, "dev");
});

test("adopting leaves exactly one row in the standings, not two", async () => {
  const first = newProfileId();
  const second = newProfileId();

  await recordSource(first, "github", record("keeper", "2011-01-01T00:00:00Z"), 70);
  await recordSource(second, "youtube", {
    scope: "youtube.profile",
    readAt: "2026-07-02T00:00:00Z",
    externalId: "c2",
    evidence: { youtube: { joinedDate: "2015-01-01T00:00:00Z" } },
  }, 25);

  const target = await getProfile(first);
  await adoptProfile(second, target!.deviceToken, () => 75);

  const board = await topProfiles(1000);
  assert.ok(board.some((r) => r.id === first), "the adopted profile stays ranked");
  assert.ok(
    !board.some((r) => r.id === second),
    "the absorbed profile must leave the standings entirely",
  );
});

test("a referral link shared from the absorbed device keeps working", async () => {
  const keep = newProfileId();
  const absorbed = newProfileId();

  await recordSource(keep, "github", record("a", "2012-01-01T00:00:00Z"), 50);
  const shared = (await ensureProfile(absorbed)).referralCode;

  const target = await getProfile(keep);
  await adoptProfile(absorbed, target!.deviceToken, () => 50);

  assert.equal(await profileIdForCode(shared), keep, "an already-shared code must still resolve");
});

test("a wrong or stale device token does nothing at all", async () => {
  const session = newProfileId();
  await recordSource(session, "github", record("mine", "2012-01-01T00:00:00Z"), 44);

  const result = await adoptProfile(session, "0".repeat(48), () => 44);

  assert.equal(result, null, "an unknown token must not adopt or create anything");
  assert.equal(await resolveProfileId(session), session, "the session keeps its own profile");
  const still = await getProfile(session);
  assert.equal(still?.sources.github?.externalId, "mine");
});

test("a device token is long enough not to be guessed", async () => {
  const profile = await ensureProfile(newProfileId());
  assert.match(profile.deviceToken, /^[0-9a-f]{48}$/);
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


/**
 * Signing in is what makes one person one row. Google's `sub` is identical on a
 * phone and a laptop, which is the property nothing else in this stack offered.
 */
test("signing in on a second device merges into one profile", async () => {
  const identity = "g:1234567890";
  const phone = newProfileId();
  const laptop = newProfileId();

  await recordSource(phone, "youtube", {
    scope: "youtube.profile",
    readAt: "2026-07-01T00:00:00Z",
    externalId: "chan",
    evidence: { youtube: { joinedDate: "2012-04-01T00:00:00Z" } },
  }, 40);
  await claimProfile(phone, identity, () => 40);

  await recordSource(laptop, "github", record("dev", "2013-01-01T00:00:00Z"), 30);
  await claimProfile(laptop, identity, () => 70);

  assert.equal(await resolveProfileId(phone), identity);
  assert.equal(await resolveProfileId(laptop), identity);

  const merged = await getProfile(identity);
  assert.ok(merged?.sources.youtube, "the phone's source survived");
  assert.ok(merged?.sources.github, "the laptop's source came across");

  const board = await topProfiles(1000);
  assert.ok(!board.some((r) => r.id === phone), "the phone's old profile leaves the standings");
  assert.ok(!board.some((r) => r.id === laptop), "so does the laptop's");
  assert.equal(board.filter((r) => r.id === identity).length, 1, "exactly one row remains");
});

test("a username is claimed first come, first served", async () => {
  const a = newProfileId();
  const b = newProfileId();
  await recordSource(a, "github", record("ua", "2012-01-01T00:00:00Z"), 40);
  await recordSource(b, "github", record("ub", "2012-01-01T00:00:00Z"), 40);

  assert.deepEqual(await setUsername(a, "ramkumar"), { ok: true, username: "ramkumar" });

  const taken = await setUsername(b, "RamKumar");
  assert.equal(taken.ok, false, "the same name in different case is still taken");

  assert.equal((await getProfile(a))?.username, "ramkumar");
  assert.equal((await getProfile(b))?.username, undefined);
});

test("bad usernames are refused with a reason a person can act on", async () => {
  const id = newProfileId();
  await recordSource(id, "github", record("uu", "2012-01-01T00:00:00Z"), 40);

  for (const bad of ["ab", "a".repeat(21), "has space", "semi;colon", "sla/sh"]) {
    const result = await setUsername(id, bad);
    assert.equal(result.ok, false, `"${bad}" should be refused`);
    assert.ok("reason" in result && result.reason.length > 0, "and say why");
  }
});

test("renaming frees the old name for somebody else", async () => {
  const a = newProfileId();
  const b = newProfileId();
  await recordSource(a, "github", record("ra", "2012-01-01T00:00:00Z"), 40);
  await recordSource(b, "github", record("rb", "2012-01-01T00:00:00Z"), 40);

  await setUsername(a, "firstpick");
  await setUsername(a, "secondpick");

  const reused = await setUsername(b, "firstpick");
  assert.equal(reused.ok, true, "an abandoned name must not be held forever");
});
