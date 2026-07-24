// Story 1 tests — smart dispatch rules.
// Weather is deterministic per zone per 5-minute epoch, so each test pins
// `now` to an epoch with the conditions it needs (found via findNow below).
// Run with: npm test

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { dispatch } from "../src/dispatcher.js";
import { resetFleet, getFleet, getDrone } from "../src/services/fleet.js";
import { getWeather } from "../src/services/weather.js";

const EPOCH_MS = 5 * 60 * 1000;

// Scan epochs to find a `now` where every zone in `flyable` is clear and
// every zone in `noFly` is a no-fly zone. Deterministic, so stable per run.
function findNow({ flyable = [], noFly = [] }) {
  for (let i = 0; i < 10_000; i++) {
    const now = i * EPOCH_MS;
    if (
      flyable.every((z) => !getWeather(z, now).noFly) &&
      noFly.every((z) => getWeather(z, now).noFly)
    ) {
      return now;
    }
  }
  throw new Error("no epoch found with the requested weather");
}

const CLEAR_PIPERA = findNow({ flyable: ["Z-PIPERA"] });

function makeParcel(overrides = {}) {
  return {
    id: "AWB-TEST",
    weightKg: 1.0,
    zoneId: "Z-PIPERA",
    priority: "STANDARD",
    createdAt: "2026-07-24T08:00:00Z",
    status: "PENDING",
    ...overrides,
  };
}

beforeEach(() => resetFleet());

test("assigns a pending parcel to a qualifying idle drone", () => {
  const parcels = [makeParcel()];
  const [asg] = dispatch(parcels, { now: CLEAR_PIPERA });

  assert.ok(asg.droneId, "expected a drone to be assigned");
  assert.equal(parcels[0].status, "ASSIGNED");
  assert.equal(getDrone(asg.droneId).status, "DELIVERING");
});

test("never assigns an overweight parcel", () => {
  const parcels = [makeParcel({ weightKg: 99 })];
  const [asg] = dispatch(parcels, { now: CLEAR_PIPERA });

  assert.equal(asg.droneId, null);
  assert.equal(parcels[0].status, "PENDING");
  assert.match(asg.reason, /99 kg/);
});

test("respects payload capacity when choosing among drones", () => {
  // 6 kg exceeds Sparrow (2 kg) and Heron (5 kg); only an Albatros fits.
  const parcels = [makeParcel({ weightKg: 6 })];
  const [asg] = dispatch(parcels, { now: CLEAR_PIPERA });

  assert.ok(asg.droneId);
  assert.equal(getDrone(asg.droneId).model, "Albatros");
});

test("never assigns a drone without round-trip range on current battery", () => {
  // Leave only DR-02 idle: Sparrow, 12 km range at 34% = 4.08 km usable.
  // Z-PIPERA from HUB-NORD is 2.1 km, round trip 4.2 km — just short.
  for (const d of getFleet()) if (d.id !== "DR-02") d.status = "MAINTENANCE";
  const parcels = [makeParcel()];
  const [asg] = dispatch(parcels, { now: CLEAR_PIPERA });

  assert.equal(asg.droneId, null);
  assert.equal(parcels[0].status, "PENDING");
  assert.match(asg.reason, /battery|round trip/i);
});

test("assigns when usable range exactly covers the round trip", () => {
  // DR-02 at 35%: 12 * 0.35 = 4.2 km usable = exactly the 4.2 km round trip.
  for (const d of getFleet()) if (d.id !== "DR-02") d.status = "MAINTENANCE";
  getDrone("DR-02").batteryPct = 35;
  const [asg] = dispatch([makeParcel()], { now: CLEAR_PIPERA });

  assert.equal(asg.droneId, "DR-02");
});

test("never assigns into a no-fly zone", () => {
  const now = findNow({ noFly: ["Z-PIPERA"] });
  const parcels = [makeParcel()];
  const [asg] = dispatch(parcels, { now });

  assert.equal(asg.droneId, null);
  assert.equal(parcels[0].status, "PENDING");
  assert.match(asg.reason, /no-fly|weather/i);
  // No drone was marked busy for a weather rejection.
  assert.ok(getFleet().every((d) => d.status !== "DELIVERING"));
});

test("processes EXPRESS before STANDARD, oldest first within a priority", () => {
  const parcels = [
    makeParcel({ id: "AWB-STD-OLD", priority: "STANDARD", createdAt: "2026-07-24T07:00:00Z" }),
    makeParcel({ id: "AWB-EXP-NEW", priority: "EXPRESS", createdAt: "2026-07-24T09:00:00Z" }),
    makeParcel({ id: "AWB-EXP-OLD", priority: "EXPRESS", createdAt: "2026-07-24T08:00:00Z" }),
  ];
  const result = dispatch(parcels, { now: CLEAR_PIPERA });

  assert.deepEqual(
    result.map((a) => a.parcelId),
    ["AWB-EXP-OLD", "AWB-EXP-NEW", "AWB-STD-OLD"],
  );
});

test("produces an unassignable assignment when no drone is idle", () => {
  for (const d of getFleet()) d.status = "DELIVERING";
  const parcels = [makeParcel()];
  const result = dispatch(parcels, { now: CLEAR_PIPERA });

  assert.equal(result.length, 1);
  assert.equal(result[0].droneId, null);
  assert.equal(result[0].estimatedMinutes, null);
  assert.equal(parcels[0].status, "PENDING");
  assert.match(result[0].reason, /no idle drones/i);
});

test("fills estimatedMinutes at 40 km/h one-way", () => {
  // Force assignment from HUB-NORD (2.1 km to Z-PIPERA): 2.1/40*60 ≈ 3 min.
  for (const d of getFleet()) if (d.base !== "HUB-NORD") d.status = "MAINTENANCE";
  const [asg] = dispatch([makeParcel()], { now: CLEAR_PIPERA });

  assert.ok(asg.droneId);
  assert.equal(asg.estimatedMinutes, 3);
});

test("marks only successfully selected drones busy", () => {
  const parcels = [
    makeParcel({ id: "AWB-OK" }),
    makeParcel({ id: "AWB-FAT", weightKg: 99 }),
  ];
  dispatch(parcels, { now: CLEAR_PIPERA });

  const delivering = getFleet().filter((d) => d.status === "DELIVERING");
  assert.equal(delivering.length, 1);
});

test("every assignment has an operator-readable reason", () => {
  const parcels = [makeParcel(), makeParcel({ id: "AWB-FAT", weightKg: 99 })];
  const result = dispatch(parcels, { now: CLEAR_PIPERA });

  for (const asg of result) {
    assert.equal(typeof asg.reason, "string");
    assert.ok(asg.reason.length > 20, `reason too terse: "${asg.reason}"`);
  }
});

test("ignores non-PENDING parcels", () => {
  const parcels = [makeParcel({ status: "ASSIGNED" })];
  const result = dispatch(parcels, { now: CLEAR_PIPERA });

  assert.equal(result.length, 0);
});
