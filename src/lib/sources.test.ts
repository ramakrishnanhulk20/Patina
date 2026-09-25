import test from "node:test";
import assert from "node:assert/strict";

import {
  CORE_ORDER,
  PAUSED_SOURCES,
  SOURCE_ORDER,
  SOURCE_SPECS,
  STRENGTHEN_ORDER,
  isPaused,
  pausedMessage,
  proofMissingMessage,
  proofScopeFor,
  scopesFor,
} from "./sources.ts";
import { SOURCE_IDS } from "./score.ts";
import { ALL_SCOPES } from "./normalize.ts";

/**
 * THE OWNERSHIP INVARIANT.
 *
 * Patina's whole claim is that the history it reports belongs to the person
 * who connected it. Until these tests existed that was an assumption written in
 * comments, and one source had quietly stopped honouring it.
 *
 * Vana collects two ways and does not say which one it used. Desktop signs the
 * person in on their own machine. The web path collects server-side, and
 * server-side collection reads a PUBLIC PAGE: v1's `buildProfileUrl` existed
 * purely to turn a typed handle into a URL for it to scrape, and every scope v1
 * ever used was a `.profile` one. So a request made up entirely of `.profile`
 * scopes can be answered about somebody else's account, and YouTube's was.
 *
 * The defence is to ask for something a public page does not have. These tests
 * are what stop that defence being lost again by a future source being added
 * with nothing but a profile scope, which is the easy and natural way to add
 * one.
 */

test("every source declares a proof scope", () => {
  for (const id of SOURCE_IDS) {
    assert.ok(
      typeof SOURCE_SPECS[id]?.proof === "string" && SOURCE_SPECS[id].proof.length > 0,
      `${id} has no proof scope, so a public page could answer for it`,
    );
  }
});

test("a proof scope is always one the source actually asks for", () => {
  for (const id of SOURCE_IDS) {
    assert.ok(
      scopesFor(id).includes(proofScopeFor(id)),
      `${id} requires ${proofScopeFor(id)} but never requests it, so it can never be satisfied`,
    );
  }
});

test("no proof scope is a public profile page", () => {
  for (const id of SOURCE_IDS) {
    assert.ok(
      !proofScopeFor(id).endsWith(".profile"),
      `${id} proves ownership with ${proofScopeFor(id)}, which is the public page and proves nothing`,
    );
  }
});

test("every source asks for at least one thing beyond its public profile", () => {
  for (const id of SOURCE_IDS) {
    const beyondProfile = scopesFor(id).filter((scope) => !scope.endsWith(".profile"));
    assert.ok(
      beyondProfile.length > 0,
      `${id} requests only profile scopes, so the whole read can be served from a public page`,
    );
  }
});

/**
 * YouTube by name, because it is the one that was broken.
 *
 * It asked for `youtube.profile` and nothing else, which is the About page, so
 * a join date could arrive for an account the person had never signed in to. A
 * generic invariant would catch a regression here, but naming it means the
 * failure message says what actually went wrong.
 */
test("youtube requires the private scope that was missing", () => {
  assert.equal(proofScopeFor("youtube"), "youtube.watchLater");
  assert.ok(scopesFor("youtube").includes("youtube.profile"), "the join date is still read");
});

/**
 * Watch Later is requested as proof and read for nothing.
 *
 * `SCOPE_SOURCE` in normalize.ts is the list of scopes that become evidence.
 * Keeping the proof scope out of it is what makes the promise on the connect
 * card true: we ask for it, and we keep none of it, not even the fact that it
 * had anything in it.
 */
test("the youtube proof scope is never turned into evidence", () => {
  assert.ok(
    !ALL_SCOPES.includes("youtube.watchLater"),
    "watchLater has a reader, so Patina is keeping something it said it would not",
  );
});

/**
 * Steam is gone and must not come back by accident.
 *
 * Its connector never signs anybody in: it takes a Steam Web API key and a
 * Steam ID, and a Steam ID is public. So its data could belong to anyone whose
 * ID you can look up, and unlike YouTube there is no private scope to require
 * instead, because all three of its scopes are public.
 */
test("steam is not a source", () => {
  assert.ok(!(SOURCE_IDS as readonly string[]).includes("steam"));
  assert.ok(!SOURCE_ORDER.some((id) => (id as string) === "steam"));
  assert.ok(!ALL_SCOPES.some((scope) => scope.startsWith("steam.")));
});

test("the two tiers plus the paused sources are every source, with nothing counted twice", () => {
  assert.deepEqual(
    [...CORE_ORDER, ...STRENGTHEN_ORDER, ...PAUSED_SOURCES].sort(),
    [...SOURCE_IDS].sort(),
  );
  assert.equal(new Set(SOURCE_ORDER).size, SOURCE_ORDER.length);
});

/**
 * Scopes Vana's server collects from the public page, copied from
 * https://docs.vana.org/applications/collection-and-apps. A proof scope on this
 * list is answerable about somebody else's account, so it proves nothing, and
 * the `.profile` rule above cannot see it because `instagram.posts` does not
 * end in `.profile`. That gap is how Instagram passed every test here while
 * proving nothing.
 */
const VANA_SERVER_SIDE_SCOPES = [
  "github.profile",
  "instagram.profile",
  "instagram.posts",
  "spotify.profile",
  "youtube.profile",
];

test("no offered source has a proof scope Vana collects from public pages", () => {
  for (const id of SOURCE_ORDER) {
    assert.ok(
      !VANA_SERVER_SIDE_SCOPES.includes(proofScopeFor(id)),
      `${id} is offered but proves ownership with ${proofScopeFor(id)}, which Vana reads from the public page`,
    );
  }
});

/**
 * Paused, not removed. The type, the spec and the readers all stay, so taking
 * it out of PAUSED_SOURCES is the whole revival and nothing else has to be
 * rebuilt when the signed-in proof arrives.
 */
test("instagram is paused and not offered", () => {
  assert.equal(isPaused("instagram"), true);
  assert.ok(!SOURCE_ORDER.includes("instagram"), "the connect page must not offer it");
  assert.ok(!CORE_ORDER.includes("instagram"));
  assert.ok(!STRENGTHEN_ORDER.includes("instagram"));

  assert.ok((SOURCE_IDS as readonly string[]).includes("instagram"), "the type stays");
  assert.equal(SOURCE_SPECS.instagram.id, "instagram", "the spec stays");
  assert.ok(ALL_SCOPES.includes("instagram.posts"), "the reader stays");

  assert.equal(
    pausedMessage("instagram"),
    "Instagram is paused. Patina cannot yet prove an Instagram account belongs to the person connecting it.",
  );
  for (const id of SOURCE_ORDER) assert.equal(isPaused(id), false, `${id} is offered and paused`);
});

test("a refusal names the source and points at the desktop app", () => {
  const message = proofMissingMessage("youtube");
  assert.match(message, /YouTube/, "the person needs to know which one failed");
  assert.match(message, /Vana Desktop/, "and what to do about it");
});
