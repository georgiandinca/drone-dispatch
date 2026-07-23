# Story 1 — Smart dispatch

> **As a** dispatch operator
> **I want** parcels assigned to drones that can actually complete the delivery
> **So that** we stop overloading drones, stranding them mid-flight, or sending
> them into storms.

## Background

The current dispatcher (`src/dispatcher.js`) assigns each pending parcel to the
first idle drone, in order of arrival. It ignores payload capacity, battery,
distance, and weather. The baseline test suite documents this — including one
test that explicitly asserts the flaw.

## Acceptance criteria

1. **Payload:** a parcel is never assigned to a drone with
   `maxPayloadKg < weightKg`.
2. **Range & battery:** a drone is only assigned if it can make the round trip
   from its hub to the parcel's zone and back. Assume usable range =
   `rangeKm × batteryPct / 100`. Round trip = `2 × distanceKm` from the drone's
   base hub (see `data/zones.json`).
3. **Weather:** no assignment into a zone where `GET /api/weather` reports
   `noFly: true`.
4. **Priority:** `EXPRESS` parcels are considered before `STANDARD` ones;
   within the same priority, older parcels first.
5. **Unassignable parcels:** when no drone qualifies, produce an Assignment
   with `droneId: null` and a `reason` explaining why (see CONTRACT.md).
   The parcel stays `PENDING`.
6. **Reasons:** every assignment's `reason` explains the choice in a sentence a
   dispatcher would understand.
7. **Estimate:** fill `estimatedMinutes` assuming a cruise speed of 40 km/h
   one-way to the zone.
8. All existing tests updated or replaced; new rules covered by tests
   (including at least: overweight parcel, low-battery drone, no-fly zone,
   express-before-standard).

## Out of scope

- Multi-parcel routes, drone return logistics, charging strategy.
- Anything in `public/` — that's Story 2's territory.

## Definition of done

- `npm test` green, with tests that would fail if any rule above regressed.
- `POST /api/dispatch` on the seed data produces zero rule violations.
- CONTRACT.md still honored (fields added, none renamed/removed).

## Suggested AI workflow (the actual exercise)

1. Ask your AI client to explain the current dispatcher and its flaws.
2. Have it draft a test list from these acceptance criteria — review it as a
   team *before* writing implementation code.
3. Implement rule by rule, running `npm test` between steps.
4. Ask the AI to review its own diff against this story and CONTRACT.md.
