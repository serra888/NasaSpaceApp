from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.db import session_factory
from app.models import Measurement, MissionGeneration, TodoItem, utcnow
from app.seed import main as seed
from app.simulator import sample

pytestmark = pytest.mark.integration
CHECK_IN = {"mood": 2, "stress": 4, "energy": 2, "loneliness": 4}


def test_complete_flow_and_persistence(client):
    assert client.get("/ready").status_code == 200
    initial = client.get("/api/v1/status").json()
    assert initial["health"]["value"] is not None
    assert initial["mood"]["value"] is None
    result = client.post("/api/v1/check-ins", json=CHECK_IN)
    assert result.status_code == 201, result.text
    body = result.json()
    assert body["mood"]["value"] == 25
    assert len(body["missions"]["tasks"]) == 3
    tasks = client.get("/api/v1/todos").json()
    task_id = tasks[0]["id"]
    completed = client.patch(f"/api/v1/todos/{task_id}", json={"completed": True})
    assert completed.status_code == 200
    assert completed.json()["completed_at"] is not None
    again = client.patch(f"/api/v1/todos/{task_id}", json={"completed": True})
    assert again.json()["completed_at"] == completed.json()["completed_at"]
    assert (
        client.post(
            "/api/v1/journal", json={"text": "I enjoyed talking with the crew today."}
        ).status_code
        == 201
    )
    assert client.get("/api/v1/journal").json()[0]["text"].startswith("I enjoyed")
    assert len(client.get("/api/v1/check-ins").json()) == 1
    with session_factory()() as session:
        assert session.get(TodoItem, task_id).completed is True
    reopened = client.patch(f"/api/v1/todos/{task_id}", json={"completed": False}).json()
    assert reopened["completed_at"] is None


def test_daily_idempotency_and_explicit_refresh_preserve_completed_and_custom(client):
    first = client.post("/api/v1/check-ins", json=CHECK_IN).json()["missions"]
    again = client.post("/api/v1/check-ins", json=CHECK_IN).json()["missions"]
    assert first["generation_id"] == again["generation_id"]
    assert [t["id"] for t in first["tasks"]] == [t["id"] for t in again["tasks"]]
    done = first["tasks"][0]["id"]
    client.patch(f"/api/v1/todos/{done}", json={"completed": True})
    custom = client.post("/api/v1/todos", json={"title": "Review my mission journal."}).json()
    refreshed = client.post("/api/v1/missions/generate", json={"force": True}).json()
    assert refreshed["revision"] == 2
    assert len(refreshed["tasks"]) == 3
    assert next(t for t in refreshed["tasks"] if t["id"] == done)["completed"]
    assert len(client.get("/api/v1/todos").json()) == 4
    assert custom["id"] in {t["id"] for t in client.get("/api/v1/todos").json()}


def test_concurrent_generation_does_not_duplicate_tasks(client):
    with ThreadPoolExecutor(max_workers=4) as pool:
        responses = list(
            pool.map(lambda _: client.post("/api/v1/missions/generate", json={}), range(4))
        )
    assert all(r.status_code == 200 for r in responses)
    assert len({r.json()["generation_id"] for r in responses}) == 1
    with session_factory()() as session:
        assert session.scalar(select(func.count()).select_from(MissionGeneration)) == 1
        assert session.scalar(select(func.count()).select_from(TodoItem)) == 3


def test_simulated_new_reading_updates_status_but_not_missions(client):
    client.post("/api/v1/check-ins", json=CHECK_IN)
    before = client.get("/api/v1/status").json()
    with session_factory()() as session:
        session.add(sample(1, "low-sleep", utcnow() + timedelta(seconds=1)))
        session.commit()
    after = client.get("/api/v1/status").json()
    assert before["health"]["value"] > after["health"]["value"]
    assert before["mood"]["value"] == after["mood"]["value"]
    assert len(client.get("/api/v1/todos").json()) == 3


def test_flagged_measurement_produces_review_task(client):
    with session_factory()() as session:
        session.add(sample(1, "flagged", utcnow() + timedelta(seconds=1)))
        session.commit()
    result = client.post("/api/v1/check-ins", json=CHECK_IN).json()
    assert result["missions"]["fallback_reason"] == "flagged_measurements"
    assert "medical_review" in {t["category"] for t in result["missions"]["tasks"]}
    assert client.get("/api/v1/status").json()["alerts"]


def test_validation_missing_task_and_utc_history(client):
    invalid = client.post("/api/v1/check-ins", json={**CHECK_IN, "mood": 6})
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "validation_error"
    assert client.post("/api/v1/todos", json={"title": "  "}).status_code == 422
    assert client.patch("/api/v1/todos/missing", json={"completed": True}).status_code == 404
    assert client.get("/api/v1/measurements?start=2026-01-01T00:00:00").status_code == 422
    assert client.get("/api/v1/measurements?limit=0").status_code == 422
    assert client.get("/api/v1/dashboard?bucket=minute").status_code == 422
    assert client.get("/api/v1/dashboard?start=2020-01-01T00:00:00Z").status_code == 422
    assert client.get("/api/v1/measurements").json()[0]["source"] == "simulator"


def test_dashboard_aggregation_and_seed_are_idempotent(client):
    seed()
    seed()
    with session_factory()() as session:
        assert session.scalar(select(func.count()).select_from(Measurement)) == 1
    response = client.get("/api/v1/dashboard?bucket=day")
    assert response.status_code == 200, response.text
    points = response.json()["points"]
    assert len(points) >= 1
    assert sum(p["measurement_count"] for p in points) == 1
    assert sum(p["check_in_count"] for p in points) == 7
    assert points[-1]["mood"] is not None
