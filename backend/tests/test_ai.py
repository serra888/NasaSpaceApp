import httpx
import pytest

from app.config import get_settings
from app.models import CheckIn, utcnow
from app.schemas import StatusOut
from app.scoring import health_score, mood_score
from app.services import ai_context, select_tasks
from app.simulator import sample


def summary():
    measurement = sample(0)
    measurement.id = "measurement-demo"
    check_in = CheckIn(
        id="checkin-demo",
        astronaut_id="orbiton-demo",
        created_at=utcnow(),
        mood=3,
        stress=3,
        energy=3,
        loneliness=3,
        symptoms="Private symptom note",
    )
    return StatusOut(
        astronaut_id="orbiton-demo",
        health=health_score(measurement),
        mood=mood_score(check_in),
        latest_measurement=measurement,
        latest_check_in=check_in,
        alerts=[],
        astronaut_message="Ready.",
        mission_date=utcnow().date(),
        mission_timezone="UTC",
    )


def mock_ai(monkeypatch, payload=None, failure=None):
    settings = get_settings()
    monkeypatch.setattr(settings, "ai_service_url", "https://ai.example.test/generate")
    real_client = httpx.Client

    def handler(request):
        if failure:
            raise failure
        return httpx.Response(200, json=payload)

    monkeypatch.setattr(
        "app.services.httpx.Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
    )


def test_ai_can_select_only_approved_templates(monkeypatch):
    payload = {
        "tasks": [
            {"template_id": "quiet_rest", "category": "rest"},
            {"template_id": "positive_moment", "category": "reflection"},
            {"template_id": "crew_connection", "category": "social"},
        ]
    }
    mock_ai(monkeypatch, payload)
    ids, source, reason = select_tasks(summary())
    assert source == "ai" and reason is None
    assert len(ids) == 3


@pytest.mark.parametrize(
    "tasks",
    [
        [],
        [{"template_id": "unknown", "category": "rest"}] * 3,
        [{"template_id": "quiet_rest", "category": "rest"}] * 3,
        [{"template_id": "quiet_rest", "category": "social"}] * 3,
    ],
)
def test_invalid_ai_output_falls_back(monkeypatch, tasks):
    mock_ai(monkeypatch, {"tasks": tasks})
    ids, source, reason = select_tasks(summary())
    assert len(ids) == 3 and source == "fallback" and reason == "invalid_ai_response"


def test_ai_timeout_falls_back(monkeypatch):
    mock_ai(monkeypatch, failure=httpx.ReadTimeout("timeout"))
    assert select_tasks(summary())[2] == "ai_timeout"


def test_flagged_data_never_calls_ai(monkeypatch):
    data = summary()
    data.alerts = ["Flagged simulated reading."]
    monkeypatch.setattr(get_settings(), "ai_service_url", "https://ai.example.test/generate")
    ids, source, reason = select_tasks(data)
    assert ids[0] == "medical_review" and source == "fallback" and reason == "flagged_measurements"


def test_private_text_is_excluded_from_ai_context():
    context = ai_context(summary())
    assert "symptoms" not in context["check_in"]
    assert "Private symptom note" not in str(context)
