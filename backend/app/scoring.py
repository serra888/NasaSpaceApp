from datetime import datetime

from app.models import CheckIn, Measurement, utcnow
from app.schemas import Score

HEALTH_FIELDS = ("heart_rate", "spo2", "sleep_hours")
MOOD_FIELDS = ("mood", "stress", "energy", "loneliness")


def clamp(value):
    return max(0, min(100, value))


def health_score(
    measurement: Measurement | None, stale_seconds=30, now: datetime | None = None
) -> Score:
    now = now or utcnow()
    values = {field: getattr(measurement, field, None) for field in HEALTH_FIELDS}
    used = [key for key, value in values.items() if value is not None]
    parts = {}
    if values["heart_rate"] is not None:
        hr = values["heart_rate"]
        parts["heart_rate"] = clamp(100 - max(60 - hr, 0, hr - 100) * 2)
    if values["spo2"] is not None:
        parts["spo2"] = clamp((values["spo2"] - 90) * 10)
    if values["sleep_hours"] is not None:
        parts["sleep_hours"] = clamp(100 - abs(values["sleep_hours"] - 8) * 15)
    weights = {"heart_rate": 0.3, "spo2": 0.3, "sleep_hours": 0.4}
    value = (
        round(sum(parts[k] * weights[k] for k in parts) / sum(weights[k] for k in parts))
        if len(parts) >= 2
        else None
    )
    observed = measurement.measured_at if measurement else None
    return Score(
        value=value,
        used_fields=used,
        missing_fields=[k for k in HEALTH_FIELDS if k not in used],
        calculated_at=now,
        observed_at=observed,
        stale=observed is None or (now - observed).total_seconds() > stale_seconds,
    )


def mood_score(check_in: CheckIn | None, stale_hours=24, now: datetime | None = None) -> Score:
    now = now or utcnow()
    value = None
    if check_in:
        value = round(
            (
                (check_in.mood - 1)
                + (5 - check_in.stress)
                + (check_in.energy - 1)
                + (5 - check_in.loneliness)
            )
            / 16
            * 100
        )
    observed = check_in.created_at if check_in else None
    return Score(
        value=value,
        used_fields=list(MOOD_FIELDS) if check_in else [],
        missing_fields=[] if check_in else list(MOOD_FIELDS),
        calculated_at=now,
        observed_at=observed,
        stale=observed is None or (now - observed).total_seconds() > stale_hours * 3600,
    )


def measurement_alerts(measurement: Measurement | None) -> list[str]:
    if not measurement:
        return []
    alerts = []
    if measurement.spo2 is not None and measurement.spo2 < 92:
        alerts.append("Low simulated oxygen reading. Ask the mission medical team to review it.")
    if measurement.heart_rate is not None and not 40 <= measurement.heart_rate <= 130:
        alerts.append("Unusual simulated heart rate. Ask the mission medical team to review it.")
    if (
        measurement.body_temperature_c is not None
        and not 35 <= measurement.body_temperature_c <= 38
    ):
        alerts.append("Unusual simulated temperature. Ask the mission medical team to review it.")
    return alerts
