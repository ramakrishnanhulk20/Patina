import { test } from "node:test";
import assert from "node:assert/strict";
import { foldRead, normalizeGitHub } from "./normalize.ts";
import { scorePatina } from "./score.ts";

/**
 * Captured from a real paid read against Moksha on 28 July 2026, from a
 * throwaway GitHub account created five months earlier. Copied verbatim so this
 * test fails the moment Vana changes the shape underneath us.
 *
 * Note it does NOT match the schema published in data-connectors: the payload
 * is inside `items[]`, repos are `publicRepos` rather than `repositoryCount`,
 * and there is a `createdAt` the published schema never mentions.
 */
const REAL_GITHUB_READ = {
  scope: "github.profile",
  data: {
    version: "1.0",
    scope: "github.profile",
    collectedAt: "2026-07-28T11:14:25Z",
    data: {
      items: [
        {
          username: "rvasanthi160-bit",
          name: null,
          bio: null,
          location: null,
          company: null,
          websiteUrl: null,
          twitterUsername: null,
          socialAccounts: [],
          avatarUrl: "https://avatars.githubusercontent.com/u/263559170?v=4",
          profileUrl: "https://github.com/rvasanthi160-bit",
          email: null,
          followers: 0,
          following: 0,
          publicRepos: 0,
          publicGists: 0,
          totalStars: 0,
          totalForks: 0,
          hireable: null,
          accountType: "User",
          createdAt: "2026-02-24T06:55:47Z",
          updatedAt: "2026-02-24T06:55:47Z",
          scrapedAt: "2026-07-28T11:14:20.235684+00:00",
          error: null,
        },
      ],
    },
  },
  payment: {
    opType: "grant",
    opId: "0xe99cdc0db69d05da2464419e4dfef99f3a4242dfe89ebba7c2ad3c9c96ba9e8d",
    asset: "0x0000000000000000000000000000000000000000",
    amount: "11000000000000000",
    paymentNonce: "7667536866913511790444",
    breakdown: {
      registrationFee: "1000000000000000",
      dataAccessFee: "10000000000000000",
      registrationPaid: true,
    },
    paidAt: "2026-07-28T11:19:08.180Z",
  },
};

test("the real server-side payload is unwrapped from items[]", () => {
  const profile = normalizeGitHub(REAL_GITHUB_READ);

  assert.equal(profile?.username, "rvasanthi160-bit");
  assert.equal(profile?.createdAt, "2026-02-24T06:55:47Z");
  // publicRepos, not the published schema's repositoryCount.
  assert.equal(profile?.repositoryCount, 0);
  assert.equal(profile?.followers, 0);
});

test("a five-month-old throwaway account scores near the floor", () => {
  const evidence = foldRead({}, "github.profile", REAL_GITHUB_READ);
  const score = scorePatina(evidence);

  assert.ok(score.total < 12, `throwaway account scored ${score.total}, expected under 12`);
  assert.equal(score.oldestSignal?.source, "GitHub account opened");
  assert.ok(
    score.oldestSignal!.years < 1,
    `expected under a year of history, got ${score.oldestSignal?.years}`,
  );
});

test("GitHub account age is picked up as an age signal", () => {
  const old = foldRead({}, "github.profile", {
    scope: "github.profile",
    data: { data: { items: [{ username: "veteran", createdAt: "2011-03-04T00:00:00Z", publicRepos: 60 }] } },
  });

  const score = scorePatina(old);
  assert.ok(score.oldestSignal!.years > 14, `expected 14+ years, got ${score.oldestSignal?.years}`);
  assert.ok(score.total > 40, `a 2011 GitHub with 60 repos scored ${score.total}`);
});

test("the published desktop schema shape still works", () => {
  // Same scope, the OTHER shape. Both paths must normalize identically enough.
  const desktopShape = {
    scope: "github.profile",
    data: {
      data: {
        username: "desktopuser",
        repositoryCount: 12,
        followers: 30,
        organizations: [{ login: "org-a" }, { login: "org-b" }],
        achievements: [{ name: "Pull Shark" }],
      },
    },
  };

  const profile = normalizeGitHub(desktopShape);
  assert.equal(profile?.username, "desktopuser");
  assert.equal(profile?.repositoryCount, 12);
  assert.equal(profile?.organizations?.length, 2);
  assert.equal(profile?.achievements?.length, 1);
});

test("garbage in never throws", () => {
  for (const junk of [null, undefined, 42, "text", [], {}, { data: null }, { data: { data: [] } }]) {
    assert.doesNotThrow(() => normalizeGitHub(junk));
    assert.doesNotThrow(() => scorePatina(foldRead({}, "github.profile", junk)));
  }
});

test("an unknown scope is ignored rather than corrupting evidence", () => {
  const before = { github: { username: "keep" } };
  const after = foldRead(before, "tiktok.something", { data: { data: {} } });
  assert.deepEqual(after, before);
});
