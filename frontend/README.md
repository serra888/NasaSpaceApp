# ORBITONE

A single-page astronaut wellbeing prototype for NASA Space Apps 2026. The opening is a scrolling poster followed by status and check-in, one observation, missions, and trends with end-of-day review.

## Run locally

Use Node.js 20.19+ or 22.12+ and npm.

```sh
npm ci
npm run dev
```

Open the Vite URL reported in the terminal. Run `npm test` for data tests and `npm run build` for a production build.

## Integration

- `src/demo-data.js` contains the simulated telemetry, check-in validation and scoring, storage functions, and deterministic mission suggestions. Swap this layer for your team's API adapter when the contract is ready.
- All check-ins, daily missions, and review records are stored per mission day in the current browser. Advancing a demo day adds one simulated reading for that day. Nothing is sent to a server.
- The hero uses the supplied Tripo GLB as a separate helmet layer with React Three Fiber. The 3D renderer projects the original visor photo onto the front to retain its detail. Desktop browsers without WebGL rotate the original photo layer without blending low-resolution poses. Mobile and reduced-motion users see the static photo.
- The companion's right-hand panel shows a portrait first. Its optional Explore in 3D control embeds the Sketchfab embed for [Mercenary Astronaut](https://sketchfab.com/3d-models/mercenary-astronaut-7fd399d488ae4576a0fc62715892956c) by [Peter_D](https://sketchfab.com/better_peter), credited under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The portrait is a cropped preview from the model page. The original can also be opened directly on Sketchfab. Check-in messages link to the daily form, and saved check-ins update Mood, the mood trend, and unlock the day’s demo missions.
- The hero helmet was generated with Tripo Studio. The health index and mission suggestions are illustrative and are not clinical scores, medical advice, real sensor feeds, or live AI.
