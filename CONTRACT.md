# CONTRACT.md — the seam between Story 1 and Story 2

Two teams work in parallel on this codebase. This file is the agreement that
makes the merge painless. **Neither team changes this contract unilaterally.**
If you need a change, both teams agree first and update this file in the same
commit.

## Ownership

| Area | Owner |
|---|---|
| `src/dispatcher.js`, `src/services/*` | Story 1 team |
| `public/*` (dashboard) | Story 2 team |
| `src/server.js` routes | Shared — additive changes only |
| This file | Both teams, together |

## The Assignment object

Returned by `POST /api/dispatch` and listed by `GET /api/assignments`.

```json
{
  "id": "ASG-AWB-1001-DR-01",
  "parcelId": "AWB-1001",
  "droneId": "DR-01",
  "createdAt": "2026-07-24T08:15:00.000Z",
  "reason": "human-readable explanation of why this drone was chosen",
  "estimatedMinutes": 14
}
```

Rules:

- **Story 1 produces it, Story 2 consumes it.**
- Fields may be **added**, never renamed or removed, during the lab.
- `reason` must become a real explanation (Story 1's output feeds Story 2's UI).
  Examples: `"closest hub with battery margin"`, `"only Albatros can carry 11 kg"`.
- `estimatedMinutes` should become a number once Story 1 computes routes.
- If a parcel **cannot** be assigned, Story 1 exposes that too — as an
  Assignment with `"droneId": null` and a `reason`
  (e.g. `"no drone can carry 14.5 kg"`), so Story 2 can show it.

## Read endpoints (stable, both teams may rely on them)

| Endpoint | Returns |
|---|---|
| `GET /api/parcels` | all parcels with `status` |
| `GET /api/drones` | live fleet telemetry |
| `GET /api/zones` | zones with per-hub distances |
| `GET /api/weather` | weather per zone, incl. `noFly` flag |
| `GET /api/assignments` | all assignments so far |

## Merge plan (end of lab)

1. Story 1 merges to `main` first (API is the foundation).
2. Story 2 rebases on `main`, verifies the dashboard against the real API.
3. Combined demo: reset → run dispatch → dashboard shows *smart* assignments
   with reasons, unassignable parcels flagged, no-fly zones respected.
