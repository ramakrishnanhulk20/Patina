import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStory } from "./story.ts";
import { scorePatina, verdict } from "./score.ts";
import type { Evidence } from "./score.ts";

function story(evidence: Evidence) {
  const score = scorePatina(evidence);
  return buildStory(evidence, score, verdict(score));
}

test("the timeline is ordered earliest first, across sources", () => {
  const s = story({
    github: { createdAt: "2015-06-01T00:00:00Z", repositoryCount: 10 },
    youtube: { joinedDate: "2012-01-01T00:00:00Z", videoCount: 4 },
    instagramPosts: { posts: [{ taken_at: "2018-01-01T00:00:00Z" }, { taken_at: "2013-05-01T00:00:00Z" }] },
  });
  assert.deepEqual(
    s.timeline.map((t) => t.year),
    [2012, 2013, 2015],
    "youtube 2012, first insta post 2013, github 2015",
  );
  assert.equal(s.startYear, 2012);
  assert.match(s.origin ?? "", /YouTube/);
});

test("undated sources are still named, never dropped", () => {
  const s = story({
    spotify: { id: "x", followers: 20 },
    youtube: { joinedDate: "2014-01-01T00:00:00Z" },
  });
  assert.ok(s.alsoConnected.includes("Spotify"), "spotify has no date but is acknowledged");
  assert.equal(s.timeline.length, 1);
});

test("posts-by-year fills the quiet years so a gap reads as a gap", () => {
  const s = story({
    instagramPosts: {
      posts: [
        { taken_at: "2016-01-01T00:00:00Z" },
        { taken_at: "2016-02-01T00:00:00Z" },
        { taken_at: "2019-01-01T00:00:00Z" },
      ],
    },
  });
  assert.deepEqual(s.postsByYear, [
    { year: 2016, count: 2 },
    { year: 2017, count: 0 },
    { year: 2018, count: 0 },
    { year: 2019, count: 1 },
  ]);
});

test("a thin history yields a short story rather than throwing", () => {
  const s = story({ spotify: { id: "x" } });
  assert.equal(s.startYear, null);
  assert.equal(s.timeline.length, 0);
  assert.equal(s.made.total, 0);
  assert.equal(s.postsByYear, null);
  assert.equal(typeof s.score, "number");
});

test("a broken date does not become a year in the story", () => {
  const s = story({ youtube: { joinedDate: "not a date" }, github: { createdAt: "1000-01-01T00:00:00Z" } });
  assert.equal(s.timeline.length, 0, "an unparseable and an absurd date are both rejected");
});
