import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAIM_CLOSES_AT, CLAIM_OPENS_AT, claimWindowState } from "./rewards.ts";

const at = (iso: string) => claimWindowState(new Date(iso));

/**
 * The claim window decides who gets paid, so its edges are worth a test rather
 * than a careful read. A window that is off by an hour, or that treats its own
 * closing instant as still open, costs somebody real money and there is no way
 * to give it back afterwards.
 */
test("the window is exactly twelve hours", () => {
  const hours = (Date.parse(CLAIM_CLOSES_AT) - Date.parse(CLAIM_OPENS_AT)) / 3_600_000;
  assert.equal(hours, 12);
});

test("the window is stated in UTC and lands on 3pm IST", () => {
  // India Standard Time is UTC+5:30 and has no daylight saving, so this is a
  // fixed offset rather than a seasonal one.
  const opensIst = new Date(Date.parse(CLAIM_OPENS_AT) + 5.5 * 3_600_000);
  const closesIst = new Date(Date.parse(CLAIM_CLOSES_AT) + 5.5 * 3_600_000);

  assert.equal(opensIst.toISOString().slice(0, 16), "2026-08-19T15:00");
  assert.equal(closesIst.toISOString().slice(0, 16), "2026-08-20T03:00");
});

test("the edges fall on the right side", () => {
  assert.equal(at("2026-08-19T09:29:59.999Z"), "before", "a millisecond early is early");
  assert.equal(at(CLAIM_OPENS_AT), "open", "the opening instant is open");
  assert.equal(at("2026-08-19T15:00:00.000Z"), "open", "the middle is open");
  assert.equal(at("2026-08-19T21:29:59.999Z"), "open", "a millisecond before close is open");
  assert.equal(at(CLAIM_CLOSES_AT), "closed", "the closing instant is CLOSED, not open");
  assert.equal(at("2026-08-25T00:00:00.000Z"), "closed", "and it stays closed");
});
