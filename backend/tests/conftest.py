import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app import db
from app.main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine("sqlite:///" + str(tmp_path / "test.db"), connect_args={"check_same_thread": False, "timeout": 15})
    @event.listens_for(engine, "connect")
    def constraints(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA journal_mode=WAL")
    monkeypatch.setattr(db, "engine", engine)
    monkeypatch.setattr(db, "SessionLocal", sessionmaker(bind=engine, expire_on_commit=False))
    with TestClient(app, headers={"X-Workspace-Key": "test-workspace-" + "a" * 40}) as test_client:
        yield test_client
    engine.dispose()


@pytest.fixture
def submit(client):
    def run(question="分析贵州茅台最近两期的经营表现和主要风险", key="request-1"):
        session = client.post("/api/sessions", json={"title": "茅台黄金路径"})
        assert session.status_code == 201, session.text
        sid = session.json()["id"]
        response = client.post(f"/api/sessions/{sid}/messages", json={"content": question}, headers={"Idempotency-Key": key})
        assert response.status_code == 202, response.text
        return sid, response.json()["run_id"]
    return run
