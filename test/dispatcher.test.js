// Baseline tests. They document what the naive dispatcher does today.
// When Story 1 lands, some of these tests SHOULD change — that's expected.
// Run with: npm test

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { dispatch } from "../src/dispatcher.js";
import { resetFleet, getFleet } from "../src/services/fleet.js";

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

test("assigns a pending parcel to some idle drone", () => {
  const parcels = [makeParcel()];
  const result = dispatch(parcels);

  assert.equal(result.length, 1);
  assert.equal(parcels[0].status, "ASSIGNED");
});

test("processes parcels in creation order", () => {
  const parcels = [
    makeParcel({ id: "AWB-B", createdAt: "2026-07-24T09:00:00Z" }),
    makeParcel({ id: "AWB-A", createdAt: "2026-07-24T08:00:00Z" }),
  ];
  const result = dispatch(parcels);

  assert.equal(result[0].parcelId, "AWB-A");
  assert.equal(result[1].parcelId, "AWB-B");
});

test("leaves parcels pending when no drone is idle", () => {
  for (const drone of getFleet()) drone.status = "DELIVERING";
  const parcels = [makeParcel()];
  const result = dispatch(parcels);

  assert.equal(result.length, 0);
  assert.equal(parcels[0].status, "PENDING");
});

// This test documents a KNOWN FLAW: the dispatcher happily overloads a drone.
// Story 1's definition of done includes making this impossible.
test("currently ignores payload capacity (known flaw)", () => {
  const parcels = [makeParcel({ weightKg: 99 })];
  const result = dispatch(parcels);

  assert.equal(result.length, 1, "a 99 kg parcel got assigned anyway");
});
