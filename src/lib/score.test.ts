import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePatina, type Evidence } from "./score.ts";

const YEAR = 365.25 * 24 * 60 * 60 * 1000;
const ago = (years: number) => new Date(Date.now() - years * YEAR).toISOString();

/** Someone who has simply been alive on the internet for a while. */
const realPerson: Evidence = {
  youtube: { joinedDate: ago(11), videoCount: 4, subscriberCount: 38 },
  instagram: {
    username: "someone",
    follower_count: 420,
    media_count: 96,
    is_private: false,
  },
  instagramPosts: {
    // 96 posts scattered across nine years, the way a life actually looks.
    posts: Array.from({ length: 96 }, (_, i) => ({
      taken_at: ago(9 - (i / 96) * 9),
      num_of_likes: 20 + (i % 30),
    })),
  },
  github: { username: "someone", followers: 24, repositoryCount: 17, organizations: [{ login: "a-co" }] },
};

/**
 * The attack we exist to stop: an account farm. Fresh accounts, bulk-followed,
 * every post uploaded in one sitting. Superficially busy, no time behind it.
 */
const farmedAccount: Evidence = {
  youtube: { joinedDate: ago(0.05), videoCount: 0, subscriberCount: 0 },
  instagram: {
    username: "user883021",
    follower_count: 3000, // bought
    media_count: 120, // bulk uploaded
    is_private: false,
  },
  instagramPosts: {
    // 120 posts, all dumped inside the same fortnight.
    posts: Array.from({ length: 120 }, (_, i) => ({
      taken_at: ago(0.03 + (i / 120) * 0.01),
      num_of_likes: 500,
    })),
  },
  github: { username: "user883021", followers: 900, repositoryCount: 40 },
};

test("a real history scores far above a farmed one", () => {
  const real = scorePatina(realPerson);
  const farm = scorePatina(farmedAccount);

  assert.ok(
    real.total >= farm.total * 2,
    `real ${real.total} should at least double farmed ${farm.total}`,
  );
});

test("buying followers and bulk-posting cannot carry a farmed account", () => {
  const farm = scorePatina(farmedAccount);
  assert.ok(farm.total < 30, `farmed account scored ${farm.total}, expected under 30`);
});

test("age comes from the oldest provable date across every source", () => {
  const score = scorePatina(realPerson);
  assert.equal(score.oldestSignal?.source, "YouTube account opened");
  assert.ok(score.oldestSignal!.years > 10);
});

test("continuity counts distinct months, not post volume", () => {
  const burst = scorePatina({
    instagramPosts: {
      posts: Array.from({ length: 400 }, () => ({ taken_at: ago(0.01) })),
    },
  });
  const spread = scorePatina({
    instagramPosts: {
      posts: Array.from({ length: 40 }, (_, i) => ({ taken_at: ago((i / 40) * 6) })),
    },
  });

  const of = (s: ReturnType<typeof scorePatina>) =>
    s.components.find((c) => c.key === "continuity")!.points;

  assert.ok(
    of(spread) > of(burst) * 3,
    `40 posts over 6 years (${of(spread)}) should beat 400 in one day (${of(burst)})`,
  );
});

test("breadth rewards independent corroboration, but only with history behind it", () => {
  const of = (s: ReturnType<typeof scorePatina>) =>
    s.components.find((c) => c.key === "breadth")!.points;

  // Three sources with a decade of history behind them earn nearly full credit.
  assert.ok(of(scorePatina(realPerson)) > 8, `real person breadth was ${of(scorePatina(realPerson))}`);

  // Three sources opened last week earn almost none, which is the whole point:
  // an attacker can manufacture breadth in an afternoon but not the time under it.
  assert.ok(of(scorePatina(farmedAccount)) < 2, `farm breadth was ${of(scorePatina(farmedAccount))}`);

  // And more sources still beats fewer, all else equal.
  const oneSource = scorePatina({ spotify: { id: "x", display_name: "x" } });
  assert.ok(of(realPerson === null ? oneSource : scorePatina(realPerson)) > of(oneSource));
});

test("a genuinely young person is not treated as a fraud", () => {
  const young = scorePatina({
    youtube: { joinedDate: ago(3), videoCount: 1 },
    instagram: { media_count: 30 },
    instagramPosts: {
      posts: Array.from({ length: 30 }, (_, i) => ({ taken_at: ago(2.5 - (i / 30) * 2.5) })),
    },
  });
  const farm = scorePatina(farmedAccount);

  assert.ok(young.total > 20, `young real person scored ${young.total}, expected above 20`);
  assert.ok(
    young.total > farm.total * 3,
    `young real ${young.total} should clearly beat farm ${farm.total}`,
  );
});

test("an empty vault scores zero rather than throwing", () => {
  const score = scorePatina({});
  assert.equal(score.total, 0);
  assert.equal(score.oldestSignal, null);
  assert.equal(score.sourcesConnected.length, 0);
});

test("missing optional fields never crash the scorer", () => {
  const score = scorePatina({
    youtube: { joinedDate: null, subscriberCount: null, videoCount: null },
    instagram: { username: "a" },
    instagramPosts: { posts: [{}, { taken_at: "not a date" }] },
    github: { username: "a" },
  });
  assert.ok(Number.isFinite(score.total));
});
