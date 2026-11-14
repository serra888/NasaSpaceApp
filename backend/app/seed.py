"""Idempotent demo fixtures, distinct from the live simulator."""

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.config import get_settings
from app.db import session_factory
from app.models import Astronaut, CheckIn, Measurement, utcnow
from app.simulator import sample


def main():
    astronaut_id = get_settings().demo_astronaut_id
    with session_factory()() as session:
        session.execute(
            insert(Astronaut)
            .values(id=astronaut_id, name="Orbiton Explorer")
            .on_conflict_do_nothing()
        )
        session.scalar(select(Astronaut).where(Astronaut.id == astronaut_id).with_for_update())
        now = utcnow()
        if (
            session.scalar(
                select(Measurement.id).where(Measurement.astronaut_id == astronaut_id).limit(1)
            )
            is None
        ):
            # Seven days of hourly history, including a current sample.
            for hour in range(168, -1, -1):
                row = sample(168 - hour, measured_at=now - timedelta(hours=hour))
                row.source = "seed"
                session.add(row)
        if (
            session.scalar(select(CheckIn.id).where(CheckIn.astronaut_id == astronaut_id).limit(1))
            is None
        ):
            for day in range(6, -1, -1):
                session.add(
                    CheckIn(
                        astronaut_id=astronaut_id,
                        created_at=now - timedelta(days=day),
                        mood=3 + day % 2,
                        stress=2 + day % 2,
                        energy=3,
                        loneliness=2,
                    )
                )
        session.commit()
    print("Orbiton demo data is ready. Existing records were preserved.")


if __name__ == "__main__":
    main()
