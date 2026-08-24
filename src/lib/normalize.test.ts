import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_SCOPES,
  evidenceFrom,
  foldRead,
  identityOf,
  payloadFor,
  readScope,
  SCOPES_BY_SOURCE,
} from "./normalize.ts";
import { scorePatina, type Evidence } from "./score.ts";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const iso = (yearsAgo: number) => new Date(Date.now() - yearsAgo * MS_PER_YEAR).toISOString();

function fold(scope: string, payload: unknown, into: Evidence = {}): Evidence {
  return foldRead(into, scope, payload);
}

// ---------------------------------------------------------------------------
// Envelopes. Four shapes have been seen in the wild; all four must work, and an
// unrecognised fifth must be survivable rather than fatal.
// ---------------------------------------------------------------------------

test("envelope: reads a bare payload", () => {
  assert.deepEqual(payloadFor({ followers: 12 }, "github.profile"), { followers: 12 });
});

test("envelope: unwraps { data: x }", () => {
  assert.deepEqual(payloadFor({ data: { followers: 12 } }, "github.profile"), { followers: 12 });
});

test("envelope: unwraps { data: { data: { items: [x] } } }", () => {
  const raw = { data: { data: { items: [{ followers: 12 }] } } };
  assert.deepEqual(payloadFor(raw, "github.profile"), { followers: 12 });
});

test("envelope: prefers the scope-keyed connector format over a sibling data key", () => {
  const raw = {
    "github.profile": { followers: 99 },
    data: { followers: 1 },
    requestedScopes: ["github.profile"],
  };
  assert.deepEqual(payloadFor(raw, "github.profile"), { followers: 99 });
});

test("envelope: a top-level array survives, because steam.friends is one", () => {
  const raw = [{ steamId: "1", friendSince: iso(4) }];
  assert.ok(Array.isArray(payloadFor(raw, "steam.friends")));
});

// ---------------------------------------------------------------------------
// THE TRUST TEST.
//
// Every scope is requested for its timestamps. This asserts that the content
// riding along with them never reaches the output. If this test ever fails,
// Patina is storing something it told people it would not.
// ---------------------------------------------------------------------------

test("nothing sensitive survives normalisation", () => {
  const secrets = [
    "ram@example.com",
    "17 Nightingale Road",
    "Chennai Central",
    "my terrible caption",
    "sneaky_liker_92",
    "Half-Life 3",
    "Goldman Sachs",
    "Priya Ramanathan",
    "linkedin.com/in/priya-r",
    "Bohemian Rhapsody",
    "Wireless Earbuds",
    "Dosa Corner",
    "the body of my pull request",
  ];

  let evidence: Evidence = {};

  evidence = fold(
    "instagram.posts",
    {
      posts: [
        {
          taken_at: iso(6),
          caption: "my terrible caption",
          img_url: "https://cdn/x.jpg",
          num_of_likes: 40,
          who_liked: [{ username: "sneaky_liker_92", pk: "1", profile_pic_url: "https://x" }],
        },
      ],
    },
    evidence,
  );

  evidence = fold("youtube.profile", { email: "ram@example.com", joinedDate: iso(9) }, evidence);

  evidence = fold(
    "uber.trips",
    {
      trips: [
        {
          requestTime: iso(5),
          pickupAddress: "17 Nightingale Road",
          dropoffAddress: "Chennai Central",
          fare: "₹240",
        },
      ],
    },
    evidence,
  );

  evidence = fold(
    "linkedin.connections",
    {
      connections: [
        {
          fullName: "Priya Ramanathan",
          headline: "Engineer",
          profileUrl: "linkedin.com/in/priya-r",
          dateConnected: iso(7),
        },
      ],
    },
    evidence,
  );

  evidence = fold(
    "steam.games",
    { owned: [{ appId: 1, name: "Half-Life 3", playtimeMinutes: 900, lastPlayed: iso(2) }] },
    evidence,
  );

  evidence = fold(
    "linkedin.experience",
    { experiences: [{ jobTitle: "Analyst", companyName: "Goldman Sachs", dates: "2011 - 2015" }] },
    evidence,
  );

  evidence = fold(
    "spotify.savedTracks",
    { savedTracks: [{ added_at: iso(8), name: "Bohemian Rhapsody", artists: [{ name: "Queen" }] }] },
    evidence,
  );

  evidence = fold(
    "amazon.orders",
    { orders: [{ orderId: "1", orderDate: iso(10), items: ["Wireless Earbuds"] }] },
    evidence,
  );

  evidence = fold(
    "doordash.orders",
    { orders: [{ orderId: "1", date: iso(3), restaurant: "Dosa Corner" }] },
    evidence,
  );

  evidence = fold(
    "github.history",
    {
      pullRequests: [
        { id: "1", createdAt: iso(9), title: "fix", body: "the body of my pull request", repo: "a/b" },
      ],
    },
    evidence,
  );

  const stored = JSON.stringify(evidence);
  for (const secret of secrets) {
    assert.ok(!stored.includes(secret), `"${secret}" reached the store`);
  }

  // And the timestamps we DID want are all still there.
  assert.ok(evidence.instagram?.months, "instagram post months survived");
  assert.ok(evidence.uber?.months, "uber trip months survived");
  assert.ok(evidence.linkedin?.vouchMonths, "linkedin connection dates survived");
  assert.equal(evidence.youtube?.earliestLabel, "YouTube account opened");
});

test("instagram: who_liked is dropped even when there are hundreds of them", () => {
  const evidence = fold("instagram.posts", {
    posts: Array.from({ length: 30 }, (_, i) => ({
      taken_at: iso(5 - i * 0.1),
      who_liked: Array.from({ length: 50 }, (_, j) => ({ username: `liker_${i}_${j}` })),
    })),
  });
  assert.ok(!JSON.stringify(evidence).includes("liker_"), "third-party usernames leaked");
  assert.equal(evidence.instagram?.made?.[0].count, 30);
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

test("steam: a unix timestamp for account creation is not 1970", () => {
  const evidence = fold("steam.profile", { steamId: "76", timecreated: 1375315200 });
  assert.equal(new Date(evidence.steam!.earliest!).getUTCFullYear(), 2013);
});

test("dates: impossible ones are refused rather than scored", () => {
  const epoch = fold("youtube.profile", { joinedDate: "1970-01-01T00:00:00Z" });
  assert.equal(epoch.youtube?.earliest, undefined, "1970 is a parse failure, not an account");

  const future = fold("steam.profile", { accountCreated: iso(-5) });
  assert.equal(future.steam, undefined, "nothing has happened in five years' time");
});

test("linkedin: free-text date ranges yield the earliest year, marked soft", () => {
  const evidence = fold("linkedin.experience", {
    experiences: [
      { dates: "Jan 2019 - Present · 7 yrs" },
      { dates: "2011 - 2015" },
      { dates: "Mar 2015 - Dec 2018" },
    ],
  });
  assert.equal(new Date(evidence.linkedin!.earliest!).getUTCFullYear(), 2011);
  assert.equal(evidence.linkedin!.softDate, true, "typed history must be marked self-reported");
});

test("linkedin: a real date beats a self-reported one even when it is newer", () => {
  let evidence = fold("linkedin.experience", { experiences: [{ dates: "2005 - 2010" }] });
  evidence = fold("linkedin.connections", { connections: [{ dateConnected: iso(6) }] }, evidence);

  // Nothing hard has arrived for LinkedIn yet, so the soft date stands.
  assert.equal(evidence.linkedin?.softDate, true);

  // The scorer is where it gets discounted: a soft date alone earns no Age.
  assert.equal(scorePatina({ linkedin: evidence.linkedin }).components[0].points, 0);
});

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

test("linkedin: a connections count of \"500+\" is read as 500", () => {
  assert.equal(fold("linkedin.profile", { connections: "500+" }).linkedin?.followers, 500);
});

test("counts: \"12.5K\" and \"1,234\" are both read", () => {
  assert.equal(fold("spotify.profile", { followers: "12.5K" }).spotify?.followers, 12_500);
  assert.equal(fold("spotify.profile", { followers: "1,234" }).spotify?.followers, 1_234);
});

// ---------------------------------------------------------------------------
// Merging several scopes into one source
// ---------------------------------------------------------------------------

test("github: four scopes fold into one account", () => {
  let evidence: Evidence = {};
  evidence = fold("github.profile", { followers: 40, organizations: [{ login: "a" }], achievements: [{ name: "b" }] }, evidence);
  evidence = fold("github.repositories", { repositories: [{ name: "x" }, { name: "y" }] }, evidence);
  evidence = fold("github.history", { pullRequests: [{ id: "1", createdAt: iso(7), comments: 3, reactionsTotal: 2 }], issues: [{ id: "2", createdAt: iso(5) }] }, evidence);
  evidence = fold("github.contributions", { days: [{ date: iso(2), count: 4 }], yearTotals: [{ year: new Date().getUTCFullYear() - 8, total: 300 }] }, evidence);

  const github = evidence.github!;
  assert.equal(github.followers, 40);
  assert.equal(github.vouches, 2 + 5, "orgs and badges, plus comments and reactions received");
  assert.deepEqual(
    github.made?.map((k) => k.label),
    ["repos", "pull requests and issues"],
  );
  assert.equal(github.made?.reduce((n, k) => n + k.count, 0), 4);
  // yearTotals reaches back further than the history did, so it wins.
  assert.equal(new Date(github.earliest!).getUTCFullYear(), new Date().getUTCFullYear() - 8);
});

test("github: repositories contribute no months, because updatedAt is not a birthday", () => {
  const evidence = fold("github.repositories", {
    repositories: [{ name: "ancient-repo", updatedAt: iso(0.01) }],
  });
  assert.equal(evidence.github?.months, undefined);
});

test("instagram: the profile post count does not double up on the posts scope", () => {
  let evidence = fold("instagram.posts", {
    posts: [{ taken_at: iso(3) }, { taken_at: iso(2) }],
  });
  evidence = fold("instagram.profile", { media_count: 2, follower_count: 800 }, evidence);

  const total = evidence.instagram?.made?.reduce((n, k) => n + k.count, 0);
  assert.equal(total, 2, "two posts must not be counted as four");
  assert.equal(evidence.instagram?.followers, 800);
});

test("spotify: saved tracks and playlists both feed the same months", () => {
  let evidence = fold("spotify.savedTracks", {
    savedTracks: [{ added_at: "2019-03-04T00:00:00Z" }],
    total: 1,
  });
  evidence = fold(
    "spotify.playlists",
    { playlists: [{ name: "x", tracks: [{ added_at: "2019-03-19T00:00:00Z" }] }] },
    evidence,
  );

  assert.equal(evidence.spotify?.months?.["2019-03"], 2, "both saves land in the same month");
  assert.deepEqual(
    evidence.spotify?.made?.map((k) => k.label),
    ["saved tracks", "playlists"],
  );
});

// ---------------------------------------------------------------------------
// Vouches
// ---------------------------------------------------------------------------

test("steam.friends: a bare array of friends yields dated vouches", () => {
  const evidence = fold("steam.friends", [
    { steamId: "1", friendSince: "2016-05-02T00:00:00Z" },
    { steamId: "2", friendSince: "2016-05-20T00:00:00Z" },
    { steamId: "3", friendSince: null },
  ]);
  assert.equal(evidence.steam?.vouchMonths?.["2016-05"], 2);
});

test("connections with no usable dates record nothing rather than a bare count", () => {
  const evidence = fold("linkedin.connections", {
    connections: [{ fullName: "A" }, { fullName: "B" }],
  });
  assert.equal(evidence.linkedin, undefined, "an undated connection is not a vouch");
});

// ---------------------------------------------------------------------------
// Failure modes. None of these may throw, and none may claim a source slot.
// ---------------------------------------------------------------------------

test("an unknown scope is ignored", () => {
  assert.deepEqual(fold("tiktok.videos", { videos: [1, 2, 3] }), {});
});

test("empty and malformed payloads claim no source", () => {
  const cases: Array<[string, unknown]> = [
    ["instagram.posts", { posts: [] }],
    ["amazon.orders", { orders: [] }],
    ["steam.profile", {}],
    ["github.history", { pullRequests: [], issues: [] }],
    ["spotify.savedTracks", null],
    ["uber.trips", "not an object"],
    ["linkedin.education", { education: [{ years: "sometime in the past" }] }],
    ["youtube.profile", { email: "only@anemail.com" }],
  ];

  for (const [scope, payload] of cases) {
    assert.deepEqual(fold(scope, payload), {}, `${scope} should have recorded nothing`);
  }
});

test("every declared scope has a normaliser and survives junk without throwing", () => {
  for (const scope of ALL_SCOPES) {
    for (const junk of [null, undefined, 42, "text", [], {}, { data: { data: { items: [] } } }]) {
      assert.doesNotThrow(() => foldRead({}, scope, junk), `${scope} threw on ${String(junk)}`);
    }
  }
});

test("the manifest is 21 scopes across 10 sources", () => {
  assert.equal(ALL_SCOPES.length, 21);
  assert.equal(Object.keys(SCOPES_BY_SOURCE).length, 10);
  assert.deepEqual(SCOPES_BY_SOURCE.github, [
    "github.profile",
    "github.contributions",
    "github.history",
    "github.repositories",
  ]);
});

// ---------------------------------------------------------------------------
// Idempotency.
//
// Reads get retried: a network blip, a cold instance, somebody refreshing
// mid-settle. Storing fragments keyed by scope is what makes a retry land
// identically instead of adding the same months and vouches a second time.
// ---------------------------------------------------------------------------

test("re-reading every scope changes nothing", () => {
  const reads: Record<string, unknown> = {
    "github.contributions": { days: [{ date: iso(3), count: 5 }], yearTotals: [{ year: 2019, total: 90 }] },
    "github.history": { pullRequests: [{ id: "1", createdAt: iso(6), comments: 4 }] },
    "github.profile": { followers: 30, organizations: [{ login: "o" }] },
    "steam.friends": [{ friendSince: iso(5) }, { friendSince: iso(4) }],
    "steam.profile": { accountCreated: iso(11) },
    "spotify.savedTracks": { savedTracks: [{ added_at: iso(7) }], total: 1 },
    "instagram.posts": { posts: [{ taken_at: iso(4) }] },
    "instagram.profile": { media_count: 1, follower_count: 200 },
  };

  const once = Object.fromEntries(
    Object.entries(reads).map(([scope, raw]) => [scope, readScope(scope, raw)]),
  );

  // Every scope read a second time, as a retry would.
  const twice = Object.fromEntries(
    Object.entries(reads).map(([scope, raw]) => [scope, readScope(scope, raw)]),
  );

  const first = evidenceFrom(once);
  const second = evidenceFrom({ ...once, ...twice });

  assert.deepEqual(second, first, "a retry must not change the evidence");
  assert.equal(scorePatina(second).total, scorePatina(first).total);
});

test("the fold is deterministic regardless of the order sources were connected", () => {
  const reads: Record<string, unknown> = {
    "steam.profile": { accountCreated: iso(12) },
    "github.history": { pullRequests: [{ id: "1", createdAt: iso(8) }] },
    "spotify.savedTracks": { savedTracks: [{ added_at: iso(6) }], total: 1 },
  };

  const fragments = Object.fromEntries(
    Object.entries(reads).map(([scope, raw]) => [scope, readScope(scope, raw)]),
  );

  const forwards = evidenceFrom(fragments);
  const backwards = evidenceFrom(Object.fromEntries(Object.entries(fragments).reverse()));

  assert.deepEqual(backwards, forwards, "connection order must not change the score");
});

test("a failed re-read leaves the previous fragment intact", () => {
  const good = readScope("instagram.posts", { posts: [{ taken_at: iso(5) }, { taken_at: iso(4) }] });
  const failed = readScope("instagram.posts", { posts: [] });

  assert.ok(good);
  assert.equal(failed, undefined, "an empty re-read yields nothing to store");

  // The caller keeps what it had, so the person does not lose a source to a blip.
  const evidence = evidenceFrom({ "instagram.posts": failed ?? good });
  assert.equal(evidence.instagram?.made?.[0].count, 2);
});

// ---------------------------------------------------------------------------
// End to end
// ---------------------------------------------------------------------------

test("a realistic multi-source read produces a sensible score", () => {
  let evidence: Evidence = {};

  evidence = fold("github.contributions", {
    days: Array.from({ length: 400 }, (_, i) => ({ date: iso(9 - i * 0.02), count: 3 })),
    yearTotals: [{ year: new Date().getUTCFullYear() - 9, total: 500 }],
  }, evidence);
  evidence = fold("github.profile", { followers: 60, organizations: [{ login: "o" }] }, evidence);
  evidence = fold("steam.profile", { accountCreated: iso(14) }, evidence);
  evidence = fold("steam.friends", Array.from({ length: 40 }, (_, i) => ({ friendSince: iso(9 - i * 0.15) })), evidence);
  evidence = fold("spotify.savedTracks", {
    savedTracks: Array.from({ length: 600 }, (_, i) => ({ added_at: iso(8 - i * 0.012) })),
    total: 600,
  }, evidence);

  const score = scorePatina(evidence);

  assert.equal(score.sourcesConnected.length, 3);
  assert.equal(score.provisional, false, "three sources with dates is signable");
  assert.equal(score.oldestSignal?.source, "Steam account opened");
  assert.ok(score.total >= 60, `a real fourteen-year history should score well, got ${score.total}`);
});

test("identityOf finds a handle without inventing one", () => {
  assert.equal(identityOf("github.profile", { username: "ram" }), "ram");
  assert.equal(identityOf("steam.profile", { steamId: "7656119" }), "7656119");
  assert.equal(identityOf("amazon.orders", { orders: [] }), undefined);
});
