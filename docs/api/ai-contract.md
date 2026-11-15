# Orbiton backend ↔ AI service contract — 1.0

The AI developer implements an HTTP POST endpoint in `ai/` and sets its full URL as backend `AI_SERVICE_URL`, for example `http://localhost:8001/generate-missions`. No particular model provider is required. Backend owns persistence, scoring, daily deduplication, and task completion. AI owns contextual selection of approved mission templates.

## Request

Content-Type: `application/json`. If `AI_SERVICE_TOKEN` is set, backend sends `Authorization: Bearer <token>`. The AI service must validate that token when configured. Store actual provider credentials in an ignored environment file; never send them to the frontend. The provider client's environment loading is the AI developer's responsibility.

The request has these fields:

| Field | Type / purpose |
| --- | --- |
| `contract_version` | String `1.0` |
| `astronaut_id` | Shared demo ID |
| `mission_date` | `YYYY-MM-DD` in the mission timezone |
| `health` | Backend-computed Score object |
| `mood` | Backend-computed Score object |
| `latest_measurement` | Measurement object or null, including units defined in API reference |
| `check_in` | `{mood, stress, energy, loneliness}` integer ratings, or null |
| `alerts` | English alert string array |
| `task_catalog` | Allowed `{template_id, category, title}` array |
| `constraints` | `{task_count: 3, distinct_templates: true, no_diagnosis: true}` |

Score objects include `value`, `used_fields`, `missing_fields`, `calculated_at`, `observed_at`, `stale`, `is_demo`. See [API reference](README.md). Symptoms and journals are deliberately excluded from external AI context. There is no historical trend payload in v1: do not claim changes over three days based on one reading.

The backend bypasses AI for flagged readings or missing/stale required context. Model prompts should still treat all measurements as demo data and avoid diagnoses, treatment, dose recommendations, or exercise prescriptions.

## Response — HTTP 200

Return exactly three distinct approved templates with matching categories and no extra keys:

```json
{
  "tasks": [
    {"template_id": "quiet_rest", "category": "rest"},
    {"template_id": "positive_moment", "category": "reflection"},
    {"template_id": "crew_connection", "category": "social"}
  ]
}
```

Backend renders the approved English titles itself. It rejects arbitrary generated task text, unknown IDs, mismatched categories, duplicate templates, extra fields, and a task count other than three. Personalization in this MVP means contextual selection of templates, not unrestricted generated medical text.

| Template ID | Category | Approved title |
| --- | --- | --- |
| `quiet_rest` | `rest` | Take a five-minute quiet rest break. |
| `breathing_pause` | `breathing` | Take a short, comfortable breathing break. |
| `positive_moment` | `reflection` | Write down one positive moment from today. |
| `energy_note` | `reflection` | Note how your energy has changed today. |
| `crew_connection` | `social` | Check in with a crew member for a few minutes. |
| `gentle_mobility` | `mobility` | Try a brief, comfortable mobility break if your mission guidance allows it. |
| `medical_review` | `medical_review` | Ask the mission medical team to review the flagged readings. |

`medical_review` is reserved for backend review routing. The AI must not select it; flagged data never reaches the external selector. Prefer rest for short sleep or low energy, reflection for low mood, social connection for high loneliness, and breathing pauses for high stress. Do not claim a causal diagnosis.

## Failure behavior

Return a non-2xx response if the provider is unavailable or the service cannot validate its output. Backend falls back on any HTTP failure, timeout, malformed JSON, or invalid selection. Redirects are not followed. It stores only the fallback reason code, not provider response bodies or secrets.

Default HTTP timeout: eight seconds per operation. Do not stream the response. Backend generation is synchronous and persists the selected tasks before returning to the frontend. Do not write directly to backend database tables from the AI service.
