from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    workspace_hash: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class MessageRecord(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class RunRecord(Base):
    __tablename__ = "runs"
    __table_args__ = (UniqueConstraint("session_id", "idempotency_key", name="uq_run_idempotency"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"), index=True)
    question: Mapped[str] = mapped_column(Text)
    request_hash: Mapped[str] = mapped_column(String(64))
    idempotency_key: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(24), default="queued", index=True)
    stage: Mapped[str] = mapped_column(String(24), default="queued")
    answer_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    checkpoint_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class RunEventRecord(Base):
    __tablename__ = "run_events"
    __table_args__ = (UniqueConstraint("run_id", "sequence", name="uq_run_event_sequence"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), index=True)
    sequence: Mapped[int]
    stage: Mapped[str] = mapped_column(String(24))
    message: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class EvidenceRecord(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(80), primary_key=True)
    provider: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(240))
    url: Mapped[str] = mapped_column(Text)
    published_at: Mapped[str] = mapped_column(String(10))
    locator: Mapped[str] = mapped_column(String(200))
    payload_json: Mapped[str] = mapped_column(Text)


class AnswerRecord(Base):
    __tablename__ = "answers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), unique=True, index=True)
    headline: Mapped[str] = mapped_column(String(240))
    summary: Mapped[str] = mapped_column(Text)
    period_label: Mapped[str] = mapped_column(String(120))
    limitation: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class ClaimRecord(Base):
    __tablename__ = "claims"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    answer_id: Mapped[str] = mapped_column(ForeignKey("answers.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    proposition: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20))
    evidence_ids_json: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int]
