import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketsFor } from "./ratelimit.ts";

const withHeaders = (headers: Record<string, string>) =>
  new Request("https://patinadata.xyz/api/vana/request", { method: "POST", headers });

/**
 * The regression test for the bypassed rate limit.
 *
 * The limiter used to key on the session cookie INSTEAD of the address when a
 * session was present. A cookie is whatever the caller says it is, so rotating
 * it per request bought an unlimited supply of fresh, empty buckets and the cap
 * never fired. The route it guards settles a real fee against the escrow, so
 * the bypass spent actual money.
 *
 * The address bucket must therefore be present on EVERY request, including the
 * ones carrying a session, because it is the only component the caller cannot
 * choose for themselves.
 */
test("the address bucket is counted whether or not a session is presented", () => {
  const request = withHeaders({ "x-forwarded-for": "203.0.113.7" });

  assert.deepEqual(bucketsFor(request, null), ["ip:203.0.113.7"]);

  // Presenting a session ADDS a bucket. It must never replace the address one.
  assert.deepEqual(bucketsFor(request, "s1.abc"), ["ip:203.0.113.7", "sid:s1.abc"]);
});

test("rotating the session cookie cannot shake off the address bucket", () => {
  const request = withHeaders({ "x-forwarded-for": "203.0.113.7" });

  // The attack: a different cookie every time. Each call yields a different
  // session bucket, and the SAME address bucket, which is what stops it.
  const shared = ["s1.one", "s1.two", "s1.three"].map(
    (token) => bucketsFor(request, token).filter((key) => key.startsWith("ip:"))[0],
  );

  assert.deepEqual(shared, ["ip:203.0.113.7", "ip:203.0.113.7", "ip:203.0.113.7"]);
});

/**
 * Vercel rewrites x-forwarded-for so the first entry is the real peer. A caller
 * appending their own values must not be able to push it out of that position.
 */
test("the first x-forwarded-for entry is the one counted", () => {
  const spoofed = withHeaders({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 172.16.0.9" });
  assert.deepEqual(bucketsFor(spoofed, null), ["ip:203.0.113.7"]);
});

test("a missing address header still lands in a bucket rather than none", () => {
  assert.deepEqual(bucketsFor(withHeaders({}), null), ["ip:unknown"]);
});
