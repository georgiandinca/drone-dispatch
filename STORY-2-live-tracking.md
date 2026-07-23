# Story 2 — Live operations dashboard

> **As a** dispatch operator
> **I want** a live view of drones, parcels, weather and assignment decisions
> **So that** I can trust the dispatcher and explain any delivery to a
> customer in ten seconds.

## Background

The current dashboard (`public/index.html`) shows three static tables and a
refresh button. It doesn't update on its own, shows no weather, and gives no
insight into *why* a parcel went to a drone — the `reason` column just says
"first available drone".

## Acceptance criteria

1. **Live updates:** the dashboard refreshes itself (polling every few seconds
   is fine — no websockets required).
2. **Fleet health:** each drone shows battery as a visual indicator with clear
   states (e.g. OK / low / critical), plus its status. `EMERGENCY_LANDED`
   drones must be impossible to miss.
3. **Weather panel:** show all zones with wind, rain, and an unmistakable
   no-fly marker, using `GET /api/weather`.
4. **Assignment insight:** every assignment displays its `reason` and
   `estimatedMinutes`. Unassigned parcels (`droneId: null`) appear in a
   distinct "needs attention" list with their reason.
5. **Operator actions:** keep "Run dispatch"; add a small form to create a
   parcel (`POST /api/parcels`) so the room can inject edge cases live.
6. **Empty & error states:** no blank white screens — every panel says
   something useful when there's no data or the API fails.

## Out of scope

- Changing anything under `src/` — that's Story 1's territory.
- Authentication, persistence, mobile app.

## Constraints

- Stay in `public/` — plain HTML/CSS/JS, no build step, no framework install.
  (Your AI client is very good at vanilla JS; let it prove it.)
- Build against the **current** API shape plus CONTRACT.md. Until Story 1
  merges, `reason` will be boring and `estimatedMinutes` null — design for the
  contract, not for today's data.

## Definition of done

- Combined demo works after merging Story 1: reset → dispatch → the room can
  see smart assignments, reasons, a no-fly zone being avoided, and an
  unassignable parcel flagged — without anyone explaining the screen.

## Suggested AI workflow (the actual exercise)

1. Ask your AI client to sketch the layout from these criteria — POs/PMs judge
   whether an operator could actually use it.
2. Build panel by panel; after each, reload and critique together.
3. Test the "needs attention" list by mocking an assignment with
   `droneId: null` before Story 1 is merged.
4. Ask the AI to review the final UI against every acceptance criterion.
