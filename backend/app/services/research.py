from __future__ import annotations

import hashlib
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select, text

from app.api.access import owned_session
from app.db import session_scope
from app.models import MessageRecord, RunRecord, SessionRecord


def write_lock(db) -> None:
    # SQLite development queue: serialize read/check/write transactions.
    if db.bind.dialect.name == "sqlite":
        db.execute(text("BEGIN IMMEDIATE"))


def create_session(title: str, owner: str) -> SessionRecord:
    record = SessionRecord(id=str(uuid4()), title=title.strip() or "新研究", workspace_hash=owner)
    with session_scope() as db:
        db.add(record)
    return record


def submit_message(session_id: str, content: str, key: str, owner: str) -> tuple[MessageRecord, RunRecord]:
    question = content.strip()
    request_hash = hashlib.sha256(question.encode("utf-8")).hexdigest()
    with session_scope() as db:
        write_lock(db)
        owned_session(db, session_id, owner)
        existing = db.scalar(select(RunRecord).where(
            RunRecord.session_id == session_id, RunRecord.idempotency_key == key,
        ))
        if existing:
            if existing.request_hash != request_hash:
                raise HTTPException(409, "相同幂等键对应了不同问题")
            message = db.scalar(select(MessageRecord).where(MessageRecord.run_id == existing.id, MessageRecord.role == "user"))
            return message, existing
        active = db.scalar(select(RunRecord).where(
            RunRecord.session_id == session_id, RunRecord.status.in_(["queued", "running"]),
        ))
        if active:
            raise HTTPException(409, "本会话已有研究任务，请等待完成或取消")
        run = RunRecord(id=str(uuid4()), session_id=session_id, question=question,
                        request_hash=request_hash, idempotency_key=key)
        db.add(run)
        db.flush()
        message = MessageRecord(id=str(uuid4()), session_id=session_id, run_id=run.id,
                                role="user", content=question)
        db.add(message)
        db.flush()
        db.add(MessageRecord(id=str(uuid4()), session_id=session_id, run_id=run.id,
                             role="assistant", content=""))
    return message, run
