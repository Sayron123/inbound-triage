import json
from types import SimpleNamespace

import httpx
import pytest
import main
from fastapi.testclient import TestClient
from main import app
from postgrest.exceptions import APIError

client = TestClient(app)
GOOD = {"name": "A", "email": "a@b.com", "text": "hi"}
HEADERS = {"X-Webhook-Secret": "right"}


class FakeSupabase:
    """Stands in for the Supabase client. Records inserted rows and enforces a unique
    external_id like the real column does. hide_existing=True makes the duplicate
    lookup see nothing, to simulate two requests racing past the check."""
    def __init__(self, rows=None, hide_existing=False):
        self.rows = list(rows or [])
        self.hide_existing = hide_existing
        self._insert = self._filter = None

    def table(self, _name):
        self._insert = self._filter = None
        return self

    def select(self, *_):
        return self

    def eq(self, column, value):
        self._filter = (column, value)
        return self

    def limit(self, _n):
        return self

    def insert(self, row):
        self._insert = row
        return self

    def execute(self):
        if self._insert is not None:
            row = self._insert
            if row["external_id"] is not None and any(
                r.get("external_id") == row["external_id"] for r in self.rows
            ):
                raise APIError({"code": "23505", "message": "duplicate key value"})
            self.rows.append(row)
            return SimpleNamespace(data=[row])
        if self.hide_existing:
            return SimpleNamespace(data=[])
        column, value = self._filter
        return SimpleNamespace(data=[r for r in self.rows if r.get(column) == value])


class FakeResponse:
    def __init__(self, data=None, fail=False):
        self._data, self._fail = data, fail

    def raise_for_status(self):
        if self._fail:
            raise httpx.HTTPError("boom")

    def json(self):
        return self._data


def fake_setup(monkeypatch, urgency, discord_fails=False, db=None, llm_calls=None):
    """Replaces Supabase, OpenRouter and Discord so no real network call happens.
    Pass a list as llm_calls to record each OpenRouter call.
    Returns (fake supabase, list of payloads sent to Discord)."""
    db = db if db is not None else FakeSupabase()
    discord_calls = []
    llm_calls = llm_calls if llm_calls is not None else []
    ai_reply = json.dumps({"category": "billing", "urgency": urgency, "summary": "s"})

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

        async def post(self, url, **kwargs):
            if "openrouter" in url:
                llm_calls.append(kwargs["json"])
                return FakeResponse({"choices": [{"message": {"content": ai_reply}}]})
            discord_calls.append(kwargs["json"])
            return FakeResponse(fail=discord_fails)

    monkeypatch.setattr(main, "create_client", lambda *_: db)
    monkeypatch.setattr(main.httpx, "AsyncClient", FakeAsyncClient)
    for name, value in {
        "WEBHOOK_SECRET": "right",
        "OPENROUTER_API_KEY": "k",
        "OPENROUTER_MODEL": "m",
        "DISCORD_WEBHOOK_URL": "https://discord.test/hook",
        "SUPABASE_URL": "https://db.test",
        "SUPABASE_KEY": "k",
    }.items():
        monkeypatch.setenv(name, value)
    return db, discord_calls

def test_health():
    assert client.get("/health").status_code == 200

def test_wrong_secret(monkeypatch):
    monkeypatch.setenv("WEBHOOK_SECRET", "right")
    r = client.post("/webhook", json=GOOD, headers={"X-Webhook-Secret": "wrong"})
    assert r.status_code == 401

def test_malformed_payload(monkeypatch):
    monkeypatch.setenv("WEBHOOK_SECRET", "right")
    r = client.post("/webhook", json={"name": "A"}, headers={"X-Webhook-Secret": "right"})
    assert r.status_code == 422

def test_source_defaults_to_webhook(monkeypatch):
    db, _ = fake_setup(monkeypatch, "low")
    assert client.post("/webhook", json=GOOD, headers=HEADERS).status_code == 200
    assert db.rows[0]["source"] == "webhook"


def test_source_gmail_is_saved(monkeypatch):
    db, _ = fake_setup(monkeypatch, "low")
    r = client.post("/webhook", json={**GOOD, "source": "gmail"}, headers=HEADERS)
    assert r.status_code == 200
    assert db.rows[0]["source"] == "gmail"


def test_invalid_source_rejected(monkeypatch):
    fake_setup(monkeypatch, "low")
    r = client.post("/webhook", json={**GOOD, "source": "fax"}, headers=HEADERS)
    assert r.status_code == 422


def test_low_urgency_returns_200_without_alert(monkeypatch):
    # Regression: this used to crash because discord_response was never set.
    _, discord_calls = fake_setup(monkeypatch, "low")
    assert client.post("/webhook", json=GOOD, headers=HEADERS).status_code == 200
    assert discord_calls == []


def test_high_urgency_alert_blocks_mentions(monkeypatch):
    _, discord_calls = fake_setup(monkeypatch, "high")
    assert client.post("/webhook", json=GOOD, headers=HEADERS).status_code == 200
    assert discord_calls[0]["allowed_mentions"] == {"parse": []}


def test_discord_failure_still_returns_200(monkeypatch):
    db, _ = fake_setup(monkeypatch, "high", discord_fails=True)
    assert client.post("/webhook", json=GOOD, headers=HEADERS).status_code == 200
    assert len(db.rows) == 1


def test_without_external_id_saves_null(monkeypatch):
    db, _ = fake_setup(monkeypatch, "low")
    r = client.post("/webhook", json=GOOD, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["duplicate"] is False
    assert db.rows[0]["external_id"] is None


def test_external_id_is_saved(monkeypatch):
    db, _ = fake_setup(monkeypatch, "low")
    r = client.post("/webhook", json={**GOOD, "external_id": "g-1"}, headers=HEADERS)
    assert r.status_code == 200
    assert db.rows[0]["external_id"] == "g-1"


def test_duplicate_external_id_skips_llm(monkeypatch):
    llm_calls = []
    db, discord_calls = fake_setup(
        monkeypatch, "high", db=FakeSupabase(rows=[{"external_id": "g-1"}]), llm_calls=llm_calls
    )
    r = client.post("/webhook", json={**GOOD, "external_id": "g-1"}, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["duplicate"] is True
    assert llm_calls == []          # no classification spent on a resend
    assert discord_calls == []      # no second alert
    assert len(db.rows) == 1        # nothing new saved


def test_unique_violation_race_returns_duplicate(monkeypatch):
    # The lookup sees nothing (both requests passed the check), so the insert hits the
    # unique constraint. That must be a 200 duplicate, with no Discord alert.
    db = FakeSupabase(rows=[{"external_id": "g-1"}], hide_existing=True)
    db, discord_calls = fake_setup(monkeypatch, "high", db=db)
    r = client.post("/webhook", json={**GOOD, "external_id": "g-1"}, headers=HEADERS)
    assert r.status_code == 200
    assert r.json()["duplicate"] is True
    assert discord_calls == []
    assert len(db.rows) == 1


def test_empty_external_id_rejected(monkeypatch):
    fake_setup(monkeypatch, "low")
    r = client.post("/webhook", json={**GOOD, "external_id": ""}, headers=HEADERS)
    assert r.status_code == 422


def test_other_database_error_is_not_swallowed(monkeypatch):
    # Only a unique violation means "duplicate". Any other database error must still fail.
    class BrokenInsert(FakeSupabase):
        def execute(self):
            if self._insert is not None:
                raise APIError({"code": "42P01", "message": "relation does not exist"})
            return super().execute()

    fake_setup(monkeypatch, "low", db=BrokenInsert())
    with pytest.raises(APIError):
        client.post("/webhook", json={**GOOD, "external_id": "g-2"}, headers=HEADERS)
