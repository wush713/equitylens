import json

from fastapi import APIRouter, HTTPException

from app.db import session_scope
from app.models import EvidenceRecord
from app.schemas import EvidenceResponse


router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("/{evidence_id}", response_model=EvidenceResponse)
def get_evidence(evidence_id: str) -> EvidenceResponse:
    with session_scope() as db:
        evidence = db.get(EvidenceRecord, evidence_id)
        if evidence is None:
            raise HTTPException(status_code=404, detail="证据不存在")
        return EvidenceResponse(
            id=evidence.id,
            provider=evidence.provider,
            title=evidence.title,
            url=evidence.url,
            published_at=evidence.published_at,
            locator=evidence.locator,
            payload=json.loads(evidence.payload_json),
        )
