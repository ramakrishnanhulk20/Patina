import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePatina, verdict, type Evidence, type Months } from "./score.ts";

/**
 * Every date in here is generated RELATIVE TO NOW, so the tests keep meaning the
 * same thing in 2030 as they do today. A fixture with "2015-03" hardcoded in it
 * quietly becomes a test about a fifteen-year-old account, and the assertions
 * start passing for the wrong reason.
 */

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

function yearsAgo(years: number): string {
  return new Date(Date.now() - years * MS_PER_YEAR).toISOString();
}

/** A month histogram running from `fromYears` ago until `toYears` ago. */
function monthsAgo(fromYears: number, toYears: number, perMonth: number, everyNth = 1): Months {
  const months: Months = {};
  const start = new Date(Date.now() - fromYears * MS_PER_YEAR);
  const end = new Date(Date.now() - toYears * MS_PER_YEAR);

  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  let index = 0;
  while (cursor <= end) {
    if (index % everyNth === 0) {
      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      months[key] = perMonth;
    }
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    index += 1;
  }
  return months;
}

function componentOf(evidence: Evidence, key: string): number {
  const found = scorePatina(evidence).components.find((c) => c.key === key);
  assert.ok(found, `expected a ${key} component`);
  return found.points;
}

// ---------------------------------------------------------------------------
// The three reference profiles. These are the argument the product makes, so
// they get asserted as RANGES: precise enough to catch a real regression, loose
// enough that tuning a weight by a point does not turn the suite red.
// ---------------------------------------------------------------------------

/**
 * Eleven years across four accounts, all of them actively used.
 *
 * This started life labelled "ordinary" and asserted at v1's 83. It scored 95,
 * and the fixture was wrong rather than the maths: somebody on four platforms
 * for eleven years, present in most months of all of them, is not ordinary. They
 * are about as provably real as a person gets, and the top of the scale should
 * say so. ORDINARY below is what the old label actually meant.
 */
const DEEP: Evidence = {
  github: {
    earliest: yearsAgo(11),
    earliestLabel: "GitHub account opened",
    months: monthsAgo(11, 0, 8),
    made: [{ count: 240, label: "repos and pull requests" }],
    vouches: 6,
    followers: 180,
  },
  linkedin: {
    earliest: yearsAgo(13),
    earliestLabel: "LinkedIn work history",
    softDate: true,
    vouchMonths: monthsAgo(10, 0, 3),
    followers: 500,
  },
  spotify: {
    earliest: yearsAgo(9),
    earliestLabel: "first saved track",
    months: monthsAgo(9, 0, 14),
    made: [{ count: 900, label: "saved tracks" }],
  },
  instagram: {
    earliest: yearsAgo(10),
    earliestLabel: "earliest Instagram post",
    months: monthsAgo(10, 0, 3, 2),
    made: [{ count: 180, label: "posts" }],
    followers: 640,
  },
};

/**
 * Genuinely ordinary: eleven years, but only two accounts and long quiet
 * stretches on both. The person v1 was describing when it said 83.
 */
const ORDINARY: Evidence = {
  github: {
    earliest: yearsAgo(11),
    earliestLabel: "GitHub account opened",
    // Busy early, three years quiet, back at it since.
    months: { ...monthsAgo(11, 8, 3), ...monthsAgo(5, 0, 4) },
    made: [{ count: 32, label: "repos" }],
    vouches: 1,
    followers: 24,
  },
  instagram: {
    earliest: yearsAgo(9),
    earliestLabel: "earliest Instagram post",
    months: monthsAgo(9, 0, 2, 3),
    made: [{ count: 74, label: "posts" }],
    followers: 310,
  },
};

/** Genuinely young: three years, two accounts, entirely real. v1 scored this 23. */
const YOUNG_AND_REAL: Evidence = {
  github: {
    earliest: yearsAgo(3),
    earliestLabel: "GitHub account opened",
    months: monthsAgo(3, 0, 5),
    made: [{ count: 24, label: "repos" }],
    followers: 12,
  },
  instagram: {
    earliest: yearsAgo(2.5),
    earliestLabel: "earliest Instagram post",
    months: monthsAgo(2.5, 0, 4),
    made: [{ count: 90, label: "posts" }],
    followers: 300,
  },
};

/** Account farm: 3,900 bought followers, 120 posts in one week. v1 scored this 5. */
const FARM: Evidence = {
  instagram: {
    earliest: yearsAgo(0.04),
    earliestLabel: "earliest Instagram post",
    months: monthsAgo(0.04, 0, 120),
    made: [{ count: 120, label: "posts" }],
    followers: 3900,
  },
};

test("deep profile: eleven active years across four accounts scores in the nineties", () => {
  const score = scorePatina(DEEP);
  assert.ok(score.total >= 88 && score.total <= 98, `expected roughly 95, got ${score.total}`);
  assert.equal(score.provisional, false, "a four-source decade should be signable");
  assert.equal(verdict(score), "Deeply worn in");
});

test("ordinary profile: a decade with real gaps and two accounts lands in the sixties", () => {
  const score = scorePatina(ORDINARY);
  assert.ok(score.total >= 55 && score.total <= 78, `expected roughly 66, got ${score.total}`);
  // Two ordinary accounts and a real decade behind them. This was refused a
  // badge under the old three-source rule, which is the case that killed it.
  assert.equal(score.provisional, false, "two dated accounts is a real, signable history");
});

test("the scale has room at the top: continuous use outranks intermittent use", () => {
  assert.ok(
    scorePatina(DEEP).total - scorePatina(ORDINARY).total >= 15,
    "showing up for eleven years must beat drifting in and out of them",
  );
});

test("young and real: three years scores low but nowhere near zero", () => {
  const score = scorePatina(YOUNG_AND_REAL);
  assert.ok(
    score.total >= 18 && score.total <= 34,
    `expected roughly 25, got ${score.total}`,
  );
  // The whole point of the 0.15 floor. A low score is evidence of absence, not
  // an accusation, and a real nineteen-year-old must not read as a fraud.
  assert.ok(score.total > 0, "a real young person must never be flattened to zero");
});

test("account farm: bought followers and a one-week dump score almost nothing", () => {
  const score = scorePatina(FARM);
  assert.ok(score.total <= 5, `expected roughly 1, got ${score.total}`);
});

test("the gap between a real decade and a farm is the whole product", () => {
  const fake = scorePatina(FARM).total;
  assert.ok(scorePatina(DEEP).total - fake >= 70, "a heavy decade must dwarf a farm");
  // The one that actually matters. An ordinary person with gaps in their history
  // still has to be unmistakably separate from an account bought last week.
  assert.ok(scorePatina(ORDINARY).total - fake >= 45, "so must an ordinary one");
});

// ---------------------------------------------------------------------------
// Age
// ---------------------------------------------------------------------------

test("age: twelve years earns full marks, and nothing earns more", () => {
  const twelve = componentOf(
    { github: { earliest: yearsAgo(12), earliestLabel: "GitHub account opened" } },
    "age",
  );
  const thirty = componentOf(
    { github: { earliest: yearsAgo(30), earliestLabel: "GitHub account opened" } },
    "age",
  );
  assert.equal(twelve, 30);
  assert.equal(thirty, 30);
});

test("age: a self-reported LinkedIn date alone proves nothing", () => {
  const points = componentOf(
    {
      linkedin: {
        earliest: yearsAgo(20),
        earliestLabel: "LinkedIn work history",
        softDate: true,
      },
    },
    "age",
  );
  assert.equal(points, 0, "typed free text must not outrank a real account");
});

test("age: a self-reported date extends a real one at half weight", () => {
  const hardOnly = componentOf(
    { github: { earliest: yearsAgo(8), earliestLabel: "GitHub account opened" } },
    "age",
  );
  const withSoft = componentOf(
    {
      github: { earliest: yearsAgo(8), earliestLabel: "GitHub account opened" },
      linkedin: { earliest: yearsAgo(16), earliestLabel: "LinkedIn work history", softDate: true },
    },
    "age",
  );

  // 8 real years, plus half of the 8-year gap, is 12 years: full marks.
  assert.ok(withSoft > hardOnly, "self-reported history should count for something");
  assert.equal(withSoft, 30);
});

// ---------------------------------------------------------------------------
// Continuity
// ---------------------------------------------------------------------------

test("continuity: an old account active in only one year scores poorly", () => {
  const steady = componentOf(
    {
      github: {
        earliest: yearsAgo(10),
        earliestLabel: "GitHub account opened",
        months: monthsAgo(10, 0, 5),
      },
    },
    "continuity",
  );
  const abandoned = componentOf(
    {
      github: {
        earliest: yearsAgo(10),
        earliestLabel: "GitHub account opened",
        months: monthsAgo(10, 9, 5),
      },
    },
    "continuity",
  );

  assert.ok(
    steady > abandoned * 3,
    `showing up throughout (${steady}) must dominate showing up once (${abandoned})`,
  );
});

test("continuity: perfect attendance over six months is still only six months", () => {
  const points = componentOf(
    {
      github: {
        earliest: yearsAgo(0.5),
        earliestLabel: "GitHub account opened",
        months: monthsAgo(0.5, 0, 20),
      },
    },
    "continuity",
  );
  assert.ok(points < 3, `100% coverage of a short life must stay small, got ${points}`);
});

// ---------------------------------------------------------------------------
// Corroboration
// ---------------------------------------------------------------------------

test("corroboration: three fresh accounts agreeing on last Tuesday corroborate nothing", () => {
  const points = componentOf(
    {
      github: { earliest: yearsAgo(0.05), earliestLabel: "GitHub account opened" },
      instagram: { earliest: yearsAgo(0.05), earliestLabel: "earliest Instagram post" },
      steam: { earliest: yearsAgo(0.05), earliestLabel: "Steam account opened" },
    },
    "corroboration",
  );
  assert.ok(points < 1, `expected near zero, got ${points}`);
});

test("corroboration: two decade-old accounts max it out", () => {
  const points = componentOf(
    {
      github: { earliest: yearsAgo(10), earliestLabel: "GitHub account opened" },
      steam: { earliest: yearsAgo(12), earliestLabel: "Steam account opened" },
    },
    "corroboration",
  );
  assert.equal(points, 15);
});

// ---------------------------------------------------------------------------
// Vouches
// ---------------------------------------------------------------------------

test("vouches: connections made years ago beat the same number made last month", () => {
  const base = {
    github: {
      earliest: yearsAgo(10),
      earliestLabel: "GitHub account opened",
      months: monthsAgo(10, 0, 6),
    },
  };

  const aged = componentOf(
    { ...base, linkedin: { vouchMonths: monthsAgo(9, 1, 4) } },
    "vouches",
  );
  const fresh = componentOf(
    { ...base, linkedin: { vouchMonths: monthsAgo(0.1, 0, 400) } },
    "vouches",
  );

  assert.ok(aged > fresh, `aged vouches (${aged}) must beat bought ones (${fresh})`);
});

test("vouches: buying 50,000 followers is worth about two points", () => {
  const points = componentOf(
    {
      github: {
        earliest: yearsAgo(10),
        earliestLabel: "GitHub account opened",
        months: monthsAgo(10, 0, 6),
        followers: 50_000,
      },
    },
    "vouches",
  );
  assert.ok(points <= 2.5, `followers must stay flavour, got ${points}`);
});

// ---------------------------------------------------------------------------
// Cadence
// ---------------------------------------------------------------------------

test("cadence: a big dump on top of thin real history is discounted", () => {
  const spread: Evidence = {
    github: {
      earliest: yearsAgo(4),
      earliestLabel: "GitHub account opened",
      months: monthsAgo(4, 0, 12),
      made: [{ count: 576, label: "commits" }],
    },
  };

  const dumped: Evidence = {
    github: {
      earliest: yearsAgo(4),
      earliestLabel: "GitHub account opened",
      months: { ...monthsAgo(4, 0.2, 1), ...monthsAgo(0.1, 0, 530) },
      made: [{ count: 576, label: "commits" }],
    },
  };

  const spreadDepth = componentOf(spread, "depth");
  const dumpedDepth = componentOf(dumped, "depth");

  assert.ok(
    dumpedDepth < spreadDepth,
    `a burst (${dumpedDepth}) must count for less than a steady drip (${spreadDepth})`,
  );
});

test("cadence: an ordinary busy fortnight is not punished", () => {
  const lumpy: Evidence = {
    github: {
      earliest: yearsAgo(6),
      earliestLabel: "GitHub account opened",
      // Real people are lumpy: a few quiet months, a few busy ones.
      months: { ...monthsAgo(6, 3, 4), ...monthsAgo(3, 0, 11) },
      made: [{ count: 400, label: "commits" }],
    },
  };
  const even: Evidence = {
    github: {
      earliest: yearsAgo(6),
      earliestLabel: "GitHub account opened",
      months: monthsAgo(6, 0, 7),
      made: [{ count: 400, label: "commits" }],
    },
  };

  assert.ok(
    componentOf(lumpy, "depth") >= componentOf(even, "depth") * 0.95,
    "normal human lumpiness must not read as fraud",
  );
});

// ---------------------------------------------------------------------------
// Gating and the signing floor
// ---------------------------------------------------------------------------

test("gating: manufactured breadth and volume are worth little without time", () => {
  const overnight: Evidence = {};
  for (const id of ["github", "instagram", "spotify", "steam", "uber", "shop"] as const) {
    overnight[id] = {
      earliest: yearsAgo(0.03),
      earliestLabel: "account opened",
      months: monthsAgo(0.03, 0, 40),
      made: [{ count: 200, label: "things" }],
      followers: 900,
    };
  }

  const score = scorePatina(overnight);
  assert.ok(score.total <= 8, `six same-day accounts must not add up, got ${score.total}`);
});

/**
 * ONE dated source is the whole floor.
 *
 * These asserted a three-source rule until measurement killed it: a developer
 * with one fifteen-year GitHub scores 68 and somebody with two ordinary
 * accounts scores 78, and both were refused a badge while a profile on 81 got
 * one. Corroboration already docks a thin profile for having nobody to agree
 * with it, so the old rule punished the same fact twice and mostly just lost
 * people who happened to own fewer websites.
 */
test("floor: one source with a real date is signable", () => {
  const score = scorePatina({
    github: {
      earliest: yearsAgo(15),
      earliestLabel: "first GitHub contribution",
      months: monthsAgo(15, 0, 8),
      made: [{ count: 200, label: "repos" }],
    },
  });

  assert.equal(score.provisional, false, "fifteen years is not noise, whatever it sits alone on");
  assert.equal(score.provisionalReason, null);
  // And the score still says, on its own, that nobody corroborates them.
  const corroboration = score.components.find((c) => c.key === "corroboration")!;
  assert.ok(corroboration.points < corroboration.max * 0.6, "one source cannot max corroboration");
});

test("floor: a low score is still signed, because the number tells the truth", () => {
  const score = scorePatina({
    instagram: {
      earliest: yearsAgo(0.05),
      earliestLabel: "earliest Instagram post",
      months: monthsAgo(0.05, 0, 120),
      made: [{ count: 120, label: "posts" }],
      followers: 3900,
    },
  });

  assert.ok(score.total <= 5, "a week-old farm still scores almost nothing");
  assert.equal(score.provisional, false, "an accurate 2 is not a credential worth withholding");
});

test("floor: nothing dated is the one thing that cannot be signed", () => {
  const score = scorePatina({
    spotify: { made: [{ count: 400, label: "saved tracks" }] },
    shop: { made: [{ count: 30, label: "orders" }] },
  });

  assert.equal(score.provisional, true, "an attestation with no date in it says nothing");
  assert.match(score.provisionalReason ?? "", /carries a date/);
});

test("floor: a self-reported date alone does not clear it", () => {
  const score = scorePatina({
    linkedin: {
      earliest: yearsAgo(20),
      earliestLabel: "LinkedIn work history",
      softDate: true,
      vouchMonths: monthsAgo(8, 0, 3),
    },
  });

  assert.equal(score.provisional, true, "signing typed free text would put our name on nothing");
});

test("floor: an empty profile asks for a source rather than scolding", () => {
  const score = scorePatina({});
  assert.equal(score.provisional, true);
  assert.match(score.provisionalReason ?? "", /Connect a source/);
});

// ---------------------------------------------------------------------------
// It must never throw. A thrown error here is a user who connected successfully
// and sees a broken page.
// ---------------------------------------------------------------------------

test("empty evidence scores zero and says so without crashing", () => {
  const score = scorePatina({});
  assert.equal(score.total, 0);
  assert.equal(score.oldestSignal, null);
  assert.deepEqual(score.sourcesConnected, []);
  assert.equal(score.provisional, true);
  assert.equal(score.components.length, 6);
});

test("garbage dates and malformed months are ignored, not fatal", () => {
  const score = scorePatina({
    github: {
      earliest: "not a date",
      months: { "not-a-month": 5, "2019-13": 2, "2020-04": -3 } as Months,
      made: [{ count: Number.NaN, label: "repos" }],
    },
    // @ts-expect-error deliberately malformed, because Vana's shapes have moved before
    spotify: { months: null, made: "lots", vouches: "many", followers: undefined },
    // @ts-expect-error same
    steam: { made: [null, { count: "12" }, { label: "games" }] },
  });

  assert.ok(Number.isFinite(score.total), "total must always be a number");
  assert.equal(score.oldestSignal, null);
});

test("components always sum to the total, so the breakdown can be trusted", () => {
  for (const evidence of [DEEP, ORDINARY, YOUNG_AND_REAL, FARM]) {
    const score = scorePatina(evidence);
    const summed = score.components.reduce((sum, c) => sum + c.points, 0);
    assert.ok(
      Math.abs(summed - score.total) < 0.6,
      `breakdown (${summed}) must match the headline (${score.total})`,
    );
  }
});

test("no component ever exceeds its stated maximum", () => {
  const maxed: Evidence = {};
  for (const id of ["github", "linkedin", "spotify", "instagram", "steam"] as const) {
    maxed[id] = {
      earliest: yearsAgo(20),
      earliestLabel: "account opened",
      months: monthsAgo(20, 0, 50),
      made: [{ count: 100_000, label: "things" }],
      vouchMonths: monthsAgo(19, 0, 30),
      vouches: 50,
      followers: 1_000_000,
    };
  }

  for (const component of scorePatina(maxed).components) {
    assert.ok(
      component.points <= component.max,
      `${component.key} scored ${component.points} against a max of ${component.max}`,
    );
  }
});
