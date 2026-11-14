# Orbiton Backend

FastAPI + PostgreSQL backend for the Orbiton astronaut health companion. All data, scores, alerts, and tasks are hackathon demo behavior, not clinical assessment. The MVP has one shared demo astronaut and no authentication.

## Quick start

Run these commands from `backend/` with Python 3.12+ and Docker Compose available:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.lock
cp .env.example .env
docker compose up -d --wait
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, from `backend/` with the same environment activated:

```bash
python -m app.simulator
```

Open `http://localhost:8000/docs` for interactive OpenAPI. Frontend should poll `GET /api/v1/status` every five seconds. `GET /health` is liveness; `GET /ready` checks the database and demo astronaut. A fresh database is initialized explicitly by migration and seed, never automatically by importing the API.

If PostgreSQL already runs locally, skip Compose and set `DATABASE_URL` accordingly. Use `postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE`. The Compose credentials are local development defaults; the port binds only to localhost. Persistent data lives in the `orbiton_postgres` Docker volume. `docker compose down` preserves the data.

## Configuration and secrets

`.env` is loaded relative to this directory regardless of the current working directory, and is ignored by Git. `.env.example` contains placeholders only. Environment variables override the file. Never commit provider keys.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection using the psycopg 3 driver |
| `TEST_DATABASE_URL` | Dedicated test database; name must end in `_test` |
| `CORS_ORIGINS` | JSON array of allowed frontend origins |
| `MISSION_TIMEZONE` | IANA timezone used to decide the current mission date; default UTC |
| `DEMO_ASTRONAUT_ID` | Shared astronaut identifier; run seed after changing it |
| `SIMULATOR_INTERVAL_SECONDS` | New sensor record interval; default 5 |
| `MEASUREMENT_STALE_SECONDS` | Measurement freshness limit; default 30 |
| `CHECKIN_STALE_HOURS` | Check-in freshness limit; default 24 |
| `AI_SERVICE_URL` | Full HTTP endpoint implementing the AI contract; empty uses fallback |
| `AI_SERVICE_TOKEN` | Optional bearer token for backend-to-AI requests |
| `AI_TIMEOUT_SECONDS` | AI HTTP operation timeout; default 8 |
| `OPENAI_API_KEY` | Reserved for the AI developer's provider client; unused by this backend |

The AI developer owns provider selection, prompts, and provider keys. This backend calls the agreed AI service and validates its response. Setting `OPENAI_API_KEY` alone does not enable AI generation. Free-text journal and symptom notes are stored locally and excluded from the AI payload.

## Simulator and fixtures

`python -m app.seed` inserts seven days of hourly sensor history and daily check-ins only if those record types are absent. It preserves existing data and can be rerun. It does not run a live stream or create daily missions.

The simulator is a separate process that inserts a new database row every five seconds. A PostgreSQL advisory lock prevents two simulator processes against the same database. API reloads do not start simulators.

```bash
python -m app.simulator --scenario normal
python -m app.simulator --scenario low-sleep
python -m app.simulator --scenario missing-data
python -m app.simulator --scenario flagged --count 3
```

Stop the previous simulator before changing scenarios. `--count 0` runs continuously. Heart rate, oxygen, and temperature follow deterministic small changes; sleep is stable for a UTC day and steps are a cumulative daily demo counter. Daily steps reset at UTC midnight. Source is `seed` or `simulator` and must be visible in the UI. Scenario changes are deliberate demo events, not actual physiology.

## Tests

Unit tests run without a database:

```bash
pytest -q -m 'not integration'
ruff check .
ruff format --check .
```

For integration tests, create a separate empty database and export its URL. Tests do not read `TEST_DATABASE_URL` from `.env` automatically, to avoid accidental database changes:

```bash
docker compose exec db createdb -U orbiton orbiton_test
export TEST_DATABASE_URL='postgresql+psycopg://orbiton:orbiton_local@localhost:5432/orbiton_test'
pytest -q
```

Integration fixtures apply migrations and clear application tables in the specified test database before each test. URLs pointing to a database whose name does not end in `_test` are rejected. Tests cover persistence, concurrent generation, task refresh, input validation, scoring, simulation, dashboard aggregation, and AI validation/fallback. Without `TEST_DATABASE_URL`, integration tests are explicitly skipped.

Check schema drift with `alembic check`. Generate future migrations with `alembic revision --autogenerate -m "Describe the change"`, review the generated file, then run `alembic upgrade head`.

## Team integration

- Backend developer owns `backend/` and `docs/api/`.
- Frontend developer owns `frontend/`; consume the HTTP API rather than duplicating score formulas.
- AI developer owns `ai/`; implement the [AI service contract](../docs/api/ai-contract.md).
- Frontend integration, examples, error format, dates, and refresh behavior: [API contract](../docs/api/README.md).
- Machine-readable API: [OpenAPI snapshot](../docs/api/openapi.json). Regenerate it after endpoint/schema changes using `python -m app.export_openapi`.

Use separate feature branches for frontend and AI, based on the agreed base commit. Do not edit another developer's owned directories. Communicate API contract changes before merging them. The `backend` branch can be merged without bringing in frontend or AI implementations.

## MVP boundaries

No accounts, authorization, real wearables, WebSocket, radiation scoring, 3D assets, or provider-specific AI client are included. The demo astronaut is shared across every browser connected to the same backend. Bind to localhost for local development; deployment with real users requires a separate access-control design. Existing generated tasks remain unchanged on later check-ins unless the caller explicitly requests refresh.
