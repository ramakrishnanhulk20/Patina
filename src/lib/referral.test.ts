import { test } from "node:test";
import assert from "node:assert/strict";
import { REFERRAL_CODE, normalizeReferralCode } from "./referral.ts";

/**
 * The proxy, the connect route and the client all lean on this one validator.
 * If it drifts, a code accepted on the way in gets rejected on the way out and
 * the referral vanishes, so the shape is pinned here.
 */

test("a freshly minted code shape is accepted", () => {
  // Seven characters from [a-z2-9], the alphabet newReferralCode uses.
  assert.equal(normalizeReferralCode("k3mp9q2"), "k3mp9q2");
  assert.match("k3mp9q2", REFERRAL_CODE);
});

test("a code is lowercased so a stray capital still credits the referrer", () => {
  // Codes are stored and compared lowercase (codeKey); a link that arrives with
  // a capital from an autocorrect must resolve to the same person.
  assert.equal(normalizeReferralCode("K3MP9Q2"), "k3mp9q2");
  assert.equal(normalizeReferralCode("  k3mp9q2  "), "k3mp9q2", "surrounding space is trimmed");
});

test("missing or malformed codes normalise to undefined, never a thrown error", () => {
  for (const bad of [
    null,
    undefined,
    "",
    "   ",
    "abc", // too short
    "a".repeat(17), // too long
    "has space",
    "under_score",
    "dash-ed",
    "hello1", // '0' and '1' are the ambiguous digits the alphabet leaves out
    "zero0pad",
    "punc!!!",
    "../etc", // a path is not a code, and must never reach a cookie as one
  ]) {
    assert.equal(normalizeReferralCode(bad), undefined, `${JSON.stringify(bad)} must be rejected`);
  }
});

test("the validator is deliberately looser than the minter, and that is fine", () => {
  // newReferralCode never emits i, l or o (they read ambiguously), but the shape
  // check accepts a–z wholesale on purpose: it is a cheap guard against junk in
  // a cookie, not a checksum. Locked down here so nobody "tightens" it to match
  // the minter and, in doing so, changes what the proxy has always accepted.
  assert.equal(normalizeReferralCode("abcilo9"), "abcilo9");
});

test("the accepted length window spans 4 to 16 characters", () => {
  assert.equal(normalizeReferralCode("ab23"), "ab23", "four is the floor");
  assert.equal(normalizeReferralCode("abcdefghjkmnpqrs"), "abcdefghjkmnpqrs", "sixteen is the ceiling");
  assert.equal(normalizeReferralCode("ab2"), undefined, "three is too short");
  assert.equal(normalizeReferralCode("abcdefghjkmnpqrst"), undefined, "seventeen is too long");
});
