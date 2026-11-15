# Orbiton

An interactive astronaut health companion for NASA Space Apps 2026.

- [Backend setup and PostgreSQL](backend/README.md)
- [Frontend API integration](docs/api/README.md)
- [Backend ↔ AI contract](docs/api/ai-contract.md)
- [AI implementation contract](docs/AI_API_CONTRACT.md)
- [OpenAPI specification](docs/api/openapi.json)

## Full application

Start the backend and simulator using [backend setup](backend/README.md), then run `npm ci` and `npm run dev` from `frontend/`. See [frontend setup and API behavior](frontend/README.md). Vite proxies API requests to port 8000.

For local backend setup, use 64-bit CPython 3.12 and Docker Compose. Follow the [Windows PowerShell](backend/README.md#quick-start-windows-powershell) or [WSL / Linux / macOS](backend/README.md#quick-start-wsl--linux--macos) instructions. WSL is optional; each developer creates their own virtual environment and seeds their own PostgreSQL database.

Windows users can run `powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1` from `backend/` after installing the prerequisites. The helper installs dependencies, starts PostgreSQL, and initializes demo data.

## AI service

Requirements: Node.js 20 or newer. The service uses built-in Node APIs, so there is no dependency installation step.

1. Copy `.env.example` to `.env`.
2. Create a Gemini API key in Google AI Studio and set `GEMINI_API_KEY` in `.env`. Keep this backend-only file local; Git ignores it.
3. Run `npm.cmd start` from the repository root on Windows.
4. The service listens on `http://127.0.0.1:3001` by default.

The AI endpoint is `POST /generate-missions`. It accepts backend contract versions `1.0` and `1.1`. Version `1.1` uses backend-computed trend enums and an expanded approved catalog, then returns exactly three distinct template IDs with one permitted `reason_code` for each. Gemini cannot create arbitrary medical text or select the backend-reserved `medical_review` task.

Run the AI tests with:

```powershell
npm.cmd test
```

Use matching optional service tokens in the root AI `.env` and `backend/.env` files:

```env
# Root AI .env
GEMINI_API_KEY=your_server_only_key
AI_SERVICE_TOKEN=choose_a_local_shared_secret

# backend/.env
AI_SERVICE_URL=http://127.0.0.1:3001/generate-missions
AI_SERVICE_TOKEN=choose_a_local_shared_secret
AI_CONTRACT_VERSION=1.1
```

Apply backend migration `0002` before enabling `AI_CONTRACT_VERSION=1.1`. Gemini failures or invalid task/category/reason relationships return a non-2xx response so the backend can use and record its deterministic fallback.

## Runtime ownership

The backend simulator persists demo sensor measurements and the frontend polls backend `GET /api/v1/status`. The AI service does not duplicate or write sensor data. It receives the backend's latest safe summary only when a check-in or explicit mission refresh requests new tasks.

Backend code lives in `backend/`, frontend code in `frontend/`, and AI implementation code in `ai/`. The frontend calls only the backend; the backend alone calls the AI service. This module provides general wellness prompts only and does not make medical diagnoses or prescribe treatment.
