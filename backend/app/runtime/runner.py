from __future__ import annotations

import hashlib
import json
import time
from uuid import uuid4

from sqlalchemy import select

from app.config import settings
from app.db import session_scope
from app.models import AnswerRecord, ClaimRecord, EvidenceRecord, MessageRecord, RunRecord
from app.research.composer import compose_answer
from app.research.provider import FIXTURE_PATH, load_moutai_report, supports_question
from app.research.verifier import verify_claims, verify_report
from app.runtime.checkpoint import save_checkpoint
from app.runtime.state import STAGE_MESSAGES, TERMINAL_STATUSES
from app.services.research import write_lock

STAGES = ["route", "retrieve", "analyze", "verify", "compose"]


def process_run(run_id: str) -> None:
    """Single-worker deterministic research flow; resume committed boundaries."""
    try:
        for stage in STAGES:
            with session_scope() as db:
                run = db.get(RunRecord, run_id)
                if not run or run.status in TERMINAL_STATUSES:
                    return
                if run.stage in STAGES and STAGES.index(run.stage) >= STAGES.index(stage):
                    continue
                question = run.question
                snapshot = json.loads(run.checkpoint_json)
            if stage == "route":
                if not supports_question(question):
                    raise ValueError("本轮仅支持贵州茅台2025/2024完整年度经营与风险分析；其他公司、期间、行情或买卖问题尚未接入。")
                snapshot["contract"] = {"stock_code": "600519.SH", "periods": ["2025", "2024"], "mode": "fixed_report"}
            elif stage == "retrieve":
                report = load_moutai_report()
                verify_report(report)
                raw_hash = hashlib.sha256(FIXTURE_PATH.read_bytes()).hexdigest()
                report["evidence_id"] = f"moutai-annual-{raw_hash[:24]}"
                report["sample_sha256"] = raw_hash
                report["extraction_method"] = "官网年报固定字段摘录；哈希标识样本版本，不是PDF文件哈希"
                snapshot["report"] = report
            else:
                report = snapshot["report"]
                changes = verify_report(report)
                if stage in {"verify", "compose"}:
                    answer_data = compose_answer(report, changes)
                    verify_claims(answer_data["claims"], report, changes)

            with session_scope() as db:
                write_lock(db)
                run = db.get(RunRecord, run_id)
                if not run or run.status in TERMINAL_STATUSES:
                    return
                run.status = "running"
                if stage == "retrieve":
                    report = snapshot["report"]
                    source = report["source"]
                    if db.get(EvidenceRecord, report["evidence_id"]) is None:
                        db.add(EvidenceRecord(id=report["evidence_id"], provider=source["provider"],
                            title=source["title"], url=source["url"], published_at=source["published_at"],
                            locator=source["locator"], payload_json=json.dumps(report, ensure_ascii=False, default=str)))
                save_checkpoint(db, run, stage, snapshot, STAGE_MESSAGES[stage])
                if stage == "compose":
                    answer_id = str(uuid4())
                    db.add(AnswerRecord(id=answer_id, run_id=run_id,
                        headline=answer_data["headline"], summary=answer_data["summary"],
                        period_label=answer_data["period_label"], limitation=answer_data["limitation"]))
                    db.flush()
                    for index, claim in enumerate(answer_data["claims"]):
                        db.add(ClaimRecord(id=str(uuid4()), answer_id=answer_id, kind=claim["kind"],
                            proposition=claim["proposition"], status=claim["status"],
                            evidence_ids_json=json.dumps(claim["evidence_ids"]), sort_order=index))
                    message = db.scalar(select(MessageRecord).where(MessageRecord.run_id == run_id, MessageRecord.role == "assistant"))
                    message.content = answer_data["summary"]
                    run.answer_id = answer_id
                    run.status = "completed"
                    save_checkpoint(db, run, "completed", snapshot, STAGE_MESSAGES["completed"])
            if settings.stage_delay_seconds > 0:
                time.sleep(settings.stage_delay_seconds)
    except Exception as exc:
        with session_scope() as db:
            write_lock(db)
            run = db.get(RunRecord, run_id)
            if run and run.status not in TERMINAL_STATUSES:
                run.status = "failed"
                run.error = str(exc) if isinstance(exc, ValueError) else "研究执行异常，请查看本地Worker日志后重试"
                save_checkpoint(db, run, "failed", json.loads(run.checkpoint_json), run.error)
        if not isinstance(exc, ValueError):
            import logging
            logging.exception("研究任务失败 run_id=%s", run_id)
