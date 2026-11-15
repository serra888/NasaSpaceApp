# Orbitone Backend ↔ AI Contract

This document mirrors the backend branch contract version `1.0` for the AI implementation. The backend remains the source of truth for persistence, scores, live simulator data, approved task titles, fallback behavior, and task completion.

## Runtime flow

1. The backend simulator writes a new demo sensor measurement to PostgreSQL every five seconds.
2. The frontend polls backend `GET /api/v1/status` every five seconds and displays the latest persisted reading.
3. A check-in or explicit mission refresh makes the backend call this AI service.
4. The AI service selects exactly three approved task template IDs.
5. The backend validates the selection, renders its own approved titles, persists the tasks, and returns them to the frontend.

The frontend never calls this service or Gemini directly. Sensor polling does not trigger AI generation.

## `POST /generate-missions`

Set the backend's full `AI_SERVICE_URL` to:

```text
http://127.0.0.1:3001/generate-missions
```

If `AI_SERVICE_TOKEN` is configured on the AI service, the backend must send the same value as `Authorization: Bearer <token>`.

### Request

```json
{
  "contract_version": "1.0",
  "astronaut_id": "orbiton-demo",
  "mission_date": "2026-11-15",
  "health": {
    "value": 82,
    "used_fields": ["heart_rate", "spo2", "sleep_hours"],
    "missing_fields": [],
    "calculated_at": "2026-11-15T09:00:00Z",
    "observed_at": "2026-11-15T08:59:59Z",
    "stale": false,
    "is_demo": true
  },
  "mood": {
    "value": 56,
    "used_fields": ["mood", "stress", "energy", "loneliness"],
    "missing_fields": [],
    "calculated_at": "2026-11-15T09:00:00Z",
    "observed_at": "2026-11-15T08:58:00Z",
    "stale": false,
    "is_demo": true
  },
  "latest_measurement": {
    "id": "measurement-demo",
    "astronaut_id": "orbiton-demo",
    "measured_at": "2026-11-15T08:59:59Z",
    "heart_rate": 72,
    "spo2": 98,
    "sleep_hours": 6.2,
    "steps": 1200,
    "body_temperature_c": 36.7,
    "source": "simulator"
  },
  "check_in": { "mood": 3, "stress": 4, "energy": 2, "loneliness": 3 },
  "alerts": [],
  "task_catalog": [
    { "template_id": "quiet_rest", "category": "rest", "title": "Take a five-minute quiet rest break." },
    { "template_id": "breathing_pause", "category": "breathing", "title": "Take a short, comfortable breathing break." },
    { "template_id": "positive_moment", "category": "reflection", "title": "Write down one positive moment from today." },
    { "template_id": "crew_connection", "category": "social", "title": "Check in with a crew member for a few minutes." }
  ],
  "constraints": {
    "task_count": 3,
    "distinct_templates": true,
    "no_diagnosis": true
  }
}
```

Free-text symptoms and journals must not be sent. Contract validation rejects unexpected top-level and check-in fields.

### Success response

The response contains no generated prose or additional keys:

```json
{
  "tasks": [
    { "template_id": "quiet_rest", "category": "rest" },
    { "template_id": "breathing_pause", "category": "breathing" },
    { "template_id": "crew_connection", "category": "social" }
  ]
}
```

All three templates must be distinct, appear in the request catalog, and use the catalog's matching category. `medical_review` is reserved for backend routing and can never be selected by Gemini.

### Errors and fallback

- `400 INVALID_CONTRACT`: request or generated selection violates contract `1.0`.
- `401 UNAUTHORIZED`: configured service token is missing or incorrect.
- `415 UNSUPPORTED_MEDIA_TYPE`: request is not `application/json`.
- `422 UNSAFE_OR_INSUFFICIENT_CONTEXT`: alerts, stale scores, or missing health score require backend fallback.
- `503 AI_UNAVAILABLE`: Gemini is not configured, times out, exceeds quota, or is unavailable.

For all non-2xx responses, the backend uses its deterministic fallback and records its own fallback reason. Provider response bodies and secrets are never returned.

`GET /health` reports `providerConfigured` and identifies the backend as the fallback owner without revealing secrets.
