# ORBITONE frontend

React/Vite interface for the ORBITONE astronaut wellbeing prototype. Home contains the check-in and charts, Mission Garden contains daily missions and the plant picker, and Profile contains the mission calendar and personal journal.

## Run locally

Use Node.js 22.12+ or 20.19+. Start FastAPI on port 8000 using [the backend README](../backend/README.md), including its database setup, migrations, seed, and simulator. From `frontend/`, run:

```sh
npm ci
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8000` by default. To use another reachable backend in development, copy `.env.example` to `.env` if it does not already exist, set `BACKEND_URL`, and restart Vite.

## Data sources

- The server supplies current status, mission date, assigned tasks and dashboard history. The frontend refreshes every five seconds and keeps its last received values if the backend becomes unavailable. It does not substitute local mock health data or assigned missions.
- The Home connection score is converted to `loneliness = 6 - connection` by the API adapter. The optional check-in note is submitted separately to `/journal`. If the check-in succeeds but the note does not, use **Save note only** after checking for a duplicate or clear the unconfirmed note.
- Assigned missions are completed with `PATCH /todos/{id}`. The Profile calendar requests a past date's assigned missions when that date is opened. The mission date follows the server clock, and the charts use UTC date buckets and the backend Mood score on a 0–100 scale.
- The plant picker, optional extra missions and the long-form **Mission Journal** are stored in this browser only. Crew and plant growth visuals remain illustrative. The Home check-in note and the Profile journal are separate.

## Test and deploy

```sh
npm test
npm run build
```

Before merging, run the backend, PostgreSQL, and the simulator together. Verify the check-in, both charts, completion persistence after reloading, past dates in the calendar, and API disconnect/recovery. Open Home, Mission Garden, and Profile directly in the production build as well.

Production hosting must proxy `/api` to FastAPI, or build with `VITE_API_BASE_URL` set to the reachable backend origin and allow the frontend origin in the backend's `CORS_ORIGINS`. `BACKEND_URL` affects the development proxy only. Never place AI secrets in `VITE_` variables.
