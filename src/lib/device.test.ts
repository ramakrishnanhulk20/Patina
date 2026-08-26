import test from "node:test";
import assert from "node:assert/strict";

import { isDesktopClass } from "./device.ts";

/**
 * The costs here are lopsided, and the tests are written around that.
 *
 * Calling a desktop a phone shows somebody one extra screen with a link on it.
 * Calling a phone a desktop sends them into a flow they cannot finish, in an
 * app they cannot install, on a page Patina does not control. So the phone
 * cases are the ones worth being thorough about.
 */

const DESKTOP = [
  ["Windows 11 Chrome", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"],
  ["macOS Safari", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"],
  ["Linux Firefox", "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0"],
  ["ChromeOS", "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"],
] as const;

const HANDHELD = [
  ["Android Chrome", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"],
  ["iPhone Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"],
  ["iPad Safari", "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"],
  ["Android tablet", "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"],
  ["Samsung Internet", "Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36"],
  ["Firefox Android", "Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0"],
] as const;

for (const [name, ua] of DESKTOP) {
  test(`${name} can run Vana Desktop`, () => {
    assert.equal(isDesktopClass(ua), true);
  });
}

for (const [name, ua] of HANDHELD) {
  test(`${name} cannot run Vana Desktop`, () => {
    assert.equal(isDesktopClass(ua), false);
  });
}

test("a missing user agent is treated as capable", () => {
  // Bots, curl and privacy tools send nothing. The mobile screen is a helpful
  // redirect rather than a gate, so there is no reason to show it to something
  // that is not a person on a device.
  assert.equal(isDesktopClass(null), true);
  assert.equal(isDesktopClass(undefined), true);
  assert.equal(isDesktopClass(""), true);
});

test("an unrecognised desktop browser is not mistaken for a phone", () => {
  // The check must not fail closed on anything it has not seen. A new browser
  // on a real computer has to keep working.
  assert.equal(isDesktopClass("SomeNewBrowser/1.0 (Windows NT 10.0; Win64; x64)"), true);
});
