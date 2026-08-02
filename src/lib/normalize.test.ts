import { test } from "node:test";
import assert from "node:assert/strict";
import { foldRead, normalizeGitHub, normalizeLinkedIn, identityOf } from "./normalize.ts";
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

test("LinkedIn profile normalizes connections strings and a vanity slug", () => {
  const raw = {
    scope: "linkedin.profile",
    data: {
      data: {
        items: [
          {
            profileUrl: "https://www.linkedin.com/in/jane-doe-42/",
            fullName: "Jane Doe",
            headline: "Builder",
            location: "Chennai",
            connections: "500+",
            profilePictureUrl: "https://example.com/a.jpg",
            about: "Hi",
          },
        ],
      },
    },
  };

  const profile = normalizeLinkedIn(raw);
  assert.equal(profile?.fullName, "Jane Doe");
  assert.equal(profile?.connections, 500);
  assert.equal(identityOf("linkedin.profile", raw), "jane-doe-42");

  const evidence = foldRead({}, "linkedin.profile", raw);
  assert.equal(evidence.linkedin?.connections, 500);
  assert.ok(scorePatina(evidence).sourcesConnected.includes("linkedin"));
});

/**
 * Instagram is now read as `instagram.posts` rather than `instagram.profile`,
 * because the profile carries no date and post timestamps feed Age and
 * Corroboration — 60 of the 100 points. These tests pin the shapes that must
 * keep working, since a silent miss here costs the user most of their score on
 * a read they already paid for.
 */
test("Instagram posts normalize from a named posts array", () => {
  const raw = {
    scope: "instagram.posts",
    data: {
      data: {
        items: [
          {
            username: "janedoe",
            posts: [
              { taken_at: "2014-03-02T10:00:00Z", num_of_likes: 12, caption: "one" },
              { taken_at: "2021-11-20T10:00:00Z", num_of_likes: 40 },
            ],
          },
        ],
      },
    },
  };

  const evidence = foldRead({}, "instagram.posts", raw);
  assert.equal(evidence.instagramPosts?.posts?.length, 2);
  assert.equal(identityOf("instagram.posts", raw), "janedoe");

  // Data minimisation: the raw read carried a caption and a like count, and
  // neither is scored, so neither must survive into what we store.
  const first = evidence.instagramPosts?.posts?.[0] as Record<string, unknown>;
  assert.ok(first.taken_at, "the timestamp is what we keep");
  assert.equal(first.num_of_likes, undefined, "like counts must not be retained");
  assert.equal(first.caption, undefined, "captions must not be retained");

  // The oldest post is what Age is built from.
  const score = scorePatina(evidence);
  assert.ok(score.sourcesConnected.includes("instagram"));
  assert.equal(new Date(score.oldestSignal!.date).getUTCFullYear(), 2014);
});

test("Instagram posts still normalize when the records ARE the envelope items", () => {
  const raw = {
    scope: "instagram.posts",
    data: {
      data: {
        items: [
          { taken_at: "2015-06-01T10:00:00Z", like_count: 3 },
          { taken_at: "2019-01-01T10:00:00Z", like_count: 9 },
        ],
      },
    },
  };

  const evidence = foldRead({}, "instagram.posts", raw);
  assert.equal(evidence.instagramPosts?.posts?.length, 2);
  assert.equal(new Date(scorePatina(evidence).oldestSignal!.date).getUTCFullYear(), 2015);
});

test("A posts read with no timestamps anywhere records nothing at all", () => {
  // Must stay undefined rather than claiming the slot: an empty Instagram
  // record would block a later, better read from filling it.
  const evidence = foldRead({}, "instagram.posts", {
    scope: "instagram.posts",
    data: { data: { items: [] } },
  });
  assert.equal(evidence.instagramPosts, undefined);
  assert.equal(scorePatina(evidence).sourcesConnected.length, 0);
});
