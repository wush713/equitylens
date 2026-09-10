from types import SimpleNamespace

import pytest

from app.runtime import runner
from app.api.runs import load_run


def test_resume_uses_committed_evidence(client, submit, monkeypatch):
    _, rid = submit()
    monkeypatch.setattr(runner, "settings", SimpleNamespace(stage_delay_seconds=0.01))
    def interrupt(_):
        if load_run(rid).stage == "retrieve":
            raise SystemExit("模拟Worker退出")
    monkeypatch.setattr(runner.time, "sleep", interrupt)
    with pytest.raises(SystemExit):
        runner.process_run(rid)
    assert load_run(rid).stage == "retrieve"
    assert load_run(rid).answer is None
    def should_not_reload():
        raise AssertionError("已提交证据不应重新读取")
    monkeypatch.setattr(runner, "load_moutai_report", should_not_reload)
    monkeypatch.setattr(runner, "settings", SimpleNamespace(stage_delay_seconds=0))
    runner.process_run(rid)
    result = client.get(f"/api/runs/{rid}").json()
    assert result["status"] == "completed", result
    assert [e["stage"] for e in result["events"]] == ["route", "retrieve", "analyze", "verify", "compose", "completed"]


def test_cancel_before_and_during_execution(client, submit, monkeypatch):
    sid, rid = submit()
    assert client.delete(f"/api/sessions/{sid}").status_code == 409
    client.post(f"/api/runs/{rid}/cancel")
    runner.process_run(rid)
    assert load_run(rid).status == "cancelled"
    assert load_run(rid).answer is None
    _, running_id = submit()
    monkeypatch.setattr(runner, "settings", SimpleNamespace(stage_delay_seconds=0.01))
    def cancel_at_boundary(_):
        if load_run(running_id).stage == "verify":
            client.post(f"/api/runs/{running_id}/cancel")
    monkeypatch.setattr(runner.time, "sleep", cancel_at_boundary)
    runner.process_run(running_id)
    assert load_run(running_id).status == "cancelled"
    assert load_run(running_id).answer is None
