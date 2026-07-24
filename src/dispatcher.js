// The dispatcher assigns pending parcels to drones.
//
// Smart strategy (Story 1, see STORY-1-smart-dispatch.md):
//   - EXPRESS parcels are considered before STANDARD; within the same
//     priority, older parcels first.
//   - A drone qualifies only if it can carry the parcel (maxPayloadKg) and
//     make the round trip from its base hub to the parcel's zone and back
//     on its current battery (usable range = rangeKm * batteryPct / 100).
//   - No assignment into a zone whose current weather reports noFly.
//   - When no drone qualifies, an Assignment with droneId: null and an
//     explanatory reason is produced and the parcel stays PENDING.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { getFleet, markBusy } from "./services/fleet.js";
import { getWeather } from "./services/weather.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const zonesPath = join(__dirname, "..", "data", "zones.json");
const zones = JSON.parse(readFileSync(zonesPath, "utf8"));

const CRUISE_SPEED_KMH = 40;

const PRIORITY_ORDER = { EXPRESS: 0, STANDARD: 1 };

function byPriorityThenAge(a, b) {
  const pa = PRIORITY_ORDER[a.priority] ?? 1;
  const pb = PRIORITY_ORDER[b.priority] ?? 1;
  if (pa !== pb) return pa - pb;
  return a.createdAt.localeCompare(b.createdAt);
}

function usableRangeKm(drone) {
  return (drone.rangeKm * drone.batteryPct) / 100;
}

/**
 * Assign pending parcels to available drones.
 *
 * @param {Array} parcels - all parcels (any status)
 * @param {{ now?: number }} [options] - optional; `now` pins the weather
 *   epoch so runs (and tests) are deterministic. Defaults to Date.now().
 * @returns {Array<Assignment>} new assignments created by this run
 *
 * Assignment shape is the shared contract between Story 1 and Story 2 —
 * see CONTRACT.md before changing it.
 */
export function dispatch(parcels, { now = Date.now() } = {}) {
  const assignments = [];
  const pending = parcels
    .filter((p) => p.status === "PENDING")
    .sort(byPriorityThenAge);

  for (const parcel of pending) {
    const zone = zones.find((z) => z.id === parcel.zoneId);
    if (!zone) {
      assignments.push(unassignable(parcel, `unknown zone ${parcel.zoneId} — cannot plan a route`));
      continue;
    }

    const weather = getWeather(zone.id, now);
    if (weather.noFly) {
      assignments.push(unassignable(
        parcel,
        `no-fly weather in ${zone.name} (wind ${weather.windKmh} km/h, rain ${weather.rain})`,
      ));
      continue;
    }

    const idle = getFleet().filter((d) => d.status === "IDLE");
    if (idle.length === 0) {
      assignments.push(unassignable(parcel, "no idle drones available"));
      continue;
    }

    const drone = idle.find((d) => {
      const distanceKm = zone.distanceKm[d.base];
      return (
        d.maxPayloadKg >= parcel.weightKg &&
        distanceKm !== undefined &&
        usableRangeKm(d) >= 2 * distanceKm
      );
    });

    if (!drone) {
      assignments.push(unassignable(
        parcel,
        `no idle drone can carry ${parcel.weightKg} kg and make the ${zone.name} round trip on current battery`,
      ));
      continue;
    }

    const distanceKm = zone.distanceKm[drone.base];
    markBusy(drone.id);
    parcel.status = "ASSIGNED";

    assignments.push({
      id: `ASG-${parcel.id}-${drone.id}`,
      parcelId: parcel.id,
      droneId: drone.id,
      createdAt: new Date().toISOString(),
      reason: `${drone.id} (${drone.model}) from ${drone.base}: carries ${parcel.weightKg} kg (max ${drone.maxPayloadKg} kg), ${usableRangeKm(drone).toFixed(1)} km usable range covers the ${(2 * distanceKm).toFixed(1)} km round trip to ${zone.name}, weather clear`,
      estimatedMinutes: Math.round((distanceKm / CRUISE_SPEED_KMH) * 60),
    });
  }

  return assignments;
}

function unassignable(parcel, reason) {
  return {
    id: `ASG-${parcel.id}-UNASSIGNED`,
    parcelId: parcel.id,
    droneId: null,
    createdAt: new Date().toISOString(),
    reason,
    estimatedMinutes: null,
  };
}
