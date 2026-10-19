import json

import httpx
import main
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
GOOD = {"name": "A", "email": "a@b.com", "text": "hi"}
HEADERS = {"X-Webhook-Secret": "right"}


class FakeSupabase:
    """Stands in for the Supabase client and records inserted rows."""
    def __init__(self):
        self.rows = []

    def table(self, _name):
        return self

    def insert(self, row):
        self.rows.append(row)
        return self

    def execute(self):
        return None


class FakeResponse:
    def __init__(self, data=None, fail=False):
        self._data, self._fail = data, fail

    def raise_for_status(self):
        if self._fail:
            raise httpx.HTTPError("boom")

    def json(self):
        return self._data


def fake_setup(monkeypatch, urgency, discord_fails=False):
    """Replaces Supabase, OpenRouter and Discord so no real network call happens.
    Returns (fake supabase, list of payloads sent to Discord)."""
    db, discord_calls = FakeSupabase(), []
    ai_reply = json.dumps({"category": "billing", "urgency": urgency, "summary": "s"})

    class FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return False

        async def post(self, url, **kwargs):
            if "openrouter" in url:
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
