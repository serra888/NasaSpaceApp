# Orbiton frontend

React/Vite frontend connected to the Orbiton FastAPI backend. Use Node.js 22.12+ (or 20.19+) and npm.

## Run locally

Start the backend on port 8000 using `../backend/README.md`, including migrations, seed and the separate simulator. Then, from `frontend/`:

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Vite proxies `/api` to `http://127.0.0.1:8000`, so Windows and WSL can use the same frontend commands. If the backend uses another reachable address, copy `.env.example` to `.env`, set `BACKEND_URL`, and restart Vite. Windows PowerShell: `Copy-Item .env.example .env`; WSL: `cp .env.example .env` (only if no existing file).

## Connected behavior

- Status, daily tasks and daily dashboard history refresh every five seconds.
- Health and Mood are server scores. Missing values remain unavailable and stale scores are labeled.
- Connection rating is converted to `loneliness = 6 - connection`.
- Saving a check-in creates/reuses server missions. A short note is saved separately to `/journal`. If note saving fails after a successful check-in, use **Save note only** to retry without duplicating the check-in.
- Completion is persisted with PATCH `/todos/{id}`. Buttons are disabled during pending writes.
- Dates come from the backend; artificial next-day advancement is removed. Chart buckets are UTC.
- Start-here selection and review acknowledgement are session-only presentation controls; they do not imply additional backend persistence.
- Disconnected state shows an error and keeps the last received values. No mock scores or tasks are substituted.
- The original demo-data module remains for form definitions and existing demo tests; the running app uses no mock readings, local scoring, task generation or localStorage health records.

## Build and deploy

```sh
npm test
npm run build
```

The production host must proxy `/api` to FastAPI, or set `VITE_API_BASE_URL` to the public backend origin **before building** and allow the frontend origin in backend `CORS_ORIGINS`. `BACKEND_URL` affects the development proxy only. Never place AI secrets in `VITE_` variables.

The astronaut assets and original visual layout are retained from the frontend branch.

## Integration verification

`npm test` covers request methods/error propagation, connection-to-loneliness conversion, task identity/completion mapping, and missing chart data. `npm run build` verifies the production bundle. A live PostgreSQL/browser end-to-end run is still required before merging: start the backend and simulator, save a check-in, complete a mission, reload and confirm persistence, inspect both charts, and stop/restart the API to check disconnected recovery.
