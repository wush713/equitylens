from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# 系统环境变量优先；仅从后端目录读取本地配置。
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


def _origins() -> tuple[str, ...]:
    raw = os.getenv("CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173")
    return tuple(value.strip() for value in raw.split(",") if value.strip())


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./data/equitylens.db")
    cors_origins: tuple[str, ...] = _origins()
    stage_delay_seconds: float = float(os.getenv("RESEARCH_STAGE_DELAY_SECONDS", "0"))


settings = Settings()
