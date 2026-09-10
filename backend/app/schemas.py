from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateSessionRequest(BaseModel):
    title: str = Field(default="新研究", min_length=1, max_length=120)


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: datetime


class MessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("问题不能为空")
        return value.strip()


class MessageSubmissionResponse(BaseModel):
    message_id: str
    run_id: str
    status: str


class RunEventResponse(BaseModel):
    sequence: int
    stage: str
    message: str
    created_at: datetime


class ClaimResponse(BaseModel):
    id: str
    kind: str
    proposition: str
    status: str
    evidence_ids: list[str]


class AnswerResponse(BaseModel):
    id: str
    headline: str
    summary: str
    period_label: str
    limitation: str
    claims: list[ClaimResponse]


class RunResponse(BaseModel):
    id: str
    session_id: str
    question: str
    status: str
    stage: str
    error: str | None
    created_at: datetime
    updated_at: datetime
    events: list[RunEventResponse]
    answer: AnswerResponse | None


class EvidenceResponse(BaseModel):
    id: str
    provider: str
    title: str
    url: str
    published_at: str
    locator: str
    payload: dict[str, object]


class CancelRunResponse(BaseModel):
    id: str
    status: str
