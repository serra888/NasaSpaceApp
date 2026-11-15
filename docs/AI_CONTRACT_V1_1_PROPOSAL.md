# Orbitone Backend ↔ AI Service Contract — 1.1 Proposal

Status: Proposed for backend review
Compatibility: additive evolution of contract `1.0`
Owners: backend owns data, persistence, catalogs and rendered copy; AI owns contextual selection

## 1. Purpose

Contract `1.0` safely limits AI to selecting three approved task templates. With only a small catalog and a single current snapshot, however, the same generic tasks repeat frequently and the selection can be reproduced with simple rules.

Contract `1.1` makes AI selection more meaningful while preserving the existing medical-safety boundary:

- Backend expands the approved task catalog.
- Backend sends compact, non-private trend summaries instead of raw history.
- AI returns exactly three approved template IDs plus one controlled reason code per selection.
- Backend renders all task and reason text from its own approved, localizable catalogs.
- AI still returns no free-form medical or wellness advice.

## 2. Non-goals

This proposal does not allow AI to:

- diagnose, interpret symptoms, recommend treatment or medication;
- generate arbitrary task titles, descriptions or medical text;
- receive symptom notes, journal entries or other free-text personal content;
- write to backend databases;
- select `medical_review`;
- replace backend alerts, scoring, fallback or mission-clearance rules.

## 3. Runtime flow

1. Backend simulator or a future sensor connector persists measurements.
2. Backend computes Health, Mood and trend summaries.
3. Backend bypasses AI when readings are flagged, required data is stale, or required scores are unavailable.
4. Backend sends contract `1.1` context and approved catalogs to the AI service.
5. AI selects exactly three distinct templates and a permitted reason code for each.
6. Backend validates, persists and renders the selections.
7. Frontend continues to communicate only with the backend.

Sensor polling must not trigger task generation. Generation remains tied to a check-in or explicit mission refresh.

## 4. Endpoint

```http
POST /generate-missions
Content-Type: application/json
Authorization: Bearer <AI_SERVICE_TOKEN>   # only when configured
```

The endpoint URL remains configured through backend `AI_SERVICE_URL`.

## 5. Request

```json
{
  "contract_version": "1.1",
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
  "check_in": {
    "mood": 3,
    "stress": 4,
    "energy": 2,
    "loneliness": 3
  },
  "trend_summary": {
    "window_days": 3,
    "sleep": "decreasing",
    "mood": "stable",
    "stress": "increasing",
    "energy": "decreasing",
    "connection": "insufficient_data"
  },
  "alerts": [],
  "task_catalog": [
    {
      "template_id": "earth_gaze_reset",
      "category": "recovery",
      "title": "Take a two-minute Earth-view reset.",
      "duration_minutes": 2,
      "intensity": "low",
      "reason_codes": ["high_stress", "protect_energy", "short_sleep"]
    },
    {
      "template_id": "crew_voice_checkin",
      "category": "social",
      "title": "Share a short voice check-in with a crew member.",
      "duration_minutes": 5,
      "intensity": "low",
      "reason_codes": ["low_connection", "support_mood"]
    },
    {
      "template_id": "single_priority_block",
      "category": "focus",
      "title": "Choose one priority for the next work block.",
      "duration_minutes": 3,
      "intensity": "low",
      "reason_codes": ["protect_energy", "support_focus", "balanced_day"]
    }
  ],
  "reason_catalog": [
    {"reason_code": "short_sleep", "description": "Latest or summarized sleep is short or decreasing."},
    {"reason_code": "high_stress", "description": "Current stress is high or the safe stress trend is increasing."},
    {"reason_code": "low_energy", "description": "Current energy is low."},
    {"reason_code": "protect_energy", "description": "A low-intensity option helps conserve reported energy."},
    {"reason_code": "low_connection", "description": "Reported social connection is low."},
    {"reason_code": "support_mood", "description": "Reported mood would benefit from a small supportive action."},
    {"reason_code": "support_focus", "description": "A bounded action can support the next work block."},
    {"reason_code": "balanced_day", "description": "Current values support a balanced preventive action."}
  ],
  "constraints": {
    "task_count": 3,
    "distinct_templates": true,
    "no_diagnosis": true,
    "max_duration_minutes": 10,
    "allowed_intensities": ["low"]
  }
}
```

## 6. Request rules

### Existing fields

All `1.0` fields retain their existing meaning. `health`, `mood`, `latest_measurement`, `check_in` and `alerts` remain backend-owned.

### `trend_summary`

Backend computes trend summaries. AI must never calculate or claim a trend from a single reading.

Allowed trend values:

```text
increasing | stable | decreasing | insufficient_data
```

Rules:

- `window_days` must be an integer from 2 through 7.
- Only backend-derived enum values are sent; raw history is not included.
- Missing or sparse series use `insufficient_data`.
- `connection` is derived from the existing loneliness/connection rating according to backend semantics.
- Trends are demo summaries, not clinical interpretations.

### `task_catalog`

Backend owns every template and sends 3–30 entries. Each entry contains:

| Field | Type | Rule |
| --- | --- | --- |
| `template_id` | string | unique, stable identifier |
| `category` | enum/string | backend-approved category |
| `title` | string | approved display title; AI must not rewrite it |
| `duration_minutes` | integer | 1–20 |
| `intensity` | enum | `low` or `medium`; MVP requests allow only `low` |
| `reason_codes` | string array | non-empty subset of `reason_catalog` |

The backend should provide approximately 20–30 varied, low-risk templates across recovery, focus, reflection, social connection, hydration-plan reminders and mission-approved mobility.

`medical_review` may remain in the backend's internal catalog but must either be omitted from the AI request or rejected if selected.

### `reason_catalog`

Backend owns the allowed reason codes and their semantics. AI can select a code but cannot invent one. Backend maps reason codes to approved, localizable frontend text.

### Privacy

The following must never be sent:

- symptom free text;
- journal entries;
- personal notes;
- provider credentials or service tokens;
- raw historical records when a trend enum is sufficient.

## 7. Response — HTTP 200

```json
{
  "tasks": [
    {
      "template_id": "earth_gaze_reset",
      "category": "recovery",
      "reason_code": "high_stress"
    },
    {
      "template_id": "crew_voice_checkin",
      "category": "social",
      "reason_code": "support_mood"
    },
    {
      "template_id": "single_priority_block",
      "category": "focus",
      "reason_code": "protect_energy"
    }
  ]
}
```

Response rules:

- Top-level object contains only `tasks`.
- `tasks` contains exactly three entries.
- Every `template_id` is distinct and exists in the request catalog.
- `category` exactly matches the selected catalog entry.
- `reason_code` exists in both the selected task's `reason_codes` and the request `reason_catalog`.
- `medical_review` is invalid.
- No title, description, status message, diagnosis or other generated prose is returned.

## 8. Backend rendering

Backend maps each `reason_code` to approved UI copy. Example:

```json
{
  "high_stress": "Selected because today's reported stress is high.",
  "protect_energy": "Selected to keep today's action short and low intensity.",
  "low_connection": "Selected to support a small moment of crew connection."
}
```

Rendered reason text is explanatory demo copy, not medical advice.

To preserve reasons across subsequent `GET /todos` calls, backend should store nullable `reason_code` on generated `TodoItem` rows. User-created tasks keep `reason_code: null`.

Backend `TodoOut` may add optional fields:

```json
{
  "reason_code": "protect_energy",
  "reason_text": "Selected to keep today's action short and low intensity."
}
```

These fields are additive, so existing frontend clients can ignore them.

## 9. Failure behavior

Failure behavior remains unchanged from `1.0`:

- provider timeout, quota, network error or non-2xx → backend fallback;
- malformed JSON, unknown task, duplicate task, category mismatch or invalid reason → backend fallback;
- flagged measurement → backend bypasses AI and selects `medical_review` through backend logic;
- stale or insufficient required context → backend fallback;
- redirects are not followed;
- provider bodies, credentials and private input are not stored in fallback reasons.

Recommended fallback reason additions:

```text
invalid_ai_reason
unsupported_ai_contract
```

## 10. Compatibility and rollout

Recommended deployment order:

1. Backend adds `1.1` schemas, expanded catalogs and optional persistence fields while continuing to support `1.0` responses.
2. AI service accepts both `1.0` and `1.1` requests.
3. Backend integration tests run against the AI service in `1.1` mode.
4. Backend switches outgoing `contract_version` to `1.1`.
5. Frontend optionally renders `reason_text`; no frontend change is required for basic task cards.
6. Contract `1.0` remains available until all deployed environments use `1.1`.

## 11. Backend implementation checklist

- [ ] Expand `TASK_CATALOG` to approximately 20–30 approved templates.
- [ ] Add duration, intensity and permitted reason-code metadata.
- [ ] Add backend-owned `REASON_CATALOG` and localized reason copy.
- [ ] Compute bounded trend enums without sending raw history.
- [ ] Add Pydantic request/response models for contract `1.1`.
- [ ] Validate exact task/category/reason relationships.
- [ ] Add nullable `reason_code` persistence for generated tasks.
- [ ] Keep alerts, stale data and `medical_review` routing outside AI.
- [ ] Add integration tests for invalid reasons, privacy exclusions and fallback.
- [ ] Update the canonical backend contract and OpenAPI/frontend docs after team approval.

## 12. AI implementation checklist

- [ ] Accept both `1.0` and `1.1` during rollout.
- [ ] Constrain Gemini structured output to request-provided template and reason enums.
- [ ] Validate the task/category/reason relationship after model output.
- [ ] Keep exactly three distinct selections.
- [ ] Reject `medical_review`, extra fields and generated prose.
- [ ] Use minimal thinking to stay inside the backend's eight-second timeout.
- [ ] Return non-2xx so backend fallback remains authoritative.

## 13. Approval questions for backend team

1. Can backend expand and own the approved catalog and reason catalog?
2. Can backend compute the proposed bounded trend enums without exposing raw history?
3. Should `reason_code` be persisted on generated todos, or only on mission generation records?
4. Are `reason_code` and optional `reason_text` acceptable additive fields in `TodoOut`?
5. How long should contract `1.0` remain supported during rollout?
