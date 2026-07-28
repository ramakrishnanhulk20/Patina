import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REFERRAL_QUALIFIES_AT,
  ensureProfile,
  evidenceOf,
  getProfile,
  newProfileId,
  profileIdForCode,
  profilesClaiming,
  recordSource,
  referralTally,
} from "./store.ts";

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
