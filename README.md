# Orbitone

Orbitone is a NASA Space Apps project. This branch contains the first isolated AI backend module: safe, personalized daily astronaut missions with Gemini and an offline fallback.

## AI service quick start

Requirements: Node.js 20 or newer. The service uses built-in Node APIs, so there is no dependency install step.

1. Copy `.env.example` to `.env`.
2. Create a Gemini API key in Google AI Studio and set `GEMINI_API_KEY` in `.env`. Keep this file on the backend only; it is ignored by Git.
3. Run `npm start`.
4. The service listens on `http://127.0.0.1:3001` by default.

Without an API key—or when Gemini is offline, times out, returns invalid JSON, or exceeds quota—the same endpoint returns a deterministic local fallback. This makes local development and demos work without paid services.

Example request:

```bash
curl -X POST http://127.0.0.1:3001/api/ai/daily-missions \
  -H "Content-Type: application/json" \
  -d '{"astronautId":"astro-7","displayName":"Alex","mood":"focused","energyLevel":4,"sleepHours":7.5,"stressLevel":2,"hasDiscomfort":false,"constraints":[],"preferences":[],"locale":"en"}'
```

Run tests with `npm test`.

## Team integration

Frontend and backend teammates should use [the AI API contract](docs/AI_API_CONTRACT.md) as the shared interface. The contract guarantees exactly three mission cards plus a short status message. Clients should never call Gemini directly and should not branch UI behavior based on `source`.

This module provides general wellness prompts only. It does not make medical diagnoses or prescribe treatment. Health concerns should be directed to the mission medical team.
