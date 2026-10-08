# Drone Dispatch

Lab codebase for the **AI Express** workshop — *First Mile: AI Across the SDLC*.

AeroLogistics is piloting drone deliveries in Bucharest. Three hubs
(Nord, Vest, Sud), a mixed fleet of 10 drones, and a dispatch service that
assigns parcels to drones. The dispatcher works, but it is naive — and the
operations dashboard is bare. Your job today is to improve both, in parallel,
with your AI client doing the heavy lifting.

## Quick start

Requires Node.js 20+.

```bash
npm install
npm run dev
```

- API: http://localhost:3000/api/parcels
- Dashboard: http://localhost:3000/

Run tests:

```bash
npm test
```

Reset the simulation at any time: `POST /api/reset` (or restart the server).

## What's in the box

```
data/            seed data: drones, parcels, zones (JSON, edited freely)
src/server.js    Express API + simulation loop
src/dispatcher.js        the naive dispatcher (Story 1 lives here)
src/services/fleet.js    mock drone telemetry (battery drain, positions)
src/services/weather.js  mock per-zone weather with no-fly conditions
public/index.html        the bare dashboard (Story 2 lives here)
test/            baseline tests (some document known flaws on purpose)
CONTRACT.md      the agreement between the two story teams — read it first
STORY-1-smart-dispatch.md
STORY-2-live-tracking.md
STORY-3-cloud-migration.md
GEMINI.md        AI instructions & context
```

Everything is in memory. No database, no external services, no API keys.

## Pre-assignment (before touching the stories)

This repo ships **without** an AI context file — no CLAUDE.md, no
copilot-instructions, no AGENTS.md. Creating one is your first task, because a
good context file is the difference between an AI that guesses and an AI that
knows your project.

With your team and your AI client of choice:

1. Let the AI explore the repo and draft a context file for itself
   (`CLAUDE.md`, `.github/copilot-instructions.md`, or `AGENTS.md` — whatever
   your client reads).
2. Review the draft as a team. Does it capture the architecture, the data
   shapes, the conventions, the contract in CONTRACT.md, how to run and test?
   What did the AI get wrong or miss?
3. Add what only humans know: your team's conventions, what's out of scope,
   what must never change without agreement.
4. Commit it. From now on, every AI session starts from that file.

Timebox: 15 minutes. There is no "correct" answer — the discussion is the
exercise.

## Conventions

- Plain JavaScript (ES modules), no build step, no new runtime dependencies
  without a good reason.
- Tests use the built-in `node:test` runner.
- API changes are additive only — see CONTRACT.md.
- Small commits with messages that explain *why*.

## The day's flow

1. Pre-assignment: build your AI context file (15 min).
2. Split: Story 1 team and Story 2 team work in parallel on branches.
3. Merge: Story 1 first, then Story 2 rebases (plan in CONTRACT.md).
4. Combined demo: smart dispatch, live dashboard, applause.
