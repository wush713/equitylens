from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy import select

from app.api.access import owned_session, workspace_hash
from app.db import session_scope
from app.models import AnswerRecord, ClaimRecord, MessageRecord, RunEventRecord, RunRecord, SessionRecord
from app.schemas import CreateSessionRequest, MessageRequest, MessageSubmissionResponse, SessionResponse
from app.services.research import create_session, submit_message, write_lock


router = APIRouter(prefix="/sessions", tags=["sessions"])
Owner = Annotated[str, Depends(workspace_hash)]


@router.post("", response_model=SessionResponse, status_code=201)
def create_session_endpoint(body: CreateSessionRequest, owner: Owner):
    return SessionResponse.model_validate(create_session(body.title, owner))


@router.get("")
def list_sessions(owner: Owner):
    with session_scope() as db:
        sessions = db.scalars(select(SessionRecord).where(SessionRecord.workspace_hash == owner).order_by(SessionRecord.created_at.desc())).all()
        return [{"id": s.id, "title": s.title, "messages": [
            {"id": m.id, "role": m.role, "content": m.content, "run_id": m.run_id}
            for m in db.scalars(select(MessageRecord).where(MessageRecord.session_id == s.id).order_by(MessageRecord.created_at, MessageRecord.id))
        ]} for s in sessions]


@router.post("/{session_id}/messages", response_model=MessageSubmissionResponse, status_code=202)
def submit_message_endpoint(session_id: str, body: MessageRequest, owner: Owner,
                            idempotency_key: Annotated[str, Header(alias="Idempotency-Key", min_length=1, max_length=80)]):
    message, run = submit_message(session_id, body.content, idempotency_key, owner)
    return MessageSubmissionResponse(message_id=message.id, run_id=run.id, status=run.status)


@router.delete("/{session_id}", status_code=204)
def delete_session(session_id: str, owner: Owner):
    with session_scope() as db:
        write_lock(db)
        session = owned_session(db, session_id, owner)
        runs = db.scalars(select(RunRecord).where(RunRecord.session_id == session_id)).all()
        if any(r.status in {"running", "queued"} for r in runs):
            raise HTTPException(409, "请先完成或取消研究，再删除会话")
        for m in db.scalars(select(MessageRecord).where(MessageRecord.session_id == session_id)):
            db.delete(m)
        db.flush()
        for run in runs:
            answer = db.scalar(select(AnswerRecord).where(AnswerRecord.run_id == run.id))
            if answer:
                for claim in db.scalars(select(ClaimRecord).where(ClaimRecord.answer_id == answer.id)):
                    db.delete(claim)
                db.flush()
                db.delete(answer)
            for event in db.scalars(select(RunEventRecord).where(RunEventRecord.run_id == run.id)):
                db.delete(event)
            db.flush()
            db.delete(run)
        db.flush()
        db.delete(session)
    return Response(status_code=204)
