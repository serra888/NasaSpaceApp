from datetime import date
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Astronaut,
    CheckIn,
    Measurement,
    MissionGeneration,
    TodoItem,
    utcnow,
)
from app.schemas import AIResponse, MissionsOut, StatusOut, TodoOut
from app.scoring import health_score, measurement_alerts, mood_score

# The model selects IDs, never executable instructions or arbitrary medical advice.
TASK_CATALOG = {
    "quiet_rest": {"category": "rest", "title": "Take a five-minute quiet rest break."},
    "breathing_pause": {
        "category": "breathing",
        "title": "Take a short, comfortable breathing break.",
    },
    "positive_moment": {
        "category": "reflection",
        "title": "Write down one positive moment from today.",
    },
    "energy_note": {
        "category": "reflection",
        "title": "Note how your energy has changed today.",
    },
    "crew_connection": {
        "category": "social",
        "title": "Check in with a crew member for a few minutes.",
    },
    "gentle_mobility": {
        "category": "mobility",
        "title": "Try a brief, comfortable mobility break if your mission guidance allows it.",
    },
    "medical_review": {
        "category": "medical_review",
        "title": "Ask the mission medical team to review the flagged readings.",
    },
}


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


def ai_context(summary: StatusOut) -> dict:
    # Deliberately excludes free-text symptoms and journals from the external service.
    return {
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
        "task_catalog": [{"template_id": key, **value} for key, value in TASK_CATALOG.items()],
        "constraints": {
            "task_count": 3,
            "distinct_templates": True,
            "no_diagnosis": True,
        },
    }


def select_tasks(summary: StatusOut) -> tuple[list[str], str, str | None]:
    settings = get_settings()
    fallback = fallback_ids(summary)
    if summary.alerts:
        return fallback, "fallback", "flagged_measurements"
    if summary.health.stale or summary.mood.stale or summary.health.value is None:
        return fallback, "fallback", "insufficient_fresh_data"
    if not settings.ai_service_url:
        return fallback, "fallback", "ai_not_configured"
    headers = (
        {"Authorization": f"Bearer {settings.ai_service_token}"}
        if settings.ai_service_token
        else {}
    )
    try:
        with httpx.Client(timeout=settings.ai_timeout_seconds, follow_redirects=False) as client:
            response = client.post(
                settings.ai_service_url, json=ai_context(summary), headers=headers
            )
        response.raise_for_status()
        parsed = AIResponse.model_validate(response.json())
        ids = [task.template_id for task in parsed.tasks]
        if len(set(ids)) != 3 or any(
            task.template_id not in TASK_CATALOG
            or TASK_CATALOG[task.template_id]["category"] != task.category
            for task in parsed.tasks
        ):
            raise ValueError("Invalid task selection")
        if "medical_review" in ids:
            raise ValueError("Medical review is reserved for flagged readings")
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
        ids, source, reason = select_tasks(status(session))
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
                    **TASK_CATALOG[key],
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
