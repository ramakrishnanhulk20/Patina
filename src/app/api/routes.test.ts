import test, { mock } from "node:test";
import assert from "node:assert/strict";

/**
 * The first tests that go through an actual request.
 *
 * Every other suite here tests a calculation in isolation, which is good
 * coverage of what a score MEANS and none at all of what the web app DOES. The
 * routes, where the session is checked, the ownership rule is enforced and the
 * money is spent, were verified by hand only. That is the most fragile part of
 * the product and it was the only part with nothing watching it.
 *
 * HOW THIS RUNS WITHOUT NEXT. Route handlers are ordinary functions that take a
 * Request and return a Response; the only thing tying them to a server is
 * `next/headers`, which needs a live request context. That one module is
 * replaced with a plain in-memory cookie jar, so the handlers run for real and
 * the tests can say who the caller is.
 *
 * WHAT IS DELIBERATELY NOT TESTED HERE is anything that talks to Vana. Reading
 * a source needs a live Personal Server and settles real money, so it cannot be
 * asserted from a test run. What CAN be asserted is everything guarding it:
 * who is allowed to ask, what is refused, and what a refusal says.
 */

// ---------------------------------------------------------------------------
// A cookie jar standing in for the one Next gives a request.
// ---------------------------------------------------------------------------

const jar = new Map<string, string>();

/**
 * Mocked by its resolved file path, not by "next/headers".
 *
 * The bare specifier resolves through Next's package layout to headers.js, and
 * the mock loader wants the thing it will actually be asked for. Pointing at
 * the file is what makes the substitution take.
 */
const NEXT_HEADERS = new URL("../../../node_modules/next/headers.js", import.meta.url).href;

// `namedExports` rather than the newer `exports`, because the @types/node in
// this project only describes the former. The runtime prints a deprecation
// notice for it; switching would trade a warning for a type error, which is the
// worse of the two. Revisit when @types/node catches up.
mock.module(NEXT_HEADERS, {
  namedExports: {
    cookies: async () => ({
      get: (name: string) => {
        const value = jar.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: (name: string, value: string) => void jar.set(name, value),
      delete: (name: string) => void jar.delete(name),
    }),
    headers: async () => new Headers(),
  },
});

process.env.VANA_APP_PRIVATE_KEY ??=
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
process.env.ADMIN_PASSWORD = "test-admin-password";

const { ensureSessionId } = await import("@/lib/session");
const { ensureProfileId, recordSource } = await import("@/lib/store");
const { readScope } = await import("@/lib/normalize");

// Extensions spelled out, the way the lib suites do it: Node needs them and
// the "@/" alias resolver only covers aliased specifiers.
const usernameRoute = await import("./patina/username/route.ts");
const dataRoute = await import("./patina/data/route.ts");
const meRoute = await import("./patina/me/route.ts");
const adminSession = await import("./admin/session/route.ts");
const restoreRoute = await import("./patina/restore/route.ts");

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const iso = (yearsAgo: number) => new Date(Date.now() - yearsAgo * MS_PER_YEAR).toISOString();

let seq = 0;
const uniqueName = () => `tester${(seq += 1)}${Date.now() % 10000}`;

/** Start a fresh browser with no session at all. */
function signedOut() {
  jar.clear();
}

/** A caller with a session and a real, scorable GitHub read behind it. */
async function withProfile() {
  jar.clear();
  const sessionId = await ensureSessionId();
  const profileId = await ensureProfileId(sessionId);
  await recordSource(
    profileId,
    "github",
    [
      {
        scope: "github.history",
        fragment: readScope("github.history", {
          pullRequests: [{ id: "1", createdAt: iso(9) }, { id: "2", createdAt: iso(2) }],
        })!,
      },
    ],
    { proven: true },
  );
  return { sessionId, profileId };
}

const post = (url: string, body?: unknown) =>
  new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

// ---------------------------------------------------------------------------
// Who is allowed to do what.
// ---------------------------------------------------------------------------

test("a signed-out caller sees an empty score rather than an error", async () => {
  // A first visit is the normal state, not a failure, and a 404 here would make
  // the connect page handle a problem that is not one.
  signedOut();
  const res = await meRoute.GET();
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.total, 0);
  assert.deepEqual(body.sourcesConnected, []);
  assert.equal(body.username, null);
});

test("claiming a name without a session is refused", async () => {
  signedOut();
  const res = await usernameRoute.POST(
    post("http://x/api/patina/username", { username: uniqueName() }),
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).ok, false);
});

test("the data page hands a signed-out caller nothing rather than somebody else's", async () => {
  signedOut();
  const body = await (await dataRoute.GET()).json();
  assert.equal(body.found, false);
  assert.deepEqual(body.sources, []);
});

// ---------------------------------------------------------------------------
// The signing floor, enforced at the route rather than in the button.
// ---------------------------------------------------------------------------

test("a name cannot be claimed before anything is connected", async () => {
  jar.clear();
  const sessionId = await ensureSessionId();
  await ensureProfileId(sessionId);

  const res = await usernameRoute.POST(
    post("http://x/api/patina/username", { username: uniqueName() }),
  );

  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.match(body.error, /Connect a source/i);
});

test("a real profile can claim a name, and gets it back", async () => {
  await withProfile();
  const name = uniqueName();

  const res = await usernameRoute.POST(post("http://x/api/patina/username", { username: name }));

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, username: name });

  // And the caller's own view now reflects it.
  const me = await (await meRoute.GET()).json();
  assert.equal(me.username, name);
});

test("a name already taken is refused without disturbing the holder", async () => {
  await withProfile();
  const name = uniqueName();
  await usernameRoute.POST(post("http://x/api/patina/username", { username: name }));

  // A different person, same name.
  await withProfile();
  const res = await usernameRoute.POST(post("http://x/api/patina/username", { username: name }));

  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /taken/i);
});

test("a malformed body is a clean refusal, not a crash", async () => {
  await withProfile();
  const res = await usernameRoute.POST(
    new Request("http://x/api/patina/username", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json at all",
    }),
  );
  assert.equal(res.status, 400);
});

// ---------------------------------------------------------------------------
// Seeing and removing your own data.
// ---------------------------------------------------------------------------

test("the data page shows what is stored and never the server locator", async () => {
  await withProfile();
  const body = await (await dataRoute.GET()).json();

  assert.equal(body.found, true);
  assert.equal(body.sources.length, 1);
  assert.equal(body.sources[0].id, "github");
  assert.equal(body.sources[0].ownershipProven, true);
  assert.ok(body.fragments["github.history"], "the actual stored row is handed over");

  /**
   * The Personal Server hash is a locator for somebody's personal data. It is
   * reported as a yes/no and must never appear as a value in a file the person
   * is about to email to themselves.
   */
  const dumped = JSON.stringify(body);
  assert.ok(!dumped.includes("serverHash"), "the server hash must not be exported");
});

test("removing a source drops it and rescores, leaving the others alone", async () => {
  const { profileId } = await withProfile();
  await recordSource(
    profileId,
    "youtube",
    [{ scope: "youtube.profile", fragment: readScope("youtube.profile", { joinedDate: iso(12) })! }],
    { proven: true },
  );

  const res = await dataRoute.DELETE(
    new Request("http://x/api/patina/data?source=github", { method: "DELETE" }),
  );

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.remaining, ["youtube"]);

  const after = await (await dataRoute.GET()).json();
  assert.ok(!Object.keys(after.fragments).some((s: string) => s.startsWith("github.")));
});

test("a signed-out caller cannot remove anything", async () => {
  signedOut();
  const res = await dataRoute.DELETE(
    new Request("http://x/api/patina/data?source=github", { method: "DELETE" }),
  );
  assert.equal(res.status, 404);
});

// ---------------------------------------------------------------------------
// The admin gate.
// ---------------------------------------------------------------------------

test("a wrong admin password is refused and says nothing useful", async () => {
  signedOut();
  const res = await adminSession.POST(post("http://x/api/admin/session", { password: "nope" }));

  assert.equal(res.status, 401);
  // No hint about length, format, or whether a password is even configured.
  assert.deepEqual(await res.json(), { ok: false });
});

test("the right admin password opens a session, and signing out closes it", async () => {
  signedOut();
  const { isAdmin } = await import("@/lib/admin");

  assert.equal(await isAdmin(), false, "no cookie, no access");

  const res = await adminSession.POST(
    post("http://x/api/admin/session", { password: "test-admin-password" }),
  );
  assert.equal(res.status, 200);
  assert.equal(await isAdmin(), true);

  await adminSession.DELETE();
  assert.equal(await isAdmin(), false);
});

test("a forged admin cookie does not open the door", async () => {
  signedOut();
  const { isAdmin } = await import("@/lib/admin");
  jar.set("patina_admin", "f".repeat(64));
  assert.equal(await isAdmin(), false);
});

// ---------------------------------------------------------------------------
// Restore, which must never become a way to get a paid read for nothing.
// ---------------------------------------------------------------------------

test("a restore cannot be finished from an unknown request", async () => {
  signedOut();
  const res = await restoreRoute.GET(new Request("http://x/api/patina/restore?requestId=made-up"));
  assert.equal(res.status, 404);
});

test("a retired source cannot be restored through", async () => {
  signedOut();
  const res = await restoreRoute.POST(post("http://x/api/patina/restore?source=steam"));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Unknown source/i);
});
