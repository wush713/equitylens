import json
from sqlalchemy import func, select

from app.models import RunEventRecord


def save_checkpoint(db, run, stage: str, snapshot: dict, message: str) -> None:
    run.stage = stage
    run.checkpoint_json = json.dumps(snapshot, ensure_ascii=False, default=str)
    sequence = db.scalar(select(func.coalesce(func.max(RunEventRecord.sequence), 0)).where(RunEventRecord.run_id == run.id)) + 1
    db.add(RunEventRecord(run_id=run.id, sequence=sequence, stage=stage, message=message))
