"""Independent deterministic sensor stream. Run: python -m app.simulator."""

import argparse
import math
import time
from uuid import uuid4

from sqlalchemy import func, select, text

from app.config import get_settings
from app.db import get_engine
from app.models import Measurement, utcnow


def sample(index: int, scenario: str = "normal", measured_at=None) -> Measurement:
    measured_at = measured_at or utcnow()
    day_index = measured_at.date().toordinal()
    scenario_sleep = 5.2 if scenario == "low-sleep" else 7.6 + (day_index % 3) * 0.2
    seconds_today = measured_at.hour * 3600 + measured_at.minute * 60 + measured_at.second
    return Measurement(
        astronaut_id=get_settings().demo_astronaut_id,
        measured_at=measured_at,
        heart_rate=round(74 + 4 * math.sin(index / 12), 1),
        spo2=None
        if scenario == "missing-data"
        else (89.0 if scenario == "flagged" else round(98 + 0.4 * math.sin(index / 18), 1)),
        sleep_hours=None if scenario == "missing-data" else round(scenario_sleep, 1),
        steps=int(seconds_today / 86400 * 6400),
        body_temperature_c=round(36.7 + 0.1 * math.sin(index / 24), 1),
        source="simulator",
    )


def main():
    parser = argparse.ArgumentParser(
        description="Write an Orbiton mock sensor measurement at a fixed interval."
    )
    parser.add_argument(
        "--scenario",
        choices=["normal", "low-sleep", "missing-data", "flagged"],
        default="normal",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=0,
        help="Stop after N measurements; zero runs until interrupted.",
    )
    args = parser.parse_args()
    if args.count < 0:
        parser.error("--count must be zero or greater")
    # A dedicated session-level advisory lock prevents duplicate simulators.
    with get_engine().connect() as connection:
        acquired = connection.scalar(text("SELECT pg_try_advisory_lock(7162026)"))
        connection.commit()
        if not acquired:
            raise SystemExit("An Orbiton simulator is already running against this database.")
        try:
            from app.models import Astronaut

            exists = connection.scalar(
                select(Astronaut.id).where(Astronaut.id == get_settings().demo_astronaut_id)
            )
            if not exists:
                raise SystemExit("Run migrations and python -m app.seed first.")
            index = connection.scalar(
                select(func.count())
                .select_from(Measurement)
                .where(Measurement.astronaut_id == get_settings().demo_astronaut_id)
            )
            connection.commit()
            written = 0
            while args.count == 0 or written < args.count:
                row = sample(index + written, args.scenario)
                connection.execute(
                    Measurement.__table__.insert().values(
                        id=str(uuid4()),
                        astronaut_id=row.astronaut_id,
                        measured_at=row.measured_at,
                        heart_rate=row.heart_rate,
                        spo2=row.spo2,
                        sleep_hours=row.sleep_hours,
                        steps=row.steps,
                        body_temperature_c=row.body_temperature_c,
                        source=row.source,
                    )
                )
                connection.commit()
                print(
                    f"Recorded {args.scenario} measurement at {row.measured_at.isoformat()}",
                    flush=True,
                )
                written += 1
                if args.count == 0 or written < args.count:
                    time.sleep(get_settings().simulator_interval_seconds)
        except KeyboardInterrupt:
            print("Simulator stopped.")
        finally:
            connection.rollback()
            connection.execute(text("SELECT pg_advisory_unlock(7162026)"))
            connection.commit()


if __name__ == "__main__":
    main()
