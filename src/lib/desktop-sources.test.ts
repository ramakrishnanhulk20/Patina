import { test } from "node:test";
import assert from "node:assert/strict";
import { foldRead, normalizeAmazonOrders, normalizeSteam, normalizeUberTrips } from "./normalize.ts";
import { scorePatina } from "./score.ts";

// The real payload shapes are only truly known once one is captured, so these
// use synthetic data to lock in the logic that matters: the OLDEST date and the
// count, read defensively, and that a desktop source actually feeds Age.

test("amazon orders: keeps the earliest order and the count", () => {
  const n = normalizeAmazonOrders({
    orders: [
      { orderId: "1", orderDate: "2021-05-01" },
      { orderId: "2", orderDate: "2015-03-10" },
      { orderId: "3", orderDate: "2019-01-01" },
    ],
    total: 3,
  });
  assert.equal(n?.orderCount, 3);
  assert.equal(new Date(n!.earliestOrder!).getUTCFullYear(), 2015);
});

test("amazon orders: survives the { data: { orders } } envelope", () => {
  const n = normalizeAmazonOrders({ data: { orders: [{ orderId: "1", orderDate: "2018-02-02" }] } });
  assert.equal(n?.orderCount, 1);
  assert.equal(new Date(n!.earliestOrder!).getUTCFullYear(), 2018);
});

test("uber trips: keeps the earliest trip and the count", () => {
  const n = normalizeUberTrips({
    trips: [
      { id: "a", requestTime: "2020-01-01T00:00:00Z" },
      { id: "b", requestTime: "2016-06-01T00:00:00Z" },
    ],
  });
  assert.equal(n?.tripCount, 2);
  assert.equal(new Date(n!.earliestTrip!).getUTCFullYear(), 2016);
});

test("steam: reads id, persona and accountCreated as an ISO string", () => {
  const n = normalizeSteam({
    steamId: "765",
    personaName: "gamer",
    accountCreated: "2013-08-01T00:00:00Z",
    steamLevel: 42,
  });
  assert.equal(n?.steamId, "765");
  assert.equal(n?.steamLevel, 42);
  assert.equal(new Date(n!.accountCreated!).getUTCFullYear(), 2013);
});

test("steam: also accepts a unix timestamp for account creation", () => {
  const n = normalizeSteam({ steamId: "1", timecreated: 1375315200 }); // 2013-08-01
  assert.equal(new Date(n!.accountCreated!).getUTCFullYear(), 2013);
});

test("empty desktop reads normalise to nothing, so they do not claim a slot", () => {
  assert.equal(normalizeAmazonOrders({ orders: [], total: 0 }), undefined);
  assert.equal(normalizeUberTrips({ trips: [] }), undefined);
  assert.equal(normalizeSteam({}), undefined);
});

test("a desktop source feeds Age through foldRead", () => {
  const evidence = foldRead({}, "steam.profile", {
    steamId: "1",
    accountCreated: "2010-01-01T00:00:00Z",
  });
  const score = scorePatina(evidence);
  const age = score.components.find((c) => c.key === "age");
  assert.ok(age && age.points > 0, "an old Steam account should earn Age points");
});
