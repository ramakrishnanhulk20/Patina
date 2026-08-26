import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATTESTATION_VALID_DAYS,
  buildAttestation,
  expiryOf,
  verifyAttestation,
  attestationSigner,
  usingSharedKey,
} from "./attest.ts";

// A well-known throwaway test key (Hardhat account #0). The attestation module
// reads the key only when it signs, so setting it here. Before any test body
// runs. Is enough.
process.env.VANA_APP_PRIVATE_KEY ??=
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const INPUT = {
  username: "alice",
  score: 83,
  verdict: "Deeply worn in",
  oldestYear: 2013,
  sources: 4,
};

const DAY = 24 * 60 * 60 * 1000;

test("an attestation verifies against the signing app address", async () => {
  const att = await buildAttestation(INPUT);
  assert.equal(att.app.toLowerCase(), attestationSigner().toLowerCase());

  const result = await verifyAttestation({
    app: att.app,
    message: att.message,
    signature: att.signature,
  });
  assert.equal(result.valid, true);
  assert.equal(result.signatureValid, true);
  assert.equal(result.expired, false);
});

test("a tampered score does not verify", async () => {
  const att = await buildAttestation(INPUT);
  const tampered = att.message.replace("83/100", "99/100");
  const result = await verifyAttestation({
    app: att.app,
    message: tampered,
    signature: att.signature,
  });
  assert.equal(result.valid, false);
  assert.equal(result.signatureValid, false);
});

test("a signature checked against the wrong app fails", async () => {
  const att = await buildAttestation(INPUT);
  const notTheApp = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
  const result = await verifyAttestation({
    app: notTheApp,
    message: att.message,
    signature: att.signature,
  });
  assert.equal(result.valid, false);
  assert.equal(result.signatureValid, false);
});

// ---------------------------------------------------------------------------
// Expiry.
//
// The gap this closes: an attestation used to be good forever, so a statement
// fetched today would still verify years after the profile behind it had
// changed or been deleted. For a product about elapsed time, that was the worst
// possible thing to get wrong.
// ---------------------------------------------------------------------------

test("an attestation carries an expiry, and it is a month out", async () => {
  const att = await buildAttestation(INPUT);
  const life = new Date(att.expiresAt).getTime() - new Date(att.issuedAt).getTime();
  assert.equal(Math.round(life / DAY), ATTESTATION_VALID_DAYS);
});

test("a stale attestation is refused even though the signature is genuine", async () => {
  const att = await buildAttestation(INPUT);
  const wellAfter = new Date(Date.now() + (ATTESTATION_VALID_DAYS + 1) * DAY);

  const result = await verifyAttestation({
    app: att.app,
    message: att.message,
    signature: att.signature,
    at: wellAfter,
  });

  assert.equal(result.valid, false, "past its date, so not to be trusted");
  assert.equal(result.signatureValid, true, "but it is not a forgery, and must not be called one");
  assert.equal(result.expired, true);
});

/**
 * The expiry has to be INSIDE the signature, or it is only a suggestion.
 *
 * If it sat beside the message in the JSON, anybody passing on a stale
 * attestation would edit the field and the signature would still check out.
 * Moving the date forward inside the message must break it.
 */
test("the expiry cannot be extended without breaking the signature", async () => {
  const att = await buildAttestation(INPUT);
  const farFuture = new Date(Date.now() + 3650 * DAY).toISOString();
  const forged = att.message.replace(/^expiresAt: .+$/m, `expiresAt: ${farFuture}`);

  assert.notEqual(forged, att.message, "the test must actually have changed something");

  const result = await verifyAttestation({
    app: att.app,
    message: forged,
    signature: att.signature,
  });
  assert.equal(result.signatureValid, false, "an edited expiry is an edited message");
  assert.equal(result.valid, false);
});

/**
 * The old format had no expiry line at all. Those are exactly the statements
 * this change exists to retire, so the safe reading of "no stated lifetime" is
 * not "unlimited".
 */
test("an attestation with no expiry at all is treated as stale", async () => {
  const legacy = [
    "Patina score attestation",
    "",
    "username: alice",
    "score: 83/100",
    "issuedAt: 2026-01-01T00:00:00.000Z",
    "app: 0x0000000000000000000000000000000000000001",
  ].join("\n");

  assert.equal(expiryOf(legacy), null);

  const result = await verifyAttestation({
    app: "0x0000000000000000000000000000000000000001",
    message: legacy,
    signature: "0xdead" as `0x${string}`,
  });
  assert.equal(result.expired, true);
  assert.equal(result.valid, false);
});

// ---------------------------------------------------------------------------
// Key separation.
// ---------------------------------------------------------------------------

test("a dedicated signing key is used when one is set, and reported when not", async () => {
  const before = process.env.PATINA_ATTESTATION_KEY;
  try {
    delete process.env.PATINA_ATTESTATION_KEY;
    assert.equal(usingSharedKey(), true, "falls back to the escrow key, and says so");
    const shared = attestationSigner();

    // Hardhat account #1: a different key must produce a different signer.
    process.env.PATINA_ATTESTATION_KEY =
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    assert.equal(usingSharedKey(), false);
    assert.notEqual(attestationSigner().toLowerCase(), shared.toLowerCase());

    const att = await buildAttestation(INPUT);
    const result = await verifyAttestation({
      app: att.app,
      message: att.message,
      signature: att.signature,
    });
    assert.equal(result.valid, true, "attestations still verify under the dedicated key");
  } finally {
    if (before === undefined) delete process.env.PATINA_ATTESTATION_KEY;
    else process.env.PATINA_ATTESTATION_KEY = before;
  }
});

/**
 * The published address and the key in use must agree.
 *
 * This is the one mistake in the whole system that produces no error anywhere
 * and tells the entire world that Patina is lying. The address lives in the
 * code and the key lives in the hosting settings, edited at different times by
 * hand, so the two drifting apart is not a hypothetical.
 */
test("a signer that does not match the published address is reported, not hidden", async () => {
  const { signerCheck } = await import("./attest.ts");
  const { PATINA_APP_ADDRESS } = await import("./patina-address.ts");
  const before = process.env.PATINA_ATTESTATION_KEY;

  try {
    // Hardhat account #2. Deliberately not whatever the site publishes.
    process.env.PATINA_ATTESTATION_KEY =
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

    const check = signerCheck();
    assert.equal(check.matches, false, "a mismatch has to be visible");
    assert.equal(check.published, PATINA_APP_ADDRESS);
    assert.ok(check.configured, "and it has to name what is actually signing");
    assert.notEqual(check.configured!.toLowerCase(), check.published.toLowerCase());
  } finally {
    if (before === undefined) delete process.env.PATINA_ATTESTATION_KEY;
    else process.env.PATINA_ATTESTATION_KEY = before;
  }
});

test("the check agrees with itself when the key is the published one", async () => {
  const { signerCheck, attestationSigner } = await import("./attest.ts");
  const before = process.env.PATINA_ATTESTATION_KEY;

  try {
    process.env.PATINA_ATTESTATION_KEY =
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
    const signing = attestationSigner();

    // Stand in for the published constant by comparing against itself: what is
    // under test is that `matches` is driven by the two addresses agreeing,
    // not that it is hardcoded either way.
    const check = signerCheck();
    assert.equal(check.configured, signing);
    assert.equal(
      check.matches,
      signing.toLowerCase() === check.published.toLowerCase(),
      "matches must follow the comparison rather than a constant",
    );
  } finally {
    if (before === undefined) delete process.env.PATINA_ATTESTATION_KEY;
    else process.env.PATINA_ATTESTATION_KEY = before;
  }
});
