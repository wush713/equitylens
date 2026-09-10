from concurrent.futures import ThreadPoolExecutor

from app.runtime.runner import process_run


def test_golden_path_persistence_evidence_and_sse(client, submit):
    sid, rid = submit()
    assert client.get(f"/api/runs/{rid}").json()["status"] == "queued"
    process_run(rid)
    result = client.get(f"/api/runs/{rid}").json()
    assert result["status"] == "completed", result
    assert result["answer"]["period_label"] == "2025年度 vs 2024年度"
    assert len(result["answer"]["claims"]) == 6
    assert "1688.38" in result["answer"]["claims"][0]["proposition"]
    assert "1.21%" in result["answer"]["claims"][0]["proposition"]
    evidence = client.get("/api/evidence/" + result["answer"]["claims"][0]["evidence_ids"][0]).json()
    assert evidence["payload"]["metrics"]["revenue"]["current"] == "168838102514.79"
    assert len(evidence["payload"]["sample_sha256"]) == 64
    assert "第6页" in evidence["locator"]
    history = client.get("/api/sessions").json()
    assert history[0]["id"] == sid
    assert [m["role"] for m in history[0]["messages"]] == ["user", "assistant"]
    assert history[0]["messages"][1]["run_id"] == rid
    events = client.get(f"/api/runs/{rid}/events", headers={"Last-Event-ID": "4"}).text
    assert "id: 4\n" not in events and "id: 5\n" in events
    assert "event: terminal" in events
    assert client.get(f"/api/runs/{rid}/events", headers={"Last-Event-ID": "abc"}).status_code == 400
    process_run(rid)  # A duplicate worker call cannot append another answer.
    assert len(client.get("/api/sessions").json()[0]["messages"]) == 2
    assert client.post(f"/api/runs/{rid}/cancel").json()["status"] == "completed"
    assert client.delete(f"/api/sessions/{sid}").status_code == 204
    assert client.get(f"/api/runs/{rid}").status_code == 404


def test_atomic_idempotency_and_conflicting_requests(client):
    sid = client.post("/api/sessions", json={"title": "并发提交"}).json()["id"]
    def post():
        return client.post(f"/api/sessions/{sid}/messages", json={"content": "分析茅台经营"}, headers={"Idempotency-Key": "same"})
    with ThreadPoolExecutor(max_workers=2) as pool:
        replies = list(pool.map(lambda _: post(), range(2)))
    assert [r.status_code for r in replies] == [202, 202]
    assert replies[0].json()["run_id"] == replies[1].json()["run_id"]
    assert len(client.get("/api/sessions").json()[0]["messages"]) == 2
    assert client.post(f"/api/sessions/{sid}/messages", json={"content": "不同内容"}, headers={"Idempotency-Key": "same"}).status_code == 409
    assert client.post(f"/api/sessions/{sid}/messages", json={"content": "分析茅台经营"}, headers={"Idempotency-Key": "new"}).status_code == 409


def test_workspace_isolation_and_invalid_input(client, submit):
    sid, rid = submit()
    other = {"X-Workspace-Key": "b" * 64}
    assert client.get("/api/sessions", headers=other).json() == []
    assert client.get(f"/api/runs/{rid}", headers=other).status_code == 404
    assert client.post(f"/api/runs/{rid}/cancel", headers=other).status_code == 404
    assert client.get(f"/api/runs/{rid}/events", headers=other).status_code == 404
    assert client.delete(f"/api/sessions/{sid}", headers=other).status_code == 404
    assert client.post(f"/api/sessions/{sid}/messages", json={"content": "   "}, headers={"Idempotency-Key": "x"}).status_code == 422


def test_unsupported_question_is_explicit_failure(client, submit):
    for question in ("分析宁德时代经营表现", "分析茅台2026半年报", "茅台今天股价多少", "对比茅台和招商银行", "茅台应该买入吗"):
        _, rid = submit(question)
        process_run(rid)
        result = client.get(f"/api/runs/{rid}").json()
        assert result["status"] == "failed"
        assert result["answer"] is None
