# Orbiton progress — AI contract 1.1 implementation

## Resume note

This checkpoint was resumed after the user requested continuation. Preserve the existing line-ending and unrelated frontend/backend changes; only the AI 1.1 scope is being advanced here.

## Objective and authorization

Implement `docs/api/AI_CONTRACT_V1_1_PROPOSAL.md` on the **backend** branch. The user approved the scope after an explanation: expanded approved task catalog, backend-computed trend enums, controlled selection reasons, nullable reason persistence, versioned 1.0/1.1 compatibility, tests and documentation.

The frontend/backend integration was previously merged into main and manually verified by the user. Backend was subsequently fast-forwarded to main (`af01fb4`). This AI change is not complete, committed, pushed, or merged.

## Workspace and Git state

- Repository: `D:\nasa-health\NasaSpaceApp` / `/mnt/d/nasa-health/nasaspaceapp` (tools sometimes resolve the path as `/mnt/d/nasa-health/NasaSpaceApp`).
- Switched from main to **backend** successfully during this task.
- Many tracked files already appeared modified before implementation because of line-ending differences. Before these edits, `git diff --ignore-space-at-eol --stat` was empty. Preserve that pre-existing state; do not restore files wholesale or stage the entire repository blindly.
- `docs/api/AI_CONTRACT_V1_1_PROPOSAL.md` was already untracked and user-provided. Preserve it.
- Existing integration worktree: `/tmp/orbiton-integration`, branch `integration/frontend-backend`. It is unrelated to the current AI edits.
- Filesystem writes through relative paths sometimes fail with read-only filesystem errors due to path casing. Absolute lowercase paths with apply_patch worked. One Python edit script was rerun with approved escalation after such a failure.

## Changes implemented so far

### Catalogs: `backend/app/catalogs.py` (new)

- 25 AI-selectable low-intensity templates plus internal `medical_review`.
- Categories include existing categories and recovery, focus, hydration.
- AI templates include approved English title, duration, intensity and permitted reason codes.
- Backend-owned English `REASON_CATALOG` with eight codes: short_sleep, high_stress, low_energy, protect_energy, low_connection, support_mood, support_focus, balanced_day.
- `LEGACY_IDS` preserves the original seven-template request catalog for 1.0.
- Copy is English, as previously required. Localization infrastructure beyond this central catalog has not been implemented.

### Configuration: `backend/app/config.py`, `backend/.env.example`

- `AI_CONTRACT_VERSION`: validated `1.0` or `1.1`, default **1.0** for staged rollout.
- `AI_TREND_WINDOW_DAYS`: default 3, bounded 2–7.
- The example environment file documents the settings. The private `.env` was not deliberately edited for this change.

### Persistence: `backend/app/models.py`

- Added nullable `TodoItem.reason_code` (String(40)).

### Migration: `backend/alembic/versions/0002_todo_reason.py` (new)

- Revision 0002, parent 0001.
- Upgrade adds nullable reason_code to todo_items; downgrade removes it.
- Existing rows are intended to retain null reasons.
- Migration has NOT been applied or tested as part of this task.

### Schemas: `backend/app/schemas.py`

- Expanded category literal with recovery, focus, hydration.
- `TodoOut` includes nullable reason_code and computed reason_text from the backend catalog.
- Added AIRequestV11, AIResponseV11, AISuggestionV11, TrendSummary, CatalogTaskV11, CatalogReason, AIConstraintsV11 and AICheckIn models.
- 1.1 response requires reason_code; extra fields are forbidden.
- Request includes bounded catalog sizes, duration/intensity metadata and trend enums.

### Trend summaries: `backend/app/trends.py` (new)

- Queries daily averages in configured mission timezone for the last N **completed** days, excluding today.
- Sleep comes from measurements; mood/stress/energy/loneliness from check-ins.
- Connection = 6 - daily average loneliness.
- Missing daily values yield insufficient_data.
- First-to-last delta thresholds: 0.25 hours sleep, 0.5 rating points otherwise; larger positive/negative changes map to increasing/decreasing, others stable.
- This is a bounded demo endpoint comparison, not a claim of monotonic movement or clinical interpretation.
- Does not send raw history to AI.
- PostgreSQL aggregation, date boundaries and threshold behavior still need dedicated tests.

### AI service integration: `backend/app/services.py`

- Imports backend-owned catalogs instead of the inline catalog.
- Added a `Selection(str)` wrapper carrying reason_code while preserving existing ID-list behavior. Review whether this representation should be made more explicit before finalization.
- ai_context accepts optional TrendSummary, retains 1.0 shape in legacy mode, and validates/serializes AIRequestV11 in 1.1 mode.
- 1.1 request excludes medical_review, restricts templates to low intensity and <=10 minutes, and includes reason catalog and constraints.
- select_tasks validates against the actual sent catalog and the schema matching configured version.
- Invalid task/reason combinations return invalid_ai_reason fallback.
- HTTP 400/422 currently map to unsupported_ai_contract. Review/document that this is a coarse mapping, since not every such response necessarily means a version mismatch.
- Missing Mood score now bypasses AI in addition to existing stale/missing Health guards.
- Flagged readings, timeouts, malformed output and fallback behavior remain in place.
- generate_missions computes trends in 1.1 mode and stores selected reason_code on generated todos. Title/category are copied explicitly, preventing catalog metadata being passed as ORM constructor fields.
- Existing task refresh/completed-task preservation logic remains. Dedicated tests must verify reason preservation and fallback source correctness.
- Fallback, legacy tasks and user-created tasks currently have null reasons; do not invent reasons for those tasks.

### Documentation and tests completed after resume

- Added focused 1.1 tests for valid request construction, bounded trends, catalog restrictions, authorization, private-text exclusion, invalid reasons, duplicate selections and extra generated fields.
- Updated canonical `docs/api/ai-contract.md`, `docs/api/README.md`, and `backend/README.md` with version rollout and migration guidance.
- Regenerated `docs/api/openapi.json` successfully after the new schema models.
- Ruff check and format check pass for `backend/`.

## Verification performed in this task

1. Created isolated Python environment `/tmp/orbiton-ai-venv` and installed `backend/requirements.lock` successfully (network access approved).
2. Ran existing non-integration tests after implementing catalogs, schemas, services and trends:

   `PYTHONDONTWRITEBYTECODE=1 /tmp/orbiton-ai-venv/bin/python -m pytest -q -m 'not integration' -p no:cacheprovider`

   Result before the 1.1 tests: **12 passed, 7 deselected**.

   These are existing tests, primarily validating the default 1.0 behavior. They do NOT establish 1.1 correctness.

3. After resuming, the full local test command completed with **15 passed, 7 skipped**. The seven skipped tests are the existing PostgreSQL integration tests because no test database was run in this environment.
4. OpenAPI export completed successfully after the 1.1 schema changes. Ruff check and format check passed.

## Failed / interrupted operations

- A relative-path write for trends.py and a relative-path services edit failed with read-only filesystem errors. Services edit was subsequently rerun successfully with escalation. trends.py was subsequently added successfully with absolute-path apply_patch.
- `python3 -m compileall -q backend/app` failed because it could not write __pycache__ files under the read-only resolved path. This was a filesystem failure, not a reported Python syntax assertion failure. The later 12 passing tests imported the modules.
- `docker compose -f backend/compose.yaml ps` failed because sandbox access to the Docker socket was denied.
- Attempted an escalated command to create an isolated test database:

   `docker compose -f backend/compose.yaml exec -T db createdb -U orbiton orbiton_ai11_test`

   The user interrupted this tool call after approximately 176 seconds. There is no success result. **Unknown whether the database was created or the command partially executed.** Check only when the user resumes and authorizes further work; do not assume it exists or retry blindly.
- No failing test assertion has been observed in this task. PostgreSQL migration/persistence, schema drift and live AI provider checks remain unexecuted.

## Remaining work when resumed

1. Review the current diff carefully before committing. Existing tracked files show line-ending differences; stage only intentional AI/docs files and the pre-existing proposal/PROGRESS files as appropriate.
2. Add any remaining 1.1 tests for PostgreSQL trend aggregation, migration/persistence and the exact refresh behavior. HTTP timeout/legacy compatibility tests already exist from the earlier suite; the new tests cover the 1.1 payload and validation path.
3. Test actual request JSON including authorization header vs payload privacy. Reason descriptions are backend English copy and must remain controlled.
4. Test daily trend aggregation over PostgreSQL: missing days, repeated five-second readings, timezone boundaries, excluding today, thresholds and inverse connection semantics.
5. Test reason persistence via generation and GET /todos, user/legacy null reasons, refresh and completed-task preservation, and migration upgrade/downgrade/data preservation. Use an isolated *_test database only.
6. Review partial-data/mission-clearance semantics and selection representation; ensure catalog/category/reason validation uses precisely the sent catalog. Consider replacing the string subclass with a clearly typed internal representation if useful, preserving public API compatibility.
7. Run PostgreSQL integration and migration checks when Docker access is available. Do not claim live provider integration unless an actual configured AI service is exercised.
8. Canonical docs and OpenAPI snapshot are now updated. The proposal remains the detailed reference for the 1.1 payload.
9. Frontend edits are not required for basic compatibility. Rendering reason_text is optional and was not authorized as necessary for this backend-only implementation.
10. Keep 1.0 available until the AI service supports 1.1; do not silently weaken 1.1 validation or automatically downgrade invalid responses.
11. Report exact validation results and limitations. Commit/push only scoped backend/docs changes if proceeding under user authorization; avoid staging unrelated line-ending differences. GitHub authentication has previously prevented push from this environment.

## Current completion status

**Implementation is substantially complete but not ready for deployment.** Core 1.1 code, migration draft, focused tests, canonical docs and OpenAPI snapshot exist. Local validation is 15 passed and 7 skipped, with PostgreSQL migration/persistence and live AI provider validation still outstanding. No commit or push has been made for this AI work.
