# Orbitone

Orbitone is a NASA Space Apps project. This branch contains the isolated AI service that selects safe daily astronaut missions through Gemini.

## AI service quick start

Requirements: Node.js 20 or newer. The service uses built-in Node APIs, so there is no dependency install step.

1. Copy `.env.example` to `.env`.
2. Create a Gemini API key in Google AI Studio and set `GEMINI_API_KEY` in `.env`. Keep this file on the backend only; it is ignored by Git.
3. Run `npm start`.
4. The service listens on `http://127.0.0.1:3001` by default.

The only generation endpoint is `POST /generate-missions`. It accepts contract version `1.0` and returns exactly three distinct approved template IDs. Gemini cannot create arbitrary medical text or select the backend-reserved `medical_review` task.

Run tests with `npm test`.

## Backend connection

Use matching optional service tokens in both `.env` files.

AI service `.env`:

```env
GEMINI_API_KEY=your_server_only_key
AI_SERVICE_TOKEN=choose_a_local_shared_secret
```

Backend `.env`:

```env
AI_SERVICE_URL=http://127.0.0.1:3001/generate-missions
AI_SERVICE_TOKEN=choose_a_local_shared_secret
```

Gemini failures return a non-2xx response from the AI service so the backend can apply and record its own deterministic fallback.

## Live demo data ownership

The backend branch already owns the live-looking data flow: its simulator writes a persisted measurement every five seconds, and the frontend polls backend `GET /api/v1/status` every five seconds. The AI service does not duplicate or write sensor data. It receives the backend's latest safe summary only when a check-in or explicit mission refresh requests new tasks.

## Team integration

Frontend and backend teammates should use [the AI API contract](docs/AI_API_CONTRACT.md) as the shared interface. Frontend code calls only the backend; the backend alone calls this AI service. This branch does not modify the frontend or backend developers' owned directories.

This module provides general wellness prompts only. It does not make medical diagnoses or prescribe treatment. Health concerns should be directed to the mission medical team.
