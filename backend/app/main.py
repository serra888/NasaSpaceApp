from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException

from app.config import get_settings
from app.db import get_session
from app.models import Astronaut, CheckIn, JournalEntry, Measurement, TodoItem, utcnow
from app.schemas import (
    CheckInCreate,
    CheckInOut,
    CheckInResult,
    DashboardOut,
    DashboardPoint,
    GenerateRequest,
    JournalCreate,
    JournalOut,
    MeasurementOut,
    MissionsOut,
    StatusOut,
    TodoCreate,
    TodoOut,
    TodoPatch,
)
from app.scoring import health_score, mood_score
from app.services import generate_missions, lock_astronaut, mission_day, status

settings = get_settings()
app = FastAPI(
    title="Orbiton API",
    version="1.0.0",
    description="Single-astronaut hackathon demo. Health and mood indicators are not clinical scores.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Content-Type"],
)
DB = Annotated[Session, Depends(get_session, scope="function")]
PREFIX = "/api/v1"


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": f"http_{exc.status_code}", "message": str(exc.detail)}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    fields = [
        {"location": list(error["loc"]), "message": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "validation_error",
                "message": "Request validation failed.",
                "fields": fields,
            }
        },
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, exc: SQLAlchemyError):
    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "database_unavailable",
                "message": "The database is temporarily unavailable.",
            }
        },
    )


def ensure_astronaut(db: DB):
    if db.get(Astronaut, settings.demo_astronaut_id) is None:
        raise HTTPException(
            503,
            "Demo astronaut is not initialized. Run migrations and the seed command.",
        )


@app.get("/health", tags=["Operations"])
def health():
    return {"status": "ok", "service": "Orbiton", "version": "1.0.0"}


@app.get("/ready", tags=["Operations"])
def ready(db: DB):
    db.execute(text("SELECT 1"))
    ensure_astronaut(db)
    return {"status": "ready", "database": "postgresql"}


@app.get(
    PREFIX + "/status",
    response_model=StatusOut,
    tags=["Status"],
    dependencies=[Depends(ensure_astronaut)],
)
def get_status(db: DB):
    return status(db)


def time_range(start: datetime | None, end: datetime | None):
    if any(value is not None and value.utcoffset() is None for value in (start, end)):
        raise HTTPException(
            422, "Timestamps must include a timezone, for example 2026-11-14T00:00:00Z."
        )
    end = end or utcnow()
    start = start or end - timedelta(days=7)
    if start >= end:
        raise HTTPException(422, "start must be earlier than end.")
    return start, end


def history(db, model, time_column, start, end, limit, offset):
    start, end = time_range(start, end)
    return db.scalars(
        select(model)
        .where(
            model.astronaut_id == settings.demo_astronaut_id,
            time_column >= start,
            time_column < end,
        )
        .order_by(time_column.asc(), model.id.asc())
        .limit(limit)
        .offset(offset)
    ).all()


@app.get(PREFIX + "/measurements", response_model=list[MeasurementOut], tags=["Measurements"])
def measurements(
    db: DB,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    return history(db, Measurement, Measurement.measured_at, start, end, limit, offset)


@app.post(
    PREFIX + "/check-ins",
    response_model=CheckInResult,
    status_code=201,
    tags=["Check-ins"],
    dependencies=[Depends(ensure_astronaut)],
)
def create_check_in(body: CheckInCreate, db: DB):
    lock_astronaut(db)
    row = CheckIn(astronaut_id=settings.demo_astronaut_id, **body.model_dump())
    db.add(row)
    db.flush()
    missions = generate_missions(db)
    return CheckInResult(
        check_in=CheckInOut.model_validate(row),
        mood=mood_score(row, settings.checkin_stale_hours),
        missions=missions,
    )


@app.get(PREFIX + "/check-ins", response_model=list[CheckInOut], tags=["Check-ins"])
def check_ins(
    db: DB,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    return history(db, CheckIn, CheckIn.created_at, start, end, limit, offset)


@app.post(
    PREFIX + "/missions/generate",
    response_model=MissionsOut,
    tags=["Missions"],
    dependencies=[Depends(ensure_astronaut)],
)
def missions(body: GenerateRequest, db: DB):
    return generate_missions(db, body.force)


@app.get(PREFIX + "/todos", response_model=list[TodoOut], tags=["Tasks"])
def todos(db: DB, mission_date: date | None = None):
    return db.scalars(
        select(TodoItem)
        .where(
            TodoItem.astronaut_id == settings.demo_astronaut_id,
            TodoItem.mission_date == (mission_date or mission_day()),
            TodoItem.archived.is_(False),
        )
        .order_by(TodoItem.created_at, TodoItem.id)
    ).all()


@app.post(
    PREFIX + "/todos",
    response_model=TodoOut,
    status_code=201,
    tags=["Tasks"],
    dependencies=[Depends(ensure_astronaut)],
)
def create_todo(body: TodoCreate, db: DB):
    row = TodoItem(
        astronaut_id=settings.demo_astronaut_id,
        mission_date=body.mission_date or mission_day(),
        title=body.title,
        category="custom",
        source="user",
    )
    db.add(row)
    db.flush()
    return row


@app.patch(
    PREFIX + "/todos/{todo_id}",
    response_model=TodoOut,
    tags=["Tasks"],
    dependencies=[Depends(ensure_astronaut)],
)
def update_todo(todo_id: str, body: TodoPatch, db: DB):
    lock_astronaut(db)
    row = db.scalar(
        select(TodoItem)
        .where(
            TodoItem.id == todo_id,
            TodoItem.astronaut_id == settings.demo_astronaut_id,
            TodoItem.archived.is_(False),
        )
        .with_for_update()
    )
    if row is None:
        raise HTTPException(404, "Task not found.")
    if row.completed != body.completed:
        row.completed = body.completed
        row.completed_at = utcnow() if body.completed else None
    db.flush()
    return row


@app.post(
    PREFIX + "/journal",
    response_model=JournalOut,
    status_code=201,
    tags=["Journal"],
    dependencies=[Depends(ensure_astronaut)],
)
def create_journal(body: JournalCreate, db: DB):
    row = JournalEntry(astronaut_id=settings.demo_astronaut_id, text=body.text)
    db.add(row)
    db.flush()
    return row


@app.get(PREFIX + "/journal", response_model=list[JournalOut], tags=["Journal"])
def journal(
    db: DB,
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    return history(db, JournalEntry, JournalEntry.created_at, start, end, limit, offset)


@app.get(PREFIX + "/dashboard", response_model=DashboardOut, tags=["Dashboard"])
def dashboard(
    db: DB,
    start: datetime | None = None,
    end: datetime | None = None,
    bucket: Literal["hour", "day"] = "hour",
):
    start, end = time_range(start, end)
    if end - start > timedelta(days=31):
        raise HTTPException(422, "Dashboard range cannot exceed 31 days.")
    # SQL aggregation keeps five-second streams bounded. Buckets are always UTC.
    m_bucket = func.date_trunc(bucket, Measurement.measured_at, "UTC").label("timestamp")
    m_rows = (
        db.execute(
            select(
                m_bucket,
                *(
                    func.avg(getattr(Measurement, field)).label(field)
                    for field in (
                        "heart_rate",
                        "spo2",
                        "sleep_hours",
                        "body_temperature_c",
                    )
                ),
                func.max(Measurement.steps).label("steps"),
                func.count().label("count"),
            )
            .where(
                Measurement.astronaut_id == settings.demo_astronaut_id,
                Measurement.measured_at >= start,
                Measurement.measured_at < end,
            )
            .group_by(m_bucket)
        )
        .mappings()
        .all()
    )
    c_bucket = func.date_trunc(bucket, CheckIn.created_at, "UTC").label("timestamp")
    c_rows = (
        db.execute(
            select(
                c_bucket,
                *(
                    func.avg(getattr(CheckIn, field)).label(field)
                    for field in ("mood", "stress", "energy", "loneliness")
                ),
                func.count().label("count"),
            )
            .where(
                CheckIn.astronaut_id == settings.demo_astronaut_id,
                CheckIn.created_at >= start,
                CheckIn.created_at < end,
            )
            .group_by(c_bucket)
        )
        .mappings()
        .all()
    )
    measurements_by_time = {r["timestamp"]: r for r in m_rows}
    check_ins_by_time = {r["timestamp"]: r for r in c_rows}
    points = []
    for timestamp in sorted(measurements_by_time.keys() | check_ins_by_time.keys()):
        m = measurements_by_time.get(timestamp)
        c = check_ins_by_time.get(timestamp)
        measurement = (
            Measurement(
                measured_at=timestamp,
                **{
                    k: m[k]
                    for k in (
                        "heart_rate",
                        "spo2",
                        "sleep_hours",
                        "steps",
                        "body_temperature_c",
                    )
                },
            )
            if m
            else None
        )
        check_in = (
            CheckIn(
                created_at=timestamp,
                **{k: c[k] for k in ("mood", "stress", "energy", "loneliness")},
            )
            if c
            else None
        )
        points.append(
            DashboardPoint(
                timestamp=timestamp,
                health=health_score(measurement).value,
                mood=mood_score(check_in).value,
                heart_rate=m["heart_rate"] if m else None,
                spo2=m["spo2"] if m else None,
                sleep_hours=m["sleep_hours"] if m else None,
                steps=m["steps"] if m else None,
                body_temperature_c=m["body_temperature_c"] if m else None,
                measurement_count=m["count"] if m else 0,
                check_in_count=c["count"] if c else 0,
            )
        )
    return DashboardOut(
        start=start.astimezone(UTC),
        end=end.astimezone(UTC),
        bucket=bucket,
        points=points,
    )
