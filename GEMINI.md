# GEMINI.md — Dedeman Drone Dispatch Demo

**Canonical guidance for Gemini and AI coding agents working in this repository.**

This repository is a fast, interactive demo and workshop lab for drone delivery logistics and dispatching. It simulates a fleet of delivery drones operating across regional hubs and delivery zones, showcasing smart dispatch algorithms, fleet telemetry, live weather constraints, and an operations dashboard.

---

## 1. Quick Reference & Commands

- **Runtime:** Node.js 20+ (ES Modules, `"type": "module"`).
- **Dependencies:** Minimalist stack — Express is the sole production dependency. No build step, no bundling, no external DB.
- **Install dependencies:** `npm install`
- **Start dev server (auto-reloading):** `npm run dev` (`node --watch src/server.js`)
- **Start production server:** `npm start`
- **Run test suite:** `npm test` (`node --test`)
- **Endpoints:**
  - Operations Dashboard: [http://localhost:3000/](http://localhost:3000/)
  - Parcels API: [http://localhost:3000/api/parcels](http://localhost:3000/api/parcels)
  - Fleet Telemetry API: [http://localhost:3000/api/drones](http://localhost:3000/api/drones)
  - Zones API: [http://localhost:3000/api/zones](http://localhost:3000/api/zones)
  - Weather API: [http://localhost:3000/api/weather](http://localhost:3000/api/weather)
  - Assignments API: [http://localhost:3000/api/assignments](http://localhost:3000/api/assignments)
  - Trigger Dispatch: `POST http://localhost:3000/api/dispatch`
  - Create Parcel: `POST http://localhost:3000/api/parcels`
  - Reset Simulation: `POST http://localhost:3000/api/reset`

---

## 2. Architecture & File Layout

```
dedeman-drone/
├── data/
│   ├── drones.json          # Seed fleet: 10 drones across 3 hubs (models, payloads, batteries)
│   ├── parcels.json         # Seed parcels: weights, zones, priorities (STANDARD / EXPRESS)
│   └── zones.json           # 8 delivery zones with coordinates & distances to each hub
├── src/
│   ├── server.js            # Express API server, in-memory state store, and simulation loop
│   ├── dispatcher.js        # Dispatch algorithm matching parcels to qualifying drones
│   └── services/
│       ├── fleet.js         # Telemetry simulation (battery drain, charging, jitter, state)
│       └── weather.js       # Deterministic epoch-based weather simulation (wind, rain, no-fly)
├── public/
│   └── index.html           # Vanilla HTML/CSS/JS operations dashboard
├── test/
│   └── dispatcher.test.js   # Deterministic unit tests with node:test & node:assert
├── CONTRACT.md              # Shared interface contract between Story 1 and Story 2 teams
├── STORY-1-smart-dispatch.md# Specification for backend dispatcher rules
├── STORY-2-live-tracking.md # Specification for live operations dashboard
├── STORY-3-cloud-migration.md# Specification for GCP migration, Terraform & DB decisions
├── GEMINI.md                # This file (AI context & instructions)
├── AGENTS.md                # Pointer to GEMINI.md for cross-agent compatibility
└── package.json             # ES Module configuration and test/dev scripts
```

### In-Memory State & Simulation
- Everything runs in memory. No database or external services are used.
- `src/server.js` maintains active state for `parcels`, `assignments`, and the fleet telemetry.
- Simulation ticker: `setInterval(tick, 3000)` simulates battery drain for busy drones (`-2%` per tick), charging for idle drones at base, and random position drift.
- When battery hits `0%`, drone transitions to `EMERGENCY_LANDED`.
- Simulation can be restored to seed state at any time via `POST /api/reset` or by restarting the process.

---

## 3. Data Models & The Assignment Contract

The interface between the backend dispatcher and frontend dashboard is governed by `CONTRACT.md`. **Do not break or unilaterally alter this contract.**

### Assignment Object (`CONTRACT.md`)
Returned by `POST /api/dispatch` and queried via `GET /api/assignments`:
```json
{
  "id": "ASG-AWB-1001-DR-01",
  "parcelId": "AWB-1001",
  "droneId": "DR-01",
  "createdAt": "2026-07-24T08:15:00.000Z",
  "reason": "DR-01 (Sparrow) from HUB-NORD: carries 0.8 kg (max 2 kg), 11.0 km usable range covers 4.2 km round trip to Pipera, weather clear",
  "estimatedMinutes": 3
}
```

### Unassignable Parcels
When a parcel cannot be dispatched (e.g., overweight, no battery, no-fly weather, all drones busy):
- `droneId`: `null`
- `estimatedMinutes`: `null`
- `reason`: Descriptive explanation for the operator (e.g., `"no-fly weather in Pipera (wind 48 km/h, rain none)"`)
- Parcel status remains `PENDING`

---

## 4. Business Rules & Dispatch Logic (Story 1)

1. **Priority Ordering:**
   - Parcels with `priority: "EXPRESS"` are dispatched before `"STANDARD"`.
   - Within the same priority tier, older parcels (`createdAt` ascending) are prioritized.
2. **Payload Capacity:**
   - Drone models:
     - `Sparrow`: 2.0 kg max payload, 12 km max range
     - `Heron`: 5.0 kg max payload, 20 km max range
     - `Albatros`: 12.0 kg max payload, 35 km max range
   - Hard rule: `drone.maxPayloadKg >= parcel.weightKg`.
3. **Range & Battery (Round-Trip):**
   - Usable range = `(drone.rangeKm * drone.batteryPct) / 100`.
   - Round trip distance = `2 * zone.distanceKm[drone.base]`.
   - Hard rule: `usableRangeKm >= roundTripDistanceKm`.
4. **Weather Constraints:**
   - Deterministic 5-minute epoch simulation.
   - `noFly` is `true` if `windKmh > 45` or `rain === "heavy"`.
   - Hard rule: Never dispatch a drone into a zone with `noFly === true`.
5. **Cruise Speed & Travel Time:**
   - Cruise speed: `40 km/h` one-way.
   - Estimated minutes: `Math.round((distanceKm / 40) * 60)`.
6. **Reason Logging:**
   - Every assignment must generate an operator-friendly sentence detailing the decision.

---

## 5. Dashboard Requirements (Story 2)

Dashboard lives strictly in `public/` (plain HTML, CSS, JavaScript, no build tooling).
Key features:
1. **Live Updates:** Polling loop every 2–3 seconds to reflect live telemetry, weather changes, and parcel statuses.
2. **Fleet Health:** Visual battery indicators (OK / Warning / Critical) and clear badges for drone statuses (`IDLE`, `DELIVERING`, `CHARGING`, `MAINTENANCE`, `EMERGENCY_LANDED`).
3. **Weather Panel:** Zone-by-zone wind, rain, and unmistakable `NO FLY` warnings.
4. **Needs Attention Panel:** Dedicated section for unassigned parcels (`droneId: null`) displaying failure reasons.
5. **Interactive Controls:** "Run dispatch" action button and an edge-case parcel injection form (`POST /api/parcels`).

---

## 6. Coding & Contribution Conventions

- **Vanilla JavaScript (ES Modules):** Always use standard `import`/`export`. Never add TypeScript, Babel, or Webpack builds unless explicitly requested.
- **Additive API Changes:** New fields may be added to API responses, but existing fields must never be removed or renamed.
- **Testing:**
  - All unit tests live in `test/` and run via `node --test`.
  - Use `node:assert/strict`.
  - Ensure tests are deterministic: use the `findNow({ flyable, noFly })` helper to pin the weather epoch when testing weather-dependent rules.
- **Keep it Simple & Self-Contained:** Zero external infrastructure dependencies. No DB setups, cloud credentials, or external API keys are required.
