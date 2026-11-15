# Orbiton API contract — v1

Base URL: `http://localhost:8000`. Application prefix: `/api/v1`. JSON field names, messages, mock content, and task titles are English. Interactive reference: `/docs`. Machine-readable reference: [`openapi.json`](openapi.json).

## Shared conventions

- One shared astronaut: `orbiton-demo` by default. There is no client-supplied astronaut ID or login in this MVP.
- Timestamps use timezone-aware ISO 8601; responses are UTC. Query timestamps must include `Z` or an offset.
- Date-only mission fields use `YYYY-MM-DD` in the configured `MISSION_TIMEZONE` (default UTC). `status` returns both `mission_date` and `mission_timezone`.
- History filters are inclusive `start`, exclusive `end`. Default range: last seven days. Results are oldest first, with ID as a stable tie-breaker. `limit` defaults to 100, max 1000; `offset` defaults to 0. Advance offset by the returned row count; stop when fewer than limit are returned. Fix `end` when paging through a live stream.
- Sensor units: heart rate bpm, SpO2 percent, sleep hours, steps daily count, temperature Celsius. Missing values are `null`, never zero substitutes.
- No application endpoint accepts sensor writes. The simulator inserts PostgreSQL rows directly as a separate process. Frontend polls persisted readings.
- Validation is HTTP 422; missing tasks are 404; database errors are 503. Error payloads exclude submitted secret/private values.

```json
{"error":{"code":"http_404","message":"Task not found."}}
```

Validation also includes `error.fields`, an array of `location`, `message`, and `type` objects. Mutation bodies reject unknown fields. Boolean task completion requires JSON `true` or `false`, not strings.

## Endpoint map

| Method | Path | Request / query | Response |
| --- | --- | --- | --- |
| GET | `/health` | none | Liveness, service name, version |
| GET | `/ready` | none | Database and demo astronaut readiness |
| GET | `/api/v1/status` | none | Current readings, Health/Mood, freshness, alerts, astronaut message |
| GET | `/api/v1/measurements` | `start`, `end`, `limit`, `offset` | Measurement array |
| POST | `/api/v1/check-ins` | Four ratings and optional symptoms | 201: saved check-in, new Mood, daily missions |
| GET | `/api/v1/check-ins` | History filters | Check-in array |
| GET | `/api/v1/dashboard` | `start`, `end`, `bucket=hour|day` | UTC chart buckets, max 31 days |
| GET | `/api/v1/todos` | Optional `mission_date` | Active tasks for selected/current mission day |
| POST | `/api/v1/todos` | `title`, optional `mission_date` | 201: user task |
| PATCH | `/api/v1/todos/{todo_id}` | `completed` | Updated task |
| POST | `/api/v1/missions/generate` | `force` default false; send `{}` for existing/create | Daily generation metadata and tasks |
| GET | `/api/v1/journal` | History filters | Journal array |
| POST | `/api/v1/journal` | `text` | 201: saved journal entry |

## Frontend flow

1. Fetch `status` and `todos` on load; fetch dashboard only when its page opens.
2. Poll `status` every five seconds. Display Health and Mood independently. Preserve the previous UI on network error and show a disconnected state. Use `observed_at`/`latest_measurement.id` to recognize new sensor readings.
3. Render `null` scores as unavailable. Show `missing_fields` and `stale` instead of presenting incomplete/old data as current. `used_fields` names the inputs contributing to a score.
4. Submit check-in. Use returned `mood` and `missions`, then refresh `status`. Do not retry check-in blindly: it appends a new record. Mission creation is idempotent per astronaut/day; check-in creation itself is not.
5. PATCH task completion, replacing the local item with the response. Show completed generated missions as part of the three daily missions. User tasks are additional.
6. On explicit refresh, call `missions/generate` with `force: true`, then refetch `todos`. On a new mission date, refetch tasks; generation occurs on check-in or the explicit generate endpoint.

Example check-in:

```bash
curl -X POST http://localhost:8000/api/v1/check-ins \
  -H 'Content-Type: application/json' \
  -d '{"mood":2,"stress":4,"energy":2,"loneliness":4,"symptoms":"Feeling tired today."}'
```

All four ratings are required integers 1–5. Higher stress/loneliness means worse wellbeing; higher mood/energy means better wellbeing. Symptoms are optional, maximum 2000 characters. Store journals separately:

```json
{"text":"I enjoyed a quiet conversation with the crew today."}
```

Journal text is trimmed, nonblank, maximum 10000 characters. Custom task title is trimmed, nonblank, maximum 240 characters:

```json
{"title":"Review my mission journal."}
```

Completion:

```json
{"completed":true}
```

Repeatedly setting an already completed task to true preserves its original completion timestamp. Reopening sets `completed_at` to null.

## Status and score semantics

`status` contains `astronaut_id`, `health`, `mood`, `latest_measurement`, `latest_check_in`, `alerts`, `astronaut_message`, `mission_date`, and `mission_timezone`. Latest values can be null in an empty dataset.

Each score has this shape (illustrative values):

```json
{
  "value": 82,
  "used_fields": ["heart_rate", "spo2", "sleep_hours"],
  "missing_fields": [],
  "calculated_at": "2026-11-14T12:00:00Z",
  "observed_at": "2026-11-14T12:00:00Z",
  "stale": false,
  "is_demo": true
}
```

Scores are deterministic demo indicators, not clinical risk estimates. All component scores are clamped to 0–100 and the final value is rounded to an integer.

Health uses only the latest measurement row, without silently filling missing fields from older rows:

| Component | Demo formula | Weight |
| --- | --- | --- |
| Heart rate | `100 - 2 * max(60 - hr, 0, hr - 100)` | 0.30 |
| SpO2 | `(spo2 - 90) * 10` | 0.30 |
| Sleep | `100 - 15 * abs(sleep_hours - 8)` | 0.40 |

At least two of these fields must be present. Available weights are normalized when a component is missing. Steps and temperature are informational and do not change Health. Measurement freshness defaults to 30 seconds. Old values remain visible with `stale: true`; never silently treat them as fresh.

Mood uses only the latest check-in:

```text
round(((mood - 1) + (5 - stress) + (energy - 1) + (5 - loneliness)) / 16 * 100)
```

No check-in means `value: null`; freshness defaults to 24 hours. Health never reads check-in fields and Mood never reads sensors.

Demo review flags: SpO2 below 92, heart rate below 40 or above 130, temperature below 35 or above 38 Celsius. These are explicitly demo routing rules, not validated flight-medicine thresholds. Flags are separate from the score and direct the demo toward mission medical review rather than AI treatment suggestions.

## Daily missions and AI

AI contract rollout is controlled by `AI_CONTRACT_VERSION`. Version `1.0` is the default. Version `1.1` sends bounded trend enums and an approved low-intensity catalog, and validates a reason code for every AI-selected task. Apply the `0002` migration before using 1.1 so generated todo reason codes can be persisted. See [AI_CONTRACT_V1_1_PROPOSAL.md](AI_CONTRACT_V1_1_PROPOSAL.md) for the exact payload.

Check-in creates a generation if none exists for the current mission day. Later check-ins update Mood but reuse that day's existing tasks. `force: false` returns the existing generation unchanged. Measurement polling never generates tasks.

A generation returns `generation_id`, `mission_date`, `revision`, `source`, `fallback_reason`, and `tasks`. Each task includes `id`, `astronaut_id`, optional `generation_id`, `mission_date`, `title`, `category`, `source`, `completed`, `completed_at`, and `created_at`.

- Initial generation has exactly three distinct tasks. Source is `ai` or `fallback`; user-created tasks have source `user` and category `custom`.
- Explicit refresh preserves completed generated tasks and all custom tasks; unfinished generated tasks are archived and replaced to keep three active generated tasks including completed ones. If all three are complete, refresh creates no extra missions.
- Concurrent requests are serialized per astronaut with a PostgreSQL row lock. A unique astronaut/day constraint is the second guard against duplicate generations.
- If a generation contains completed older tasks after refresh, individual task sources can differ from the generation's latest source.
- Fallback reasons: `flagged_measurements`, `insufficient_fresh_data`, `ai_not_configured`, `ai_timeout`, `ai_unavailable`, or `invalid_ai_response`.
- The AI call is synchronous during first generation/explicit refresh, with an eight-second default per-operation HTTP timeout. Disable duplicate submit buttons while pending.

The [AI service contract](ai-contract.md) defines the exact payload and approved task templates. No provider key is needed for fallback mode.

## Dashboard

`GET /api/v1/dashboard?bucket=hour` defaults to the last seven days. Response: `start`, `end`, `bucket`, `points`, `is_demo`. Each point includes `timestamp`, `health`, `mood`, `heart_rate`, `spo2`, `sleep_hours`, `steps`, `body_temperature_c`, `measurement_count`, and `check_in_count`.

Buckets start at UTC hour/day boundaries. Sensor values use averages, except daily cumulative steps use the maximum in a bucket. Health is calculated from bucket-average inputs; Mood from average check-in ratings. These bucket scores may differ from an average of individual record scores because clamping/rounding is nonlinear. Buckets containing no observations are omitted. A sensor-only bucket has null Mood; a check-in-only bucket has null Health. Do not connect missing data as if it were a measured zero.

## Contract maintenance

Backend owns these contracts. Coordinate changes with frontend and AI developers before merging. New optional fields may be added in v1; renaming fields or changing semantics requires an explicit coordinated contract update. The JSON snapshot can be imported into API clients and frontend type generators.
