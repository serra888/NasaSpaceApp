from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow():
    return datetime.now(UTC)


def new_id():
    return str(uuid4())


class Astronaut(Base):
    __tablename__ = "astronauts"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))


class Measurement(Base):
    __tablename__ = "measurements"
    __table_args__ = (
        Index("ix_measurements_astronaut_time", "astronaut_id", "measured_at"),
        CheckConstraint("heart_rate IS NULL OR heart_rate BETWEEN 20 AND 250"),
        CheckConstraint("spo2 IS NULL OR spo2 BETWEEN 50 AND 100"),
        CheckConstraint("sleep_hours IS NULL OR sleep_hours BETWEEN 0 AND 24"),
        CheckConstraint("steps IS NULL OR steps >= 0"),
        CheckConstraint("body_temperature_c IS NULL OR body_temperature_c BETWEEN 30 AND 45"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"))
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    heart_rate: Mapped[float | None] = mapped_column(Float)
    spo2: Mapped[float | None] = mapped_column(Float)
    sleep_hours: Mapped[float | None] = mapped_column(Float)
    steps: Mapped[int | None] = mapped_column(Integer)
    body_temperature_c: Mapped[float | None] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(20), default="simulator")


class CheckIn(Base):
    __tablename__ = "check_ins"
    __table_args__ = (
        Index("ix_check_ins_astronaut_time", "astronaut_id", "created_at"),
        *(
            CheckConstraint(f"{field} BETWEEN 1 AND 5")
            for field in ("mood", "stress", "energy", "loneliness")
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    mood: Mapped[int] = mapped_column(Integer)
    stress: Mapped[int] = mapped_column(Integer)
    energy: Mapped[int] = mapped_column(Integer)
    loneliness: Mapped[int] = mapped_column(Integer)
    symptoms: Mapped[str | None] = mapped_column(Text)


class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    text: Mapped[str] = mapped_column(Text)


class MissionGeneration(Base):
    __tablename__ = "mission_generations"
    __table_args__ = (UniqueConstraint("astronaut_id", "mission_date", name="uq_generation_day"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"))
    mission_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    source: Mapped[str] = mapped_column(String(20))
    fallback_reason: Mapped[str | None] = mapped_column(String(40))
    revision: Mapped[int] = mapped_column(Integer, default=1)


class TodoItem(Base):
    __tablename__ = "todo_items"
    __table_args__ = (Index("ix_todos_astronaut_date", "astronaut_id", "mission_date"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"))
    generation_id: Mapped[str | None] = mapped_column(ForeignKey("mission_generations.id"))
    reason_code: Mapped[str | None] = mapped_column(String(40))
    mission_date: Mapped[date] = mapped_column(Date)
    title: Mapped[str] = mapped_column(String(240))
    category: Mapped[str] = mapped_column(String(30))
    source: Mapped[str] = mapped_column(String(20))
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
