import { test } from "node:test";
import assert from "node:assert/strict";
import { SOURCE_ORDER, SOURCE_SPECS, buildProfileUrl, cleanHandle } from "./sources.ts";

/**
 * People do not type what you ask for. Asked for a handle they will paste the
 * whole URL, or the @, or a link copied from the share sheet with tracking
 * junk on the end. Every one of these has to produce a working profile URL,
 * because a wrong one means a failed approval on somebody else's website with
 * no explanation of what went wrong.
 */
test("whatever someone pastes, we get the handle out of it", () => {
  const cases: [string, string][] = [
    ["ramkumar", "ramkumar"],
    ["@ramkumar", "ramkumar"],
    ["  @ramkumar  ", "ramkumar"],
    ["youtube.com/@ramkumar", "ramkumar"],
    ["www.youtube.com/@ramkumar", "ramkumar"],
    ["https://www.youtube.com/@ramkumar", "ramkumar"],
    ["https://youtube.com/@ramkumar/", "ramkumar"],
    ["https://www.instagram.com/ramkumar/", "ramkumar"],
    ["https://github.com/ramkumar", "ramkumar"],
    ["https://www.linkedin.com/in/ramkumar/", "ramkumar"],
    ["linkedin.com/in/ram-kumar-123", "ram-kumar-123"],
    ["https://www.youtube.com/@ramkumar?si=abc123", "ramkumar"],
    ["https://www.instagram.com/ramkumar/reels/", "ramkumar"],
    ["HTTPS://WWW.YOUTUBE.COM/@RamKumar", "RamKumar"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(cleanHandle(input), expected, `input: ${input}`);
  }
});

test("empty and junk input yields nothing rather than a broken URL", () => {
  for (const junk of ["", "   ", "@", "https://", "youtube.com/", "/"]) {
    assert.equal(cleanHandle(junk), "", `input: "${junk}"`);
  }
});

test("a pasted handle builds the URL Vana will ask for", () => {
  assert.equal(
    buildProfileUrl(SOURCE_SPECS.youtube, "https://youtube.com/@ram"),
    "https://www.youtube.com/@ram",
  );
  assert.equal(buildProfileUrl(SOURCE_SPECS.instagram, "@ram"), "https://www.instagram.com/ram");
  assert.equal(buildProfileUrl(SOURCE_SPECS.github, "github.com/ram"), "https://github.com/ram");
  assert.equal(
    buildProfileUrl(SOURCE_SPECS.linkedin, "https://www.linkedin.com/in/ram-kumar/"),
    "https://www.linkedin.com/in/ram-kumar",
  );

  // Nothing usable in, nothing out. Never a half-built URL.
  assert.equal(buildProfileUrl(SOURCE_SPECS.youtube, "   "), "");
  assert.equal(buildProfileUrl(SOURCE_SPECS.spotify, "anything"), "");
});

test("pasted YouTube channel URLs keep their real shape", () => {
  assert.equal(
    buildProfileUrl(SOURCE_SPECS.youtube, "https://www.youtube.com/channel/UCabc123"),
    "https://www.youtube.com/channel/UCabc123",
  );
  assert.equal(
    buildProfileUrl(SOURCE_SPECS.youtube, "https://m.youtube.com/c/MyChannel"),
    "https://www.youtube.com/c/MyChannel",
  );
  assert.equal(
    buildProfileUrl(SOURCE_SPECS.youtube, "https://youtube.com/user/legacyname"),
    "https://www.youtube.com/user/legacyname",
  );
  assert.equal(
    buildProfileUrl(SOURCE_SPECS.youtube, "https://m.youtube.com/@ramkumar"),
    "https://www.youtube.com/@ramkumar",
  );
});

test("Instagram deep links collapse to the profile root", () => {
  assert.equal(
    buildProfileUrl(SOURCE_SPECS.instagram, "https://www.instagram.com/ramkumar/reels/"),
    "https://www.instagram.com/ramkumar",
  );
  assert.equal(
    buildProfileUrl(SOURCE_SPECS.instagram, "https://instagram.com/ramkumar/"),
    "https://www.instagram.com/ramkumar",
  );
});

test("a handle cannot be used to point the URL somewhere else", () => {
  // If this were interpolated raw, the result would resolve to evil.com.
  const built = buildProfileUrl(SOURCE_SPECS.github, "ram%2F..%2F..%40evil.com");
  assert.ok(built.startsWith("https://github.com/"), `built: ${built}`);
  assert.ok(!built.includes("evil.com/"), `built: ${built}`);
});

test("specs are serialisable, since the server hands them to a client component", () => {
  // React throws at render time on a function prop, which typecheck and the
  // production build both pass straight over. This is the cheap guard.
  for (const id of SOURCE_ORDER) {
    const spec = SOURCE_SPECS[id];
    const roundTripped = JSON.parse(JSON.stringify(spec));
    assert.deepEqual(roundTripped, spec, `${id} contains something JSON cannot carry`);
  }
});

test("every source is either buildable or has instructions, never neither", () => {
  for (const id of SOURCE_ORDER) {
    const spec = SOURCE_SPECS[id];
    assert.ok(
      spec.handle !== null || (spec.findIt?.length ?? 0) > 0,
      `${id} leaves the user with no way to answer Vana's question`,
    );
    assert.equal(spec.scopes.length, 1, `${id} must request exactly one scope`);
  }
});
