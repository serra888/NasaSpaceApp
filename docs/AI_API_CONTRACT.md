# Orbitone AI API Contract

This file is the integration boundary for mobile/web and backend developers. The AI service owns all Gemini calls. Client applications must never call Gemini directly or receive `GEMINI_API_KEY`.

## `POST /api/ai/daily-missions`

Request (`Content-Type: application/json`):

```json
{
  "astronautId": "astro-7",
  "displayName": "Alex",
  "mood": "focused",
  "energyLevel": 4,
  "sleepHours": 7.5,
  "stressLevel": 2,
  "hasDiscomfort": false,
  "constraints": ["Avoid loud activities"],
  "preferences": ["Short focus exercises"],
  "locale": "en"
}
```

Rules:

- `mood`: `calm | focused | tired | stressed | low`
- `energyLevel`, `stressLevel`: number from 1 through 5
- `sleepHours`: number from 0 through 24
- `constraints`, `preferences`: optional arrays, maximum 5 short strings each
- `locale`: optional; `tr` and `tr-*` receive Turkish deterministic fallback copy, all other values fall back to English

Success response (`200`):

```json
{
  "missions": [
    {
      "id": "mission-1",
      "title": "Water pause",
      "description": "Follow your normal onboard hydration plan.",
      "durationMinutes": 3,
      "category": "hydration"
    }
  ],
  "statusMessage": "Alex, today's plan keeps things short, safe, and achievable.",
  "source": "gemini",
  "generatedAt": "2026-10-04T09:00:00.000Z",
  "safetyNotice": "Wellness guidance only; not medical advice or a diagnosis. Contact the mission medical team for health concerns."
}
```

`missions` always contains exactly 3 items. `source` is `gemini` or `fallback`; the client should render both identically. Categories are `hydration | movement | focus | connection | recovery`.

Invalid input response (`400`):

```json
{"error":{"code":"INVALID_INPUT","message":"energyLevel must be a number from 1 to 5"}}
```

## `POST /api/ai/status-message`

Accepts the same request. Returns only `statusMessage`, `source`, `generatedAt`, and `safetyNotice`. This is available for surfaces that do not display the mission cards. Prefer the daily-missions response when both are needed, to avoid a second model call.

## `GET /health`

Returns service health and `aiMode`: `gemini-with-fallback` or `fallback-only`. It never reveals configuration secrets.

## Safety and failure behavior

- Output is constrained by Gemini JSON Schema and validated again on the server. Explicit diagnosis or prescription language is rejected and replaced by the safe fallback.
- The module provides general wellness prompts only. It must not diagnose, prescribe, or interpret symptoms.
- Network errors, timeouts, quota responses, missing keys, malformed JSON, or invalid generated values automatically use a deterministic local fallback.
- The API key is read only from the backend environment and is never logged or returned.
