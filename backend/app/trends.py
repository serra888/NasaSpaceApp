"""Demo summaries over completed mission-timezone days."""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select

from app.config import get_settings
from app.models import CheckIn, Measurement
from app.schemas import TrendSummary


def classify(values, threshold):
    if len(values) < 2 or any(value is None for value in values):
        return "insufficient_data"
    delta = values[-1] - values[0]
    return "increasing" if delta > threshold else "decreasing" if delta < -threshold else "stable"


def trend_summary(session, day):
    settings = get_settings()
    window = settings.ai_trend_window_days
    zone = ZoneInfo(settings.mission_timezone)
    dates = [day - timedelta(days=n) for n in range(window, 0, -1)]
    start = datetime.combine(dates[0], time.min, zone)
    end = datetime.combine(day, time.min, zone)
    values = {}
    for model, timestamp, fields in (
        (Measurement, Measurement.measured_at, ["sleep_hours"]),
        (CheckIn, CheckIn.created_at, ["mood", "stress", "energy", "loneliness"]),
    ):
        bucket = func.date(func.timezone(settings.mission_timezone, timestamp))
        rows = (
            session.execute(
                select(
                    bucket.label("day"),
                    *(func.avg(getattr(model, field)).label(field) for field in fields),
                )
                .where(
                    model.astronaut_id == settings.demo_astronaut_id,
                    timestamp >= start,
                    timestamp < end,
                )
                .group_by(bucket)
            )
            .mappings()
            .all()
        )
        by_day = {row["day"]: row for row in rows}
        for field in fields:
            values[field] = [
                float(by_day[d][field]) if d in by_day and by_day[d][field] is not None else None
                for d in dates
            ]
    connection = [6 - value if value is not None else None for value in values["loneliness"]]
    return TrendSummary(
        window_days=window,
        sleep=classify(values["sleep_hours"], 0.25),
        mood=classify(values["mood"], 0.5),
        stress=classify(values["stress"], 0.5),
        energy=classify(values["energy"], 0.5),
        connection=classify(connection, 0.5),
    )
