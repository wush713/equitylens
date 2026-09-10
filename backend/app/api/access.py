"""本地演示的匿名工作区凭证，不是邮箱/密码认证。"""
import hashlib
from typing import Annotated

from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from app.models import RunRecord, SessionRecord


def workspace_hash(x_workspace_key: Annotated[str, Header(min_length=32, max_length=128)]) -> str:
    return hashlib.sha256(x_workspace_key.encode()).hexdigest()


def owned_session(db: Session, session_id: str, owner: str) -> SessionRecord:
    record = db.get(SessionRecord, session_id)
    if record is None or record.workspace_hash != owner:
        raise HTTPException(404, "会话不存在")
    return record


def owned_run(db: Session, run_id: str, owner: str) -> RunRecord:
    record = db.get(RunRecord, run_id)
    if record is None:
        raise HTTPException(404, "研究任务不存在")
    owned_session(db, record.session_id, owner)
    return record
