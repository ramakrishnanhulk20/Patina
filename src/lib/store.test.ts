import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimUsername,
  deleteProfile,
  ensureProfileId,
  evidenceOf,
  getProfile,
  profileForServer,
  profileForUsername,
  profileIdForAccount,
  recordSource,
  resolveProfileId,
  stats,
  usernameProblem,
} from "./store.ts";
import { readScope } from "./normalize.ts";
import type { Fragment } from "./normalize.ts";

/**
 * These run against the in-memory backend, which is the same code path Redis
 * takes minus the network. Every test uses its own session and server ids
 * because the backend is a module-level singleton, which is also true in
 * production and therefore worth testing against rather than around.
 */

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const iso = (yearsAgo: number) => new Date(Date.now() - yearsAgo * MS_PER_YEAR).toISOString();

let counter = 0;
const unique = (label: string) => `${label}-${(counter += 1)}-${Date.now()}`;

/** Usernames cap at 22 characters, so they need their own short generator. */
const uniqueName = (label: string) => `${label}-${(counter += 1)}-${Date.now() % 100000}`;

/**
 * Frozen at module load, so two calls describe the same read rather than two
 * reads a millisecond apart. A retry re-sends identical bytes; a fixture that
 * regenerates its dates every call would fail the idempotency test for a reason
 * that cannot happen in production.
 */
const GITHUB_PAYLOAD = {
  history: {
    pullRequests: [
      { id: "1", createdAt: iso(7), comments: 2 },
      { id: "2", createdAt: iso(3) },
    ],
  },
  profile: { followers: 44, organizations: [{ login: "o" }] },
} as const;

function githubReads(): Array<{ scope: string; fragment: Fragment }> {
  return [
    { scope: "github.history", fragment: readScope("github.history", GITHUB_PAYLOAD.history)! },
    { scope: "github.profile", fragment: readScope("github.profile", GITHUB_PAYLOAD.profile)! },
  ];
}

test("a session with no profile resolves to null rather than to itself", async () => {
  assert.equal(await resolveProfileId(unique("session")), null);
});

test("recording a source stores fragments per scope and caches the score", async () => {
  const profileId = await ensureProfileId(unique("session"));
  const profile = await recordSource(profileId, "github", githubReads(), { externalId: "ram" });

  assert.deepEqual(Object.keys(profile.fragments).sort(), ["github.history", "github.profile"]);
  assert.deepEqual(profile.sources.github?.scopes, ["github.history", "github.profile"]);
  assert.equal(profile.sources.github?.externalId, "ram");
  assert.ok(profile.score > 0, "a seven-year history should score something");

  // The cached score must match what the stored fragments actually produce.
  assert.ok(evidenceOf(profile).github?.months, "months survived the round trip");
});

test("recording the same source twice changes nothing", async () => {
  const profileId = await ensureProfileId(unique("session"));

  const first = await recordSource(profileId, "github", githubReads(), { externalId: "ram" });
  const second = await recordSource(profileId, "github", githubReads(), { externalId: "ram" });

  assert.equal(second.score, first.score, "a retry must not move the score");
  assert.deepEqual(second.fragments, first.fragments);
});

test("a partial read records only the scopes that came back", async () => {
  const profileId = await ensureProfileId(unique("session"));
  const profile = await recordSource(profileId, "github", [githubReads()[0]]);

  assert.deepEqual(profile.sources.github?.scopes, ["github.history"]);
  assert.ok(profile.score > 0, "three of four scopes is still a source");
});

test("a later read adds scopes without dropping the earlier ones", async () => {
  const profileId = await ensureProfileId(unique("session"));
  await recordSource(profileId, "github", [githubReads()[0]]);

  const steam = readScope("steam.profile", { accountCreated: iso(12) })!;
  const profile = await recordSource(profileId, "steam", [{ scope: "steam.profile", fragment: steam }]);

  assert.deepEqual(Object.keys(profile.sources).sort(), ["github", "steam"]);
  assert.equal(Object.keys(profile.fragments).length, 2);
});

// ---------------------------------------------------------------------------
// Identity. The same Vana account must be the same person on every machine.
// ---------------------------------------------------------------------------

test("the same Personal Server on a second browser finds the first profile", async () => {
  const server = `https://${unique("ps")}.vana.org`;

  const laptop = await profileForServer(unique("session"), server);
  await recordSource(laptop, "github", githubReads());

  const desktopSession = unique("session");
  const desktop = await profileForServer(desktopSession, server);

  assert.equal(desktop, laptop, "one Vana account is one Patina profile");
  assert.equal(await resolveProfileId(desktopSession), laptop, "the new browser is bound to it");
});

test("a different Personal Server is a different person", async () => {
  const a = await profileForServer(unique("session"), `https://${unique("ps")}.vana.org`);
  const b = await profileForServer(unique("session"), `https://${unique("ps")}.vana.org`);
  assert.notEqual(a, b);
});

test("the Personal Server URL itself is never stored", async () => {
  const server = "https://very-identifying-hostname.vana.org";
  const profileId = await profileForServer(unique("session"), server);
  await recordSource(profileId, "github", githubReads());

  const stored = JSON.stringify(await getProfile(profileId));
  assert.ok(!stored.includes("very-identifying-hostname"), "the server URL leaked into the profile");
  assert.match((await getProfile(profileId))!.serverHash!, /^[0-9a-f]{64}$/);
});

test("a browser that already had reads keeps them when its Personal Server is recognised", async () => {
  const server = `https://${unique("ps")}.vana.org`;

  // Established profile, anchored to the server, with GitHub on it.
  const anchored = await profileForServer(unique("session"), server);
  await recordSource(anchored, "github", githubReads());

  // A second browser that connected Steam before ever proving who it was.
  const strayS = unique("session");
  const stray = await ensureProfileId(strayS);
  const steam = readScope("steam.profile", { accountCreated: iso(14) })!;
  await recordSource(stray, "steam", [{ scope: "steam.profile", fragment: steam }]);

  const merged = await profileForServer(strayS, server);
  assert.equal(merged, anchored, "the stray browser folds into the proven profile");

  const profile = await getProfile(anchored);
  assert.deepEqual(Object.keys(profile!.sources).sort(), ["github", "steam"]);
  assert.equal(await getProfile(stray), null, "the stray profile is gone, not orphaned");
});

test("two profiles claiming the same account are recorded, not blocked", async () => {
  const first = await ensureProfileId(unique("session"));
  const second = await ensureProfileId(unique("session"));
  const handle = unique("gh-handle");

  await recordSource(first, "github", githubReads(), { externalId: handle });
  assert.equal(await profileIdForAccount("github", handle), first);

  // Somebody redoing their own profile on a new browser hits this too, so it
  // must not refuse them. It records who holds it now.
  await recordSource(second, "github", githubReads(), { externalId: handle });
  assert.equal(await profileIdForAccount("github", handle), second);
});

// ---------------------------------------------------------------------------
// Usernames
// ---------------------------------------------------------------------------

test("username rules reject the obviously bad", async () => {
  assert.ok(usernameProblem("ab"), "too short");
  assert.ok(usernameProblem("a".repeat(30)), "too long");
  assert.ok(usernameProblem("-leading"), "must start with a letter or number");
  assert.ok(usernameProblem("has space"), "no spaces");
  assert.ok(usernameProblem("admin"), "reserved");
  assert.equal(usernameProblem("ram-k20"), null);
});

test("a username can be claimed, resolved and re-claimed by its owner", async () => {
  const profileId = await ensureProfileId(unique("session"));
  await recordSource(profileId, "github", githubReads());
  const name = uniqueName("ram");

  assert.deepEqual(await claimUsername(profileId, name), { ok: true, username: name });
  assert.equal((await profileForUsername(name))?.id, profileId);
  // Claiming the same one again is a no-op, not an error.
  assert.deepEqual(await claimUsername(profileId, name), { ok: true, username: name });
});

test("two people cannot hold the same username", async () => {
  const first = await ensureProfileId(unique("session"));
  const second = await ensureProfileId(unique("session"));
  await recordSource(first, "github", githubReads());
  await recordSource(second, "github", githubReads());

  const name = uniqueName("contested");
  assert.equal((await claimUsername(first, name)).ok, true);

  const loser = await claimUsername(second, name);
  assert.equal(loser.ok, false);
  assert.match(loser.ok === false ? loser.error : "", /taken/i);
});

test("changing a username releases the old one", async () => {
  const profileId = await ensureProfileId(unique("session"));
  await recordSource(profileId, "github", githubReads());

  const first = uniqueName("before");
  const second = uniqueName("after");
  await claimUsername(profileId, first);
  await claimUsername(profileId, second);

  assert.equal(await profileForUsername(first), null, "the old name is free again");
  assert.equal((await profileForUsername(second))?.id, profileId);
});

test("a username cannot be claimed before anything is connected", async () => {
  const result = await claimUsername(await ensureProfileId(unique("session")), uniqueName("early"));
  assert.equal(result.ok, false);
});

// ---------------------------------------------------------------------------
// Counting. Patina could not answer "how many people use this" at all until
// the index existed, so these guard the number rather than the plumbing.
// ---------------------------------------------------------------------------

test("stats counts connected profiles, sources and names", async () => {
  const before = await stats();

  const a = await ensureProfileId(unique("session"));
  await recordSource(a, "github", githubReads());
  await recordSource(a, "steam", [
    { scope: "steam.profile", fragment: readScope("steam.profile", { accountCreated: iso(12) })! },
  ]);
  await claimUsername(a, uniqueName("counted"));

  const b = await ensureProfileId(unique("session"));
  await recordSource(b, "github", githubReads());

  const after = await stats();

  assert.equal(after.connected - before.connected, 2, "two people connected something");
  assert.equal(after.sources - before.sources, 3, "three sources between them");
  assert.equal(after.named - before.named, 1, "only one claimed a name");
  assert.equal((after.bySource.github ?? 0) - (before.bySource.github ?? 0), 2);
  assert.equal((after.bySource.steam ?? 0) - (before.bySource.steam ?? 0), 1);
  assert.ok(after.averageScore > 0, "an average is only meaningful once somebody scored");
});

test("a profile that connected nothing is not counted as a user", async () => {
  const before = await stats();
  // Created the moment a Personal Server is recognised, before any read.
  await profileForServer(unique("session"), `https://${unique("ps")}.vana.org`);
  const after = await stats();

  assert.equal(after.connected, before.connected, "an empty profile is not a user yet");
  assert.ok(after.profiles > before.profiles, "it does exist, and is counted as existing");
});

test("two browsers folding into one person count as one", async () => {
  const server = `https://${unique("ps")}.vana.org`;
  const before = await stats();

  const first = await profileForServer(unique("session"), server);
  await recordSource(first, "github", githubReads());

  // A second browser that connected on its own, then proved it was the same
  // Vana account. Counting it twice would inflate every number we quote.
  const straySession = unique("session");
  const stray = await ensureProfileId(straySession);
  await recordSource(stray, "steam", [
    { scope: "steam.profile", fragment: readScope("steam.profile", { accountCreated: iso(9) })! },
  ]);
  await profileForServer(straySession, server);

  const after = await stats();
  assert.equal(after.connected - before.connected, 1, "one human, one row");
});

test("deleting a profile removes it from the count", async () => {
  const sessionId = unique("session");
  const id = await ensureProfileId(sessionId);
  await recordSource(id, "github", githubReads());

  const before = await stats();
  await deleteProfile(id, sessionId);
  const after = await stats();

  // A deletion that left the number unchanged would make the erasure promise on
  // the privacy page quietly untrue.
  assert.equal(after.connected, before.connected - 1);
  assert.equal(after.profiles, before.profiles - 1);
});

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

test("deleting a profile clears its name, its server anchor and its accounts", async () => {
  const sessionId = unique("session");
  const server = `https://${unique("ps")}.vana.org`;
  const handle = unique("gh");
  const name = uniqueName("goodbye");

  const profileId = await profileForServer(sessionId, server);
  await recordSource(profileId, "github", githubReads(), { externalId: handle });
  await claimUsername(profileId, name);

  await deleteProfile(profileId, sessionId);

  assert.equal(await getProfile(profileId), null);
  assert.equal(await profileForUsername(name), null, "the name is released");
  assert.equal(await profileIdForAccount("github", handle), null, "the account link is gone");
  assert.equal(await resolveProfileId(sessionId), null, "the browser no longer points at it");

  // And the Personal Server no longer resolves to a profile that does not exist.
  const fresh = await profileForServer(unique("session"), server);
  assert.notEqual(fresh, profileId);
});
