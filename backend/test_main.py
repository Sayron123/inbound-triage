from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
GOOD = {"name": "A", "email": "a@b.com", "text": "hi"}

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