import { test } from "node:test";
import assert from "node:assert/strict";
import { buildExhibits, buildStory, exhibitFacts, storyLine } from "./story.ts";
import { scorePatina, type Evidence, type Months } from "./score.ts";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const iso = (yearsAgo: number) => new Date(Date.now() - yearsAgo * MS_PER_YEAR).toISOString();
const year = (yearsAgo: number) => new Date(Date.now() - yearsAgo * MS_PER_YEAR).getUTCFullYear();

function monthsAgo(fromYears: number, toYears: number, perMonth: number): Months {
  const months: Months = {};
  const start = new Date(Date.now() - fromYears * MS_PER_YEAR);
  const end = new Date(Date.now() - toYears * MS_PER_YEAR);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    months[`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`] =
      perMonth;
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return months;
}

function story(evidence: Evidence) {
  return buildStory(evidence, scorePatina(evidence));
}

const LIVED: Evidence = {
  youtube: {
    earliest: iso(13),
    earliestLabel: "YouTube account opened",
    made: [{ count: 90, label: "videos" }],
  },
  github: {
    earliest: iso(9),
    earliestLabel: "first GitHub contribution",
    months: monthsAgo(9, 0, 6),
    made: [{ count: 40, label: "repos" }],
    followers: 120,
  },
  linkedin: {
    earliest: iso(15),
    earliestLabel: "LinkedIn work history",
    softDate: true,
    vouchMonths: monthsAgo(8, 1, 3),
    followers: 500,
  },
  spotify: { made: [{ count: 800, label: "saved tracks" }], months: monthsAgo(6, 0, 10) },
};

test("the timeline is every dated source, earliest first", () => {
  const s = story(LIVED);
  assert.deepEqual(
    s.timeline.map((entry) => entry.source),
    ["linkedin", "youtube", "github"],
  );
  assert.equal(s.timeline[0].soft, true, "the LinkedIn date is self-reported and says so");
  assert.equal(s.timeline[1].soft, false);
});

test("undated sources are listed separately rather than dropped", () => {
  assert.deepEqual(story(LIVED).alsoConnected, ["Spotify"]);
});

test("the origin names the oldest MACHINE-generated date, not the typed one", () => {
  const s = story(LIVED);
  // LinkedIn reaches back further but is self-reported, so YouTube is the origin.
  assert.match(s.origin!, /YouTube account opened/);
  assert.equal(s.startYear, year(13));
});

test("activity is gap-filled, so the quiet years show as quiet", () => {
  const s = story({
    github: {
      earliest: iso(8),
      earliestLabel: "first GitHub contribution",
      months: { ...monthsAgo(8, 7, 5), ...monthsAgo(2, 0, 5) },
    },
  });

  const years = s.activityByYear.map((entry) => entry.year);
  // No gaps in the year axis itself.
  for (let i = 1; i < years.length; i += 1) {
    assert.equal(years[i], years[i - 1] + 1, "the year axis must be continuous");
  }
  assert.ok(
    s.activityByYear.some((entry) => entry.count === 0),
    "the years they were away must appear as zero, not vanish",
  );
});

test("activity comes from every source at once, not just one", () => {
  const s = story(LIVED);
  const total = s.activityByYear.reduce((sum, entry) => sum + entry.count, 0);
  const githubOnly = story({ github: LIVED.github }).activityByYear.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  assert.ok(total > githubOnly, "Spotify's months must be in there too");
  assert.ok(s.activeMonths > 100, `nine years of activity is a lot of months, got ${s.activeMonths}`);
});

test("vouches are counted by the year they happened", () => {
  const s = story(LIVED);
  assert.ok(s.vouchTotal > 0);
  assert.ok(s.vouchesByYear.length >= 7, "eight years of connections spans several years");
});

test("things made keep their labels", () => {
  const s = story(LIVED);
  assert.deepEqual(s.made.map((kind) => kind.label).sort(), ["repos", "saved tracks", "videos"]);
  assert.equal(s.madeTotal, 90 + 40 + 800);
});

test("the strongest component is measured against its own maximum", () => {
  const s = story(LIVED);
  // Not simply Age because Age is the biggest row: it is whichever component
  // earned the largest share of what it could.
  assert.ok(s.strongest);
  assert.ok(s.strongest!.points <= s.strongest!.max);
});

// ---------------------------------------------------------------------------
// Thin histories. The copy has to work for these or the product reads as a
// judgement rather than as a measurement.
// ---------------------------------------------------------------------------

test("an empty profile yields a short story, not an error", () => {
  const s = story({});
  assert.equal(s.startYear, null);
  assert.deepEqual(s.timeline, []);
  assert.deepEqual(s.activityByYear, []);
  assert.equal(s.provisional, true);
  assert.equal(storyLine(s), "Nothing connected yet.");
});

test("a one-year, one-account history gets a sentence worth posting", () => {
  const s = story({
    github: {
      earliest: iso(1.2),
      earliestLabel: "first GitHub contribution",
      months: monthsAgo(1.2, 0, 4),
      made: [{ count: 6, label: "repos" }],
    },
  });

  const line = storyLine(s);
  assert.match(line, /1 year/);
  assert.match(line, /one account/);
  assert.doesNotMatch(line, /only|just|merely|unfortunately/i);
});

test("the share line names the number and the span", () => {
  const line = storyLine(story(LIVED));
  assert.match(line, /13 years of provable history/);
  assert.match(line, /4 accounts/);
  assert.match(line, /Patina \d+\./);
});

// ---------------------------------------------------------------------------
// Exhibits, the per-source facts the connect board draws on each card
// ---------------------------------------------------------------------------

test("an exhibit carries its own year, not the profile's oldest", () => {
  const exhibits = buildExhibits(LIVED);
  const github = exhibits.find((e) => e.source === "github")!;
  const youtube = exhibits.find((e) => e.source === "youtube")!;

  assert.equal(youtube.year, year(13));
  assert.equal(github.year, year(9), "GitHub shows its own date, not YouTube's");
});

test("an exhibit label drops the source name the heading already says", () => {
  const youtube = buildExhibits(LIVED).find((e) => e.source === "youtube")!;
  assert.equal(youtube.yearLabel, "account opened", "not 'YouTube account opened'");
});

test("a self-reported date is marked on the exhibit", () => {
  const linkedin = buildExhibits(LIVED).find((e) => e.source === "linkedin")!;
  assert.equal(linkedin.soft, true);
});

test("a source with no date still becomes an exhibit", () => {
  const spotify = buildExhibits(LIVED).find((e) => e.source === "spotify")!;
  assert.equal(spotify.year, null);
  assert.ok(spotify.activeMonths > 0, "it has months even without an opening date");
});

test("exhibit facts lead with vouches, then months, then what was made", () => {
  const linkedin = buildExhibits(LIVED).find((e) => e.source === "linkedin")!;
  assert.match(exhibitFacts(linkedin)[0], /dated connections/);

  const github = buildExhibits(LIVED).find((e) => e.source === "github")!;
  assert.match(exhibitFacts(github)[0], /active months/);
  assert.match(exhibitFacts(github)[1], /repos/);
});

test("exhibit facts never run past three lines", () => {
  const crowded = buildExhibits({
    github: {
      earliest: iso(9),
      months: monthsAgo(9, 0, 4),
      vouchMonths: monthsAgo(8, 0, 2),
      made: [
        { count: 40, label: "repos" },
        { count: 200, label: "pull requests and issues" },
        { count: 12, label: "gists" },
      ],
    },
  })[0];

  assert.ok(exhibitFacts(crowded).length <= 3, "a card this tight cannot hold more");
});

test("an empty profile has no exhibits", () => {
  assert.deepEqual(buildExhibits({}), []);
});

test("garbage evidence does not throw", () => {
  assert.doesNotThrow(() =>
    story({
      // @ts-expect-error deliberately malformed
      github: { earliest: "nonsense", months: { bad: "x" }, made: [{ count: NaN, label: "x" }] },
      // @ts-expect-error deliberately malformed
      youtube: { followers: "many", vouchMonths: null },
    }),
  );
});
