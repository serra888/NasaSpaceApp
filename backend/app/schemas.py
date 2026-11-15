from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, computed_field

Rating = Annotated[int, Field(strict=True, ge=1, le=5)]
Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)]
Category = Literal[
    "rest",
    "breathing",
    "reflection",
    "social",
    "mobility",
    "medical_review",
    "recovery",
    "focus",
    "hydration",
]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CheckInCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mood: Rating
    stress: Rating
    energy: Rating
    loneliness: Rating
    symptoms: str | None = Field(default=None, max_length=2000)


class CheckInOut(CheckInCreate, ORMModel):
    id: str
    astronaut_id: str
    created_at: datetime


class MeasurementOut(ORMModel):
    id: str
    astronaut_id: str
    measured_at: datetime
    heart_rate: float | None
    spo2: float | None
    sleep_hours: float | None
    steps: int | None
    body_temperature_c: float | None
    source: str


class Score(BaseModel):
    value: int | None
    used_fields: list[str]
    missing_fields: list[str]
    calculated_at: datetime
    observed_at: datetime | None
    stale: bool
    is_demo: bool = True


class StatusOut(BaseModel):
    astronaut_id: str
    health: Score
    mood: Score
    latest_measurement: MeasurementOut | None
    latest_check_in: CheckInOut | None
    alerts: list[str]
    astronaut_message: str
    mission_date: date
    mission_timezone: str


class TodoCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: Title
    mission_date: date | None = None


class TodoPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    completed: bool = Field(strict=True)


class TodoOut(ORMModel):
    reason_code: str | None = None

    @computed_field
    @property
    def reason_text(self) -> str | None:
        from app.catalogs import REASON_CATALOG

        return REASON_CATALOG.get(self.reason_code)

    id: str
    astronaut_id: str
    generation_id: str | None
    mission_date: date
    title: str
    category: str
    source: str
    completed: bool
    completed_at: datetime | None
    created_at: datetime


class JournalCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10000)]


class JournalOut(JournalCreate, ORMModel):
    id: str
    astronaut_id: str
    created_at: datetime


class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    force: bool = False


class MissionsOut(BaseModel):
    generation_id: str
    mission_date: date
    revision: int
    source: str
    fallback_reason: str | None
    tasks: list[TodoOut]


class CheckInResult(BaseModel):
    check_in: CheckInOut
    mood: Score
    missions: MissionsOut


class AISuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_id: str
    category: Category


class AIResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tasks: list[AISuggestion] = Field(min_length=3, max_length=3)


class DashboardPoint(BaseModel):
    timestamp: datetime
    health: int | None
    mood: int | None
    heart_rate: float | None
    spo2: float | None
    sleep_hours: float | None
    steps: int | None
    body_temperature_c: float | None
    measurement_count: int
    check_in_count: int


class DashboardOut(BaseModel):
    start: datetime
    end: datetime
    bucket: str
    points: list[DashboardPoint]
    is_demo: bool = True


class AISuggestionV11(AISuggestion):
    reason_code: str


class AIResponseV11(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tasks: list[AISuggestionV11] = Field(min_length=3, max_length=3)


TrendValue = Literal["increasing", "stable", "decreasing", "insufficient_data"]


class TrendSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    window_days: int = Field(ge=2, le=7)
    sleep: TrendValue = "insufficient_data"
    mood: TrendValue = "insufficient_data"
    stress: TrendValue = "insufficient_data"
    energy: TrendValue = "insufficient_data"
    connection: TrendValue = "insufficient_data"


class CatalogTaskV11(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_id: str
    category: Category
    title: str
    duration_minutes: int = Field(strict=True, ge=1, le=20)
    intensity: Literal["low", "medium"]
    reason_codes: list[str] = Field(min_length=1)


class CatalogReason(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reason_code: str
    description: str


class AIConstraintsV11(BaseModel):
    model_config = ConfigDict(extra="forbid")
    task_count: Literal[3] = 3
    distinct_templates: Literal[True] = True
    no_diagnosis: Literal[True] = True
    max_duration_minutes: Literal[10] = 10
    allowed_intensities: list[Literal["low"]] = Field(
        default_factory=lambda: ["low"], min_length=1, max_length=1
    )


class AICheckIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mood: Rating
    stress: Rating
    energy: Rating
    loneliness: Rating


class AIRequestV11(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_version: Literal["1.1"]
    astronaut_id: str
    mission_date: date
    health: Score
    mood: Score
    latest_measurement: MeasurementOut | None
    check_in: AICheckIn | None
    trend_summary: TrendSummary
    alerts: list[str]
    task_catalog: list[CatalogTaskV11] = Field(min_length=3, max_length=30)
    reason_catalog: list[CatalogReason]
    constraints: AIConstraintsV11
