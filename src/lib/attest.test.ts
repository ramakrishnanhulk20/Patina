import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttestation, verifyAttestation, attestationSigner } from "./attest.ts";

// A well-known throwaway test key (Hardhat account #0). The attestation module
// reads the key only when it signs, so setting it here — before any test body
// runs — is enough.
process.env.VANA_APP_PRIVATE_KEY ??=
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const INPUT = {
  username: "alice",
  score: 83,
  verdict: "Deeply worn in",
  oldestYear: 2013,
  sources: 4,
};

test("an attestation verifies against the signing app address", async () => {
  const att = await buildAttestation(INPUT);
  assert.equal(att.app.toLowerCase(), attestationSigner().toLowerCase());
  assert.equal(
    await verifyAttestation({ app: att.app, message: att.message, signature: att.signature }),
    true,
  );
});

test("a tampered score does not verify", async () => {
  const att = await buildAttestation(INPUT);
  const tampered = att.message.replace("83/100", "99/100");
  assert.equal(
    await verifyAttestation({ app: att.app, message: tampered, signature: att.signature }),
    false,
  );
});

test("a signature checked against the wrong app fails", async () => {
  const att = await buildAttestation(INPUT);
  const notTheApp = "0x000000000000000000000000000000000000dEaD" as `0x${string}`;
  assert.equal(
    await verifyAttestation({ app: notTheApp, message: att.message, signature: att.signature }),
    false,
  );
});
