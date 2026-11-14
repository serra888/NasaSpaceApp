import os
from pathlib import Path

import pytest
from sqlalchemy.engine import make_url

# Set before application imports; production/local database must never be cleared by tests.
TEST_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_URL:
    parsed = make_url(TEST_URL)
    if not (parsed.database or "").endswith("_test") or parsed.drivername != "postgresql+psycopg":
        raise RuntimeError(
            "TEST_DATABASE_URL must be PostgreSQL and its database name must end in _test."
        )
    os.environ["DATABASE_URL"] = TEST_URL
    os.environ["AI_SERVICE_URL"] = ""


@pytest.fixture(scope="session")
def migrated_database():
    if not TEST_URL:
        pytest.skip("Set TEST_DATABASE_URL to an isolated PostgreSQL database ending in _test.")
    from alembic.config import Config

    from alembic import command
    from app.config import get_settings
    from app.db import get_engine

    get_settings.cache_clear()
    get_engine.cache_clear()
    command.upgrade(Config(str(Path(__file__).resolve().parents[1] / "alembic.ini")), "head")
    yield
    get_engine().dispose()


@pytest.fixture
def client(migrated_database):
    from fastapi.testclient import TestClient
    from sqlalchemy import text

    from app.config import get_settings
    from app.db import get_engine, session_factory
    from app.main import app
    from app.models import Astronaut
    from app.simulator import sample

    with get_engine().begin() as connection:
        connection.execute(
            text(
                "TRUNCATE todo_items, mission_generations, journal_entries, check_ins, measurements, astronauts CASCADE"
            )
        )
    with session_factory()() as session:
        session.add(Astronaut(id=get_settings().demo_astronaut_id, name="Orbiton Explorer"))
        session.flush()
        session.add(sample(0))
        session.commit()
    with TestClient(app) as test_client:
        yield test_client
