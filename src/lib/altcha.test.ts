import { test } from "node:test";
import assert from "node:assert/strict";
import { solveChallenge } from "altcha-lib/v1";
import { altchaConfigured, newAltchaChallenge, verifyAltcha } from "./altcha.ts";

/**
 * The bot check guards the one endpoint that spends escrow, so "a valid solve
 * passes and everything else is refused" is the property that matters.
 *
 * Replay rejection is not asserted here: it rides on Redis (SET NX), and these
 * tests run with no Redis configured, where the guard deliberately fails OPEN.
 * The store tests already cover SET NX; this file covers the crypto gate.
 */

const KEY = "test-altcha-hmac-key";

/** A genuinely solved payload, shaped exactly as the browser sends it. */
async function solvedPayload(): Promise<string> {
  const ch = await newAltchaChallenge();
  const solution = await solveChallenge(ch.challenge, ch.salt, ch.algorithm, ch.maxnumber).promise;
  assert.ok(solution, "the challenge must be solvable");
  return Buffer.from(
    JSON.stringify({
      algorithm: ch.algorithm,
      challenge: ch.challenge,
      number: solution.number,
      salt: ch.salt,
      signature: ch.signature,
    }),
  ).toString("base64");
}

test("the bot check is off until a key is configured", async () => {
  delete process.env.ALTCHA_HMAC_KEY;
  assert.equal(altchaConfigured(), false);
  assert.equal(await verifyAltcha("anything"), false, "nothing verifies without a key");
});

test("a genuinely solved challenge passes, and everything else is refused", async () => {
  process.env.ALTCHA_HMAC_KEY = KEY;
  try {
    assert.equal(altchaConfigured(), true);

    assert.equal(await verifyAltcha(await solvedPayload()), true, "a real solve must pass");

    assert.equal(await verifyAltcha(""), false, "an empty token is not a solve");
    assert.equal(await verifyAltcha("not-valid-base64-$$$"), false, "garbage is not a solve");

    // Keep the signature, change the answer: it no longer hashes to the challenge.
    const good = JSON.parse(Buffer.from(await solvedPayload(), "base64").toString("utf8"));
    const tampered = Buffer.from(
      JSON.stringify({ ...good, number: good.number + 1 }),
    ).toString("base64");
    assert.equal(await verifyAltcha(tampered), false, "a changed solution must fail");
  } finally {
    delete process.env.ALTCHA_HMAC_KEY;
  }
});
