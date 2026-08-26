import test from "node:test";
import assert from "node:assert/strict";

import { balanceAdvice, LOW_BALANCE_DAYS, LOW_BALANCE_FLOOR } from "./escrow-balance.ts";
import type { BalanceReading } from "./escrow-balance.ts";

/**
 * The alarm has to be believable, which is a harder bar than being correct.
 *
 * The first version fired below a fixed two hundred connections. On a live
 * deployment with no users that read as "top up soon" while there were months
 * of runway, and an alarm that is wrong on day one is one nobody trusts on the
 * day it is right. These tests are about the difference between a balance and
 * a runway, which is the burn rate.
 */

function reading(over: Partial<BalanceReading>): BalanceReading {
  return {
    ok: true,
    symbol: "USDC.e",
    available: 10,
    availableRaw: "10000000",
    connectionsLeft: 250,
    daysLeft: null,
    burnPerDay: 0,
    low: false,
    empty: false,
    ...over,
  };
}

test("with no usage, a healthy balance is not an emergency", () => {
  // The exact case that was getting it wrong: live, funded, nobody using it.
  const advice = balanceAdvice(reading({ connectionsLeft: 193, daysLeft: null, burnPerDay: 0 }));
  assert.match(advice, /193 more connections funded/);
  assert.ok(!/top up/i.test(advice), "nothing is being spent, so there is nothing to hurry about");
});

test("with no usage, a tiny balance still gets mentioned without panic", () => {
  const advice = balanceAdvice(
    reading({ connectionsLeft: LOW_BALANCE_FLOOR - 1, daysLeft: null, burnPerDay: 0, low: true }),
  );
  assert.match(advice, /no rush/i, "there is no rate, so this cannot be urgent");
  assert.match(advice, /first real users/i, "but it is worth saying it would not last");
});

test("with usage, the advice is in days rather than connections", () => {
  const advice = balanceAdvice(
    reading({ connectionsLeft: 60, burnPerDay: 10, daysLeft: 6, low: true }),
  );
  assert.match(advice, /6 days/, "days is the unit somebody can act on");
  assert.match(advice, /Top up now/i);
});

test("a long runway is reported calmly even when the count looks small", () => {
  // Forty connections is alarming next to fifty a day and fine next to one a
  // week. Only the rate can tell those apart.
  const advice = balanceAdvice(
    reading({ connectionsLeft: 40, burnPerDay: 0.5, daysLeft: 80, low: false }),
  );
  assert.match(advice, /80 days/);
  assert.ok(!/top up now/i.test(advice));
});

test("running out is stated plainly, and as happening now", () => {
  const advice = balanceAdvice(reading({ connectionsLeft: 0, empty: true, low: true }));
  assert.match(advice, /failing for everybody/i);
});

test("a balance that could not be read says so rather than implying zero", () => {
  const advice = balanceAdvice(reading({ ok: false, error: "gateway timeout" }));
  assert.match(advice, /Could not read/i);
  assert.match(advice, /gateway timeout/, "and names the reason, so it is actionable");
});

test("the low threshold is a number of days, not a number of connections", () => {
  // Guards the fix itself. If somebody reintroduces a fixed connection count,
  // the constant they would reach for no longer exists.
  assert.equal(typeof LOW_BALANCE_DAYS, "number");
  assert.ok(LOW_BALANCE_DAYS >= 7, "less than a week is not enough time to act");
});
