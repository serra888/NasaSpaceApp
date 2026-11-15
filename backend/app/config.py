from functools import lru_cache
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")
    app_name: str = "Orbiton"
    database_url: str = "postgresql+psycopg://orbiton:orbiton_local@localhost:5432/orbiton"
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    mission_timezone: str = "UTC"
    demo_astronaut_id: str = "orbiton-demo"
    simulator_interval_seconds: float = Field(default=5, ge=1)
    measurement_stale_seconds: int = Field(default=30, ge=1)
    checkin_stale_hours: int = Field(default=24, ge=1)
    ai_contract_version: Literal["1.0", "1.1"] = "1.0"
    ai_trend_window_days: int = Field(default=3, ge=2, le=7)
    ai_service_url: str = ""
    ai_service_token: str = ""
    ai_timeout_seconds: float = Field(default=8, ge=0.1, le=30)

    @field_validator("database_url")
    @classmethod
    def postgres_only(cls, value: str) -> str:
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("DATABASE_URL must use postgresql+psycopg://")
        return value

    @field_validator("mission_timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        ZoneInfo(value)
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
