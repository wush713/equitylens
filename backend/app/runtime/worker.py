"""运行方式：python -m app.runtime.worker；SQLite 开发版限定单 Worker。"""
import fcntl
import time
from pathlib import Path

from sqlalchemy import select

from app.db import engine, init_db, session_scope
from app.models import RunRecord
from app.runtime.runner import process_run


def run_once() -> bool:
    with session_scope() as db:
        run_id = db.scalar(select(RunRecord.id).where(RunRecord.status.in_(["running", "queued"])).order_by(RunRecord.created_at))
    if run_id is None:
        return False
    process_run(run_id)
    return True


def main() -> None:
    if engine.dialect.name != "sqlite":
        raise SystemExit("首版Worker仅支持本机SQLite；PostgreSQL租约和迁移尚待实现")
    database_path = Path(engine.url.database).resolve()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    with database_path.with_suffix(".worker.lock").open("a") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit("当前数据库已有Worker运行")
        init_db()
        print("EquityLens Worker 已启动（固定年报样本，单进程，支持边界恢复）", flush=True)
        try:
            while True:
                if not run_once():
                    time.sleep(0.3)
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
