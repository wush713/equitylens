from __future__ import annotations

import asyncio
import json
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.db import session_scope
from app.models import AnswerRecord, ClaimRecord, RunEventRecord, RunRecord
from app.runtime.state import TERMINAL_STATUSES
from app.schemas import AnswerResponse, CancelRunResponse, ClaimResponse, RunEventResponse, RunResponse
from app.api.access import owned_run, workspace_hash
from app.services.research import write_lock
from app.runtime.checkpoint import save_checkpoint


router = APIRouter(prefix="/runs", tags=["runs"])


def load_run(run_id: str) -> RunResponse | None:
    with session_scope() as db:
        run = db.get(RunRecord, run_id)
        if run is None:
            return None
        events = db.scalars(select(RunEventRecord).where(RunEventRecord.run_id == run_id).order_by(RunEventRecord.sequence)).all()
        answer_response = None
        if run.answer_id and run.status == "completed":
            answer = db.get(AnswerRecord, run.answer_id)
            if answer:
                claims = db.scalars(select(ClaimRecord).where(ClaimRecord.answer_id == answer.id).order_by(ClaimRecord.sort_order)).all()
                answer_response = AnswerResponse(
                    id=answer.id,
                    headline=answer.headline,
                    summary=answer.summary,
                    period_label=answer.period_label,
                    limitation=answer.limitation,
                    claims=[ClaimResponse(
                        id=claim.id,
                        kind=claim.kind,
                        proposition=claim.proposition,
                        status=claim.status,
                        evidence_ids=json.loads(claim.evidence_ids_json),
                    ) for claim in claims],
                )
        return RunResponse(
            id=run.id,
            session_id=run.session_id,
            question=run.question,
            status=run.status,
            stage=run.stage,
            error=run.error,
            created_at=run.created_at,
            updated_at=run.updated_at,
            events=[RunEventResponse.model_validate(event, from_attributes=True) for event in events],
            answer=answer_response,
        )


@router.get("/{run_id}", response_model=RunResponse)
def get_run(run_id: str, owner: Annotated[str, Depends(workspace_hash)]) -> RunResponse:
    with session_scope() as db:
        owned_run(db, run_id, owner)
    result = load_run(run_id)
    if result is None:
        raise HTTPException(status_code=404, detail="研究任务不存在")
    return result


@router.post("/{run_id}/cancel", response_model=CancelRunResponse)
def cancel_run(run_id: str, owner: Annotated[str, Depends(workspace_hash)]) -> CancelRunResponse:
    with session_scope() as db:
        write_lock(db)
        run = owned_run(db, run_id, owner)
        if run.status not in TERMINAL_STATUSES:
            run.status = "cancelled"
            save_checkpoint(db, run, "cancelled", json.loads(run.checkpoint_json), "研究任务已取消")
        return CancelRunResponse(id=run.id, status=run.status)


@router.get("/{run_id}/events")
async def stream_run_events(run_id: str, request: Request, owner: Annotated[str, Depends(workspace_hash)],
                            after: int = Query(default=0, ge=0),
                            last_event_id: Annotated[str | None, Header()] = None) -> StreamingResponse:
    with session_scope() as db:
        owned_run(db, run_id, owner)
    try:
        cursor = max(after, int(last_event_id or 0))
    except ValueError:
        raise HTTPException(400, "事件游标必须是整数")

    async def generate():
        last_sequence = cursor
        while True:
            if await request.is_disconnected():
                return
            current = load_run(run_id)
            if current is None:
                return
            for event in current.events:
                if event.sequence > last_sequence:
                    yield f"id: {event.sequence}\nevent: progress\ndata: {event.model_dump_json()}\n\n"
                    last_sequence = event.sequence
            if current.status in TERMINAL_STATUSES:
                yield f"event: terminal\ndata: {current.model_dump_json()}\n\n"
                return
            yield ": heartbeat\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(generate(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
