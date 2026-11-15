# ORBITONE

A three-page astronaut wellbeing prototype for NASA Space Apps 2026.

- **Home** — Flight status, daily check-in, and separate sleep and mood charts for the last seven days. A fresh demo begins on Mission Day 1. Mood uses the rating submitted under Mood, on its original 1–5 scale.
- **Mission Garden** — One shelf for the signed-in crew member (Alice in this demo), three mock crewmate shelves, and a plant picker. Three required missions are assigned by the demo adapter. Mark each complete and optionally add up to two extra missions.
- **Profile** — Crew name, active mission day and location, a monthly calendar, and a personal journal. The calendar shows the same assigned and optional missions and completion state as the garden. The journal supports reading, saving, editing, deleting, and browsing past entries. A separate demo control advances the mission day.

## Run locally

Use Node.js 20.19+ or 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

## Frontend integration notes

No backend code, schema, endpoints, or credentials are included or changed. Until a real API is connected, `src/demo-data.js` serves the simulated sleep/health readings and stores the garden, mission choices, journal entries and check-ins on the current browser. Historical calendar cells read the same assignments and optional choices; a fresh demo does not invent completed missions. Early legacy mock check-ins are migrated by remapping Mission Day 127 to day 1 without touching the original storage key.

`src/garden-model.js` provides a mock crew/plant snapshot and the five images for each of the three plant choices. The own-shelf plant receives a plant ID and a stage index from that snapshot. Changing the species preserves the stage. The frontend does not derive plant color from unfinished missions. When a live AI adapter is available, replace the demo source for the three required tasks. Journal text currently stays in browser storage and is never sent to a server. The backend can later return mission day, member/location, plant stage, sleep readings and per-day mission records, which should replace the mock inputs.

The hero preloads the original portrait and uses the same visor image for desktop pointer tracking. Mobile and reduced-motion users see the static portrait. The original 3D model is kept in the source for reuse. The optional companion viewer credits [Mercenary Astronaut](https://sketchfab.com/3d-models/mercenary-astronaut-7fd399d488ae4576a0fc62715892956c) by Peter_D under CC BY 4.0. All telemetry and recommendations in this prototype are simulated.
