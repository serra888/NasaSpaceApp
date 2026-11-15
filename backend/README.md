# Orbiton Backend

FastAPI + PostgreSQL backend for the Orbiton astronaut health companion. All data, scores, alerts, and tasks are hackathon demo behavior, not clinical assessment. The MVP has one shared demo astronaut and no authentication.

## Prerequisites

Choose one environment: native Windows PowerShell, WSL/Linux, or macOS. WSL is optional. Use **64-bit CPython 3.12** for the team's pinned setup, Git, and Docker with Compose v2 or newer. On Windows/macOS, start Docker Desktop and use Linux containers. A separate PostgreSQL installation is not required. If using WSL, enable Docker Desktop integration for that distribution; native PowerShell does not require a WSL terminal.

On Windows, use the x64 CPython installer for this setup. Preserve platform markers when updating `requirements.lock`; a plain `pip freeze` from one operating system does not capture the other platforms' dependencies.

The pinned file `requirements.lock` includes runtime and test tools. Its platform markers skip `uvloop` on Windows, where Uvicorn uses asyncio. `tzdata` provides IANA timezones when the operating system does not supply them, and Windows console dependencies are included. `requirements.txt` and `requirements-dev.txt` are alternative, version-range installs for dependency maintenance; team members should use `requirements.lock` to share the same pinned versions.

Do not share or reuse a `.venv` between Windows and WSL, or copy one from another computer. Each checkout/environment needs its own virtual environment. If using both on the same machine, use separate checkout directories.

## Get the code

After the backend branch is published, run this in either PowerShell or a Unix shell:

```text
git clone --branch backend https://github.com/serra888/NasaSpaceApp.git
cd NasaSpaceApp
cd backend
```

If the repository is already cloned, switch to `backend` in the repository root, then enter `backend/`. Once backend is merged into the team's main branch, clone that branch instead. All commands below run from the directory containing `compose.yaml`, `alembic.ini`, and `requirements.lock`.

## Quick start: Windows PowerShell

After installing x64 CPython 3.12 and starting Docker Desktop, the setup helper runs the installation, preserves an existing `.env`, starts PostgreSQL, applies migrations, and loads demo data:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
```

This command applies the script execution policy only to that PowerShell process. It does not change your machine's policy. Stop if setup reports an error and follow its message; the helper does not continue after a failed command. For a Python installation without the launcher, pass `-PythonExecutable 'C:\path\to\python.exe'`. It must be x64 CPython 3.12. Then start the API and simulator using the commands below. The following manual steps perform the same setup if you prefer to run each command yourself.

Check the prerequisites:

```powershell
py -3.12 --version
docker version
docker compose version
```

`docker version` must show a working server as well as the client. If `py` is not available, install CPython 3.12 with the Python launcher, reopen PowerShell, and retry. Alternatively use `python` instead of `py -3.12` after verifying that `python --version` reports 3.12.

Create the environment and install dependencies:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

These commands invoke the virtual environment's Python directly; activation and PowerShell execution-policy changes are unnecessary. Existing `.env` files are preserved.

Start PostgreSQL, initialize the schema and fixtures, and run the API:

```powershell
docker compose up -d --wait
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m app.seed
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Keep this terminal open. In a second PowerShell terminal, enter this same `backend` directory and start the simulator:

```powershell
.\.venv\Scripts\python.exe -m app.simulator
```

## Quick start: WSL / Linux / macOS

Verify `python3 --version` is 3.12 and `docker version` shows a working server. If another Python version is the default, use `python3.12` instead when creating the environment.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.lock
if [ ! -f .env ]; then cp .env.example .env; fi
docker compose up -d --wait
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m app.seed
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal, enter this same `backend` directory:

```bash
.venv/bin/python -m app.simulator
```

On Ubuntu, if creating the virtual environment reports missing `ensurepip`, install `python3-venv` (or `python3.12-venv` for that interpreter) using the system package manager and retry. Activation is optional: `source .venv/bin/activate` lets you use `python` instead of `.venv/bin/python` in that terminal.

## Verify the local setup

Open these addresses in your browser:

- `http://localhost:8000/health`: liveness.
- `http://localhost:8000/ready`: database and demo astronaut readiness; expect `status: ready`.
- `http://localhost:8000/docs`: interactive endpoint testing.

The simulator writes a new reading every five seconds. Refresh `GET /api/v1/status` to see a new measurement ID and timestamp. Frontend should poll this endpoint every five seconds.

Each developer has an independent local database. Git does not copy another developer's data. `alembic upgrade head` creates tables; `app.seed` populates demo history; first check-in or explicit mission generation creates daily tasks. Without `AI_SERVICE_URL`, tasks use fallback and no provider key is needed. A fresh database is initialized explicitly, never by importing the API.

## PostgreSQL ports and troubleshooting

Always run Compose commands from `backend/`. From the repository root, use `docker compose -f backend/compose.yaml up -d --wait` instead. The error `no configuration file provided` means Compose did not find its file; `docker ps` itself does not need a Compose file.

If Docker cannot connect to its daemon, start Docker Desktop. For WSL terminals, also enable the matching distribution in Docker Desktop's WSL Integration settings. If the installed Compose does not recognize `--wait`, update Docker Desktop/Compose.

If Windows/local PostgreSQL already uses port 5432, keep it running and change only the published port in your local `compose.yaml`:

```yaml
ports:
  - "127.0.0.1:5433:5432"
```

Update both connection URLs in your local `.env` to match:

```dotenv
DATABASE_URL=postgresql+psycopg://orbiton:orbiton_local@localhost:5433/orbiton
TEST_DATABASE_URL=postgresql+psycopg://orbiton:orbiton_local@localhost:5433/orbiton_test
```

Then rerun `docker compose up -d --wait` and restart the API/simulator if already running. Use the same published port when exporting the test URL below. The PostgreSQL port inside the container remains 5432. Keep machine-specific port edits local when sharing changes with teammates.

Alternatively, skip Compose and use an existing PostgreSQL installation. First create the `orbiton` database and a user with permission to create its tables, then set `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:PORT/orbiton`. The Compose credentials work only with the database initialized by this Compose configuration. URL-encode special characters in your password.

Persistent Docker data lives in the `orbiton_postgres` volume. Stop the API and simulator with Ctrl+C; `docker compose down` stops PostgreSQL and preserves its data. Avoid `docker compose down -v` unless you intend to delete the local database.

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

The commands in this section assume the virtual environment is activated, or that you replace `python` with the virtual-environment Python path from your setup section.

The simulator is a separate process that inserts a new database row every five seconds. A PostgreSQL advisory lock prevents two simulator processes against the same database. API reloads do not start simulators.

```bash
python -m app.simulator --scenario normal
python -m app.simulator --scenario low-sleep
python -m app.simulator --scenario missing-data
python -m app.simulator --scenario flagged --count 3
```

Stop the previous simulator before changing scenarios. `--count 0` runs continuously. Heart rate, oxygen, and temperature follow deterministic small changes; sleep is stable for a UTC day and steps are a cumulative daily demo counter. Daily steps reset at UTC midnight. Source is `seed` or `simulator` and must be visible in the UI. Scenario changes are deliberate demo events, not actual physiology.

## Tests

Run these commands from `backend/`. Use a separate database whose name ends in `_test`; integration fixtures clear its application tables before every test. Tests never read `TEST_DATABASE_URL` automatically from `.env`. Without an exported test URL, integration tests are explicitly skipped.

Windows PowerShell — unit tests and code checks:

```powershell
.\.venv\Scripts\python.exe -m pytest -q -m "not integration"
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
```

Windows PowerShell — create the test database once, then run the full suite:

```powershell
docker compose exec db createdb -U orbiton orbiton_test
$env:TEST_DATABASE_URL = 'postgresql+psycopg://orbiton:orbiton_local@localhost:5432/orbiton_test'
.\.venv\Scripts\python.exe -m pytest -q
```

WSL / Linux / macOS — unit tests and code checks:

```bash
.venv/bin/python -m pytest -q -m 'not integration'
.venv/bin/python -m ruff check .
.venv/bin/python -m ruff format --check .
```

WSL / Linux / macOS — create the test database once, then run the full suite:

```bash
docker compose exec db createdb -U orbiton orbiton_test
export TEST_DATABASE_URL='postgresql+psycopg://orbiton:orbiton_local@localhost:5432/orbiton_test'
.venv/bin/python -m pytest -q
```

If `createdb` reports the test database already exists, continue with the next command. If you changed the published port to 5433, replace 5432 in the exported test URL with 5433. For an existing PostgreSQL installation, create a separate test database with your own credentials instead of using `docker compose exec`.

Tests cover persistence, concurrent generation, task refresh, input validation, scoring, simulation, dashboard aggregation, and AI validation/fallback. URLs targeting a database without the `_test` suffix are rejected.

For schema checks and future migrations, use the appropriate virtual-environment Python path above with `-m alembic check`, `-m alembic revision --autogenerate -m "Describe the change"`, and `-m alembic upgrade head`. Review generated migrations before applying them.

## Team integration

- Backend developer owns `backend/` and `docs/api/`.
- Frontend developer owns `frontend/`; consume the HTTP API rather than duplicating score formulas.
- AI developer owns `ai/`; implement the [AI service contract](../docs/api/ai-contract.md).
- Frontend integration, examples, error format, dates, and refresh behavior: [API contract](../docs/api/README.md).
- Machine-readable API: [OpenAPI snapshot](../docs/api/openapi.json). Regenerate it after endpoint/schema changes with `python -m app.export_openapi`, substituting the virtual-environment Python for your shell.

Use separate feature branches for frontend and AI, based on the agreed base commit. Do not edit another developer's owned directories. Communicate API contract changes before merging them. The `backend` branch can be merged without bringing in frontend or AI implementations.

## MVP boundaries

No accounts, authorization, real wearables, WebSocket, radiation scoring, 3D assets, or provider-specific AI client are included. The demo astronaut is shared across every browser connected to the same backend. Bind to localhost for local development; deployment with real users requires a separate access-control design. Existing generated tasks remain unchanged on later check-ins unless the caller explicitly requests refresh.
