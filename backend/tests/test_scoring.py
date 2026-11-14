from datetime import timedelta

from app.models import CheckIn, Measurement, utcnow
from app.scoring import health_score, mood_score
from app.simulator import sample


def test_health_and_mood_are_independent():
    now = utcnow()
    m = Measurement(measured_at=now, heart_rate=75, spo2=99, sleep_hours=8)
    c = CheckIn(created_at=now, mood=1, stress=5, energy=1, loneliness=5)
    assert health_score(m).value == 97
    assert mood_score(c).value == 0
    c.mood = c.energy = 5
    c.stress = c.loneliness = 1
    assert mood_score(c).value == 100
    assert health_score(m).value == 97


def test_missing_data_is_not_zero_and_partial_weights_are_normalized():
    assert health_score(None).value is None
    assert mood_score(None).value is None
    m = Measurement(measured_at=utcnow(), heart_rate=75)
    assert health_score(m).value is None
    assert set(health_score(m).missing_fields) == {"spo2", "sleep_hours"}
    m.sleep_hours = 8
    assert health_score(m).value == 100


def test_stale_data_retains_value_but_is_marked():
    now = utcnow()
    row = Measurement(measured_at=now - timedelta(minutes=1), heart_rate=75, spo2=99, sleep_hours=8)
    assert health_score(row, now=now).stale
    assert health_score(row, now=now).value == 97


def test_simulation_is_deterministic_and_sleep_stays_daily():
    now = utcnow()
    first = sample(10, measured_at=now)
    second = sample(11, measured_at=now + timedelta(seconds=5))
    assert first.sleep_hours == second.sleep_hours
    assert abs(first.heart_rate - second.heart_rate) <= 1
    assert sample(10, "missing-data", now).spo2 is None
