// The dispatcher assigns pending parcels to drones.
//
// Current strategy: first-come, first-served.
//   - Parcels are processed in creation order.
//   - Each parcel goes to the first drone with status IDLE.
//   - That's it. Battery, payload, distance and weather are ignored.
//
// It "works" — parcels get assigned — but it routinely sends a 2 kg-capacity
// Sparrow to carry an 11 kg parcel through a storm with 15% battery.
// Improving this is Story 1 (see STORY-1-smart-dispatch.md).

import { getFleet, markBusy } from "./services/fleet.js";

/**
 * Assign pending parcels to available drones.
 *
 * @param {Array} parcels - all parcels (any status)
 * @returns {Array<Assignment>} new assignments created by this run
 *
 * Assignment shape is the shared contract between Story 1 and Story 2 —
 * see CONTRACT.md before changing it.
 */
export function dispatch(parcels) {
  const assignments = [];
  const pending = parcels
    .filter((p) => p.status === "PENDING")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const parcel of pending) {
    const drone = getFleet().find((d) => d.status === "IDLE");
    if (!drone) break; // no drones left; remaining parcels stay PENDING

    markBusy(drone.id);
    parcel.status = "ASSIGNED";

    assignments.push({
      id: `ASG-${parcel.id}-${drone.id}`,
      parcelId: parcel.id,
      droneId: drone.id,
      createdAt: new Date().toISOString(),
      reason: "first available drone", // Story 2 wants real reasons here
      estimatedMinutes: null,           // TODO: never implemented
    });
  }

  return assignments;
}
