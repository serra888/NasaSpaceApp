from datetime import date
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.catalogs import LEGACY_IDS, REASON_CATALOG, TASK_CATALOG
from app.config import get_settings
from app.models import (
    Astronaut,
    CheckIn,
    Measurement,
    MissionGeneration,
    TodoItem,
    utcnow,
)
from app.schemas import (
    AIRequestV11,
    AIResponse,
    AIResponseV11,
    MissionsOut,
    StatusOut,
    TodoOut,
    TrendSummary,
)
from app.scoring import health_score, measurement_alerts, mood_score
from app.trends import trend_summary


class Selection(str):
    def __new__(cls, template_id, reason_code=None):
        item = super().__new__(cls, template_id)
        item.reason_code = reason_code
        return item


def mission_day() -> date:
    return utcnow().astimezone(ZoneInfo(get_settings().mission_timezone)).date()


def lock_astronaut(session: Session):
    return session.scalar(
        select(Astronaut).where(Astronaut.id == get_settings().demo_astronaut_id).with_for_update()
    )


def latest(session: Session, model, time_column):
    return session.scalar(
        select(model)
        .where(model.astronaut_id == get_settings().demo_astronaut_id)
        .order_by(time_column.desc(), model.id.desc())
        .limit(1)
    )


def status(session: Session) -> StatusOut:
    settings = get_settings()
    measurement = latest(session, Measurement, Measurement.measured_at)
    check_in = latest(session, CheckIn, CheckIn.created_at)
    health = health_score(measurement, settings.measurement_stale_seconds)
    mood = mood_score(check_in, settings.checkin_stale_hours)
    alerts = measurement_alerts(measurement)
    if alerts:
        message = (
            "Some simulated readings are flagged. Ask the mission medical team to review them."
        )
    elif health.stale:
        message = "I am waiting for fresh sensor data. You can still complete your daily check-in."
    elif mood.stale:
        message = "Let us start with a fresh daily check-in."
    elif measurement.sleep_hours is not None and measurement.sleep_hours < 6:
        message = "Your latest sleep entry is short. Consider making space for rest today."
    elif mood.value is not None and mood.value < 50:
        message = (
            "Thank you for checking in. A small pause or crew connection may be a useful next step."
        )
    else:
        message = "Your daily missions are ready. Take a small step toward caring for yourself."
    return StatusOut(
        astronaut_id=settings.demo_astronaut_id,
        health=health,
        mood=mood,
        latest_measurement=measurement,
        latest_check_in=check_in,
        alerts=alerts,
        astronaut_message=message,
        mission_date=mission_day(),
        mission_timezone=settings.mission_timezone,
    )


def fallback_ids(summary: StatusOut) -> list[str]:
    if summary.alerts:
        return ["medical_review", "quiet_rest", "crew_connection"]
    first = (
        "quiet_rest"
        if summary.health.stale
        or (
            summary.latest_measurement
            and summary.latest_measurement.sleep_hours is not None
            and summary.latest_measurement.sleep_hours < 6
        )
        else "breathing_pause"
    )
    second = (
        "energy_note"
        if summary.latest_check_in and summary.latest_check_in.energy <= 2
        else "positive_moment"
    )
    return [first, second, "crew_connection"]


def ai_context(summary: StatusOut, trends: TrendSummary | None = None) -> dict:
    # Deliberately excludes free-text symptoms and journals from the external service.
    payload = {
        "contract_version": "1.0",
        "astronaut_id": summary.astronaut_id,
        "mission_date": str(summary.mission_date),
        "health": summary.health.model_dump(mode="json"),
        "mood": summary.mood.model_dump(mode="json"),
        "latest_measurement": summary.latest_measurement.model_dump(mode="json")
        if summary.latest_measurement
        else None,
        "check_in": {
            k: getattr(summary.latest_check_in, k)
            for k in ("mood", "stress", "energy", "loneliness")
        }
        if summary.latest_check_in
        else None,
        "alerts": summary.alerts,
        "task_catalog": [
            {
                "template_id": key,
                "category": TASK_CATALOG[key]["category"],
                "title": TASK_CATALOG[key]["title"],
            }
            for key in LEGACY_IDS
        ],
        "constraints": {
            "task_count": 3,
            "distinct_templates": True,
            "no_diagnosis": True,
        },
    }

    if get_settings().ai_contract_version == "1.1":
        payload.update(
            contract_version="1.1",
            trend_summary=(
                trends or TrendSummary(window_days=get_settings().ai_trend_window_days)
            ).model_dump(),
            task_catalog=[
                {"template_id": key, **value}
                for key, value in TASK_CATALOG.items()
                if key != "medical_review"
                and value["intensity"] == "low"
                and value["duration_minutes"] <= 10
            ],
            reason_catalog=[
                {"reason_code": key, "description": value} for key, value in REASON_CATALOG.items()
            ],
        )
        payload["constraints"].update(max_duration_minutes=10, allowed_intensities=["low"])
        return AIRequestV11.model_validate(payload).model_dump(mode="json")
    return payload


def select_tasks(
    summary: StatusOut, trends: TrendSummary | None = None
) -> tuple[list[str], str, str | None]:
    settings = get_settings()
    fallback = fallback_ids(summary)
    if summary.alerts:
        return fallback, "fallback", "flagged_measurements"
    if (
        summary.health.stale
        or summary.mood.stale
        or summary.health.value is None
        or summary.mood.value is None
    ):
        return fallback, "fallback", "insufficient_fresh_data"
    if not settings.ai_service_url:
        return fallback, "fallback", "ai_not_configured"
    headers = (
        {"Authorization": f"Bearer {settings.ai_service_token}"}
        if settings.ai_service_token
        else {}
    )
    payload = ai_context(summary, trends)
    allowed = {item["template_id"]: item for item in payload["task_catalog"]}
    try:
        with httpx.Client(timeout=settings.ai_timeout_seconds, follow_redirects=False) as client:
            response = client.post(settings.ai_service_url, json=payload, headers=headers)
        if response.status_code in (400, 422):
            return fallback, "fallback", "unsupported_ai_contract"
        response.raise_for_status()
        parsed = (
            AIResponseV11 if settings.ai_contract_version == "1.1" else AIResponse
        ).model_validate(response.json())
        ids = [task.template_id for task in parsed.tasks]
        if len(set(ids)) != 3 or any(
            task.template_id not in allowed
            or TASK_CATALOG[task.template_id]["category"] != task.category
            for task in parsed.tasks
        ):
            raise ValueError("Invalid task selection")
        if "medical_review" in ids:
            raise ValueError("Medical review is reserved for flagged readings")
        if settings.ai_contract_version == "1.1":
            if any(
                task.reason_code not in REASON_CATALOG
                or task.reason_code not in allowed[task.template_id]["reason_codes"]
                for task in parsed.tasks
            ):
                return fallback, "fallback", "invalid_ai_reason"
            ids = [Selection(task.template_id, task.reason_code) for task in parsed.tasks]
        return ids, "ai", None
    except httpx.TimeoutException:
        return fallback, "fallback", "ai_timeout"
    except httpx.HTTPError:
        return fallback, "fallback", "ai_unavailable"
    except (ValueError, TypeError):
        return fallback, "fallback", "invalid_ai_response"


def generate_missions(session: Session, force: bool = False) -> MissionsOut:
    # Serializes all generation calls for the demo astronaut across API workers.
    lock_astronaut(session)
    astronaut_id = get_settings().demo_astronaut_id
    day = mission_day()
    generation = session.scalar(
        select(MissionGeneration).where(
            MissionGeneration.astronaut_id == astronaut_id,
            MissionGeneration.mission_date == day,
        )
    )
    if generation is None or force:
        ids, source, reason = select_tasks(
            status(session),
            trend_summary(session, day) if get_settings().ai_contract_version == "1.1" else None,
        )
        if generation is None:
            generation = MissionGeneration(
                astronaut_id=astronaut_id,
                mission_date=day,
                source=source,
                fallback_reason=reason,
            )
            session.add(generation)
            session.flush()
        else:
            generation.revision += 1
            generation.source = source
            generation.fallback_reason = reason
            generation.updated_at = utcnow()
            # Keep completed missions and user tasks. Replace only unfinished generated tasks.
            existing = session.scalars(
                select(TodoItem).where(
                    TodoItem.generation_id == generation.id,
                    TodoItem.archived.is_(False),
                )
            ).all()
            completed_titles = {task.title for task in existing if task.completed}
            for task in existing:
                if not task.completed:
                    task.archived = True
            ids = [key for key in ids if TASK_CATALOG[key]["title"] not in completed_titles]
            # Three active generated missions maximum, including completed ones.
            slots = max(0, 3 - len(completed_titles))
            if len(ids) < slots:
                for key in fallback_ids(status(session)):
                    if key not in ids and TASK_CATALOG[key]["title"] not in completed_titles:
                        ids.append(key)
            ids = ids[:slots]
        for key in ids:
            session.add(
                TodoItem(
                    astronaut_id=astronaut_id,
                    generation_id=generation.id,
                    mission_date=day,
                    source=source,
                    title=TASK_CATALOG[key]["title"],
                    category=TASK_CATALOG[key]["category"],
                    reason_code=getattr(key, "reason_code", None),
                )
            )
        session.flush()
    tasks = session.scalars(
        select(TodoItem)
        .where(TodoItem.generation_id == generation.id, TodoItem.archived.is_(False))
        .order_by(TodoItem.created_at, TodoItem.id)
    ).all()
    return MissionsOut(
        generation_id=generation.id,
        mission_date=day,
        revision=generation.revision,
        source=generation.source,
        fallback_reason=generation.fallback_reason,
        tasks=[TodoOut.model_validate(task) for task in tasks],
    )
