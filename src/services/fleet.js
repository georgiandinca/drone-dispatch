// Mock fleet telemetry service.
// Simulates drone state over time: battery drain while busy, slow charge while
// charging, and a small position jitter so the fleet feels alive.
// All state lives in memory; restart the server to reset.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = join(__dirname, "..", "..", "data", "drones.json");

let drones = JSON.parse(readFileSync(seedPath, "utf8"));

/** All drones with live telemetry. */
export function getFleet() {
  return drones;
}

/** A single drone by id, or undefined. */
export function getDrone(id) {
  return drones.find((d) => d.id === id);
}

/** Mark a drone as delivering. Used by the dispatcher. */
export function markBusy(id) {
  const drone = getDrone(id);
  if (drone) drone.status = "DELIVERING";
  return drone;
}

/** Reset fleet to seed data (used by tests and the /reset endpoint). */
export function resetFleet() {
  drones = JSON.parse(readFileSync(seedPath, "utf8"));
}

// --- Simulation tick -------------------------------------------------------
// Called on an interval by the server. Not a public API for the stories;
// stories should read state via getFleet().

export function tick() {
  for (const drone of drones) {
    if (drone.status === "DELIVERING") {
      drone.batteryPct = Math.max(0, drone.batteryPct - 2);
      drone.position.lat += (Math.random() - 0.5) * 0.002;
      drone.position.lng += (Math.random() - 0.5) * 0.002;
      if (drone.batteryPct === 0) {
        drone.status = "EMERGENCY_LANDED"; // TODO: nobody handles this today
      }
    } else if (drone.status === "CHARGING") {
      drone.batteryPct = Math.min(100, drone.batteryPct + 5);
      if (drone.batteryPct === 100) drone.status = "IDLE";
    }
  }
}
