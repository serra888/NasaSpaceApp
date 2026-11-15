# Orbiton

An interactive astronaut health companion for NASA Space Apps 2026.

- [Backend setup and PostgreSQL](backend/README.md)
- [Frontend API integration](docs/api/README.md)
- [AI service contract](docs/api/ai-contract.md)
- [OpenAPI specification](docs/api/openapi.json)

For local backend setup, use 64-bit CPython 3.12 and Docker Compose. Follow the [Windows PowerShell](backend/README.md#quick-start-windows-powershell) or [WSL / Linux / macOS](backend/README.md#quick-start-wsl--linux--macos) instructions. WSL is optional; each developer creates their own virtual environment and seeds their own PostgreSQL database.

Windows users can run `powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1` from `backend/` after installing the prerequisites. The helper installs dependencies, starts PostgreSQL, and initializes demo data.

Backend code lives in `backend/`. Frontend and AI implementations belong in `frontend/` and `ai/`; each developer works on a separate branch and coordinates shared API changes.
