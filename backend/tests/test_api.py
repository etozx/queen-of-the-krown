"""API tests. Run from the backend folder:  python -m pytest -q"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

OWNER = "kherissharp@gmail.com"
PW = "correct horse battery"


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("OWNER_SETUP_CODE", "crown-123")
    monkeypatch.setenv("OWNER_EMAIL", OWNER)
    url = f"sqlite:///{tmp_path / 'test.db'}"
    from app.main import create_app
    with TestClient(create_app(url)) as client:
        yield client, create_engine(url)


def register(client, **over):
    body = {"email": OWNER, "password": PW, "setup_code": "crown-123", **over}
    return client.post("/api/auth/register", json=body)


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def sample_state():
    return {
        "v": 3, "settings": {"name": "Queen of the Krown"}, "categories": ["Hair & Bundles"], "methods": ["Cash"],
        "services": [{"id": "svc-a", "name": "Nubian Locs", "price": 66000}, {"id": "svc-b", "name": "Loc Touch Up", "price": 7500}],
        "clients": [{"id": "c1", "name": "Jasmine Carter"}],
        "appts": [{"id": "a1", "clientId": "c1", "date": "2026-11-03", "price": 60000, "status": "booked"}],
        "payments": [{"id": "p1", "apptId": "a1", "clientId": "c1", "date": "2026-11-01", "amount": 15000, "method": "Cash App", "deposit": True}],
        "expenses": [{"id": "e1", "date": "2026-11-01", "amount": 9000, "category": "Hair & Bundles"}],
        "stock": [],
    }


def test_register_rules(env):
    client, _ = env
    assert client.get("/api/auth/status").json() == {"owner_exists": False, "registration_open": True}
    assert register(client, setup_code="wrong").status_code == 403
    assert register(client, email="someone@else.com").status_code == 403
    assert register(client, password="short").status_code == 422
    assert register(client).status_code == 201
    assert register(client).status_code == 409  # only once
    assert client.get("/api/auth/status").json()["owner_exists"] is True


def test_login_logout_and_protected_routes(env):
    client, db = env
    register(client)
    assert client.get("/api/state").status_code == 401
    assert client.post("/api/auth/login", json={"email": OWNER, "password": "wrong password!"}).status_code == 401
    tok = client.post("/api/auth/login", json={"email": OWNER.upper(), "password": PW}).json()["token"]
    assert client.get("/api/me", headers=auth(tok)).json() == {"email": OWNER}
    with db.connect() as c:  # only a hash of the token is stored
        assert tok not in [r[0] for r in c.execute(text("select token_hash from sessions"))]
        assert c.execute(text("select password_hash from owners")).scalar().startswith("scrypt$")
    assert client.post("/api/auth/logout", headers=auth(tok)).status_code == 204
    assert client.get("/api/me", headers=auth(tok)).status_code == 401


def test_login_rate_limit(env):
    client, _ = env
    register(client)
    for _ in range(8):
        client.post("/api/auth/login", json={"email": OWNER, "password": "wrong password!"})
    assert client.post("/api/auth/login", json={"email": OWNER, "password": PW}).status_code == 429


def test_state_round_trip_rows_and_conflicts(env):
    client, db = env
    tok = register(client).json()["token"]
    assert client.get("/api/state", headers=auth(tok)).json() == {"version": 0, "state": None}

    s = sample_state()
    assert client.put("/api/state", json={"version": 0, "state": s}, headers=auth(tok)).json() == {"version": 1}
    got = client.get("/api/state", headers=auth(tok)).json()
    assert got["version"] == 1 and got["state"] == s  # same data, same order

    # Real rows with typed columns, so plain SQL can total her money.
    with db.connect() as c:
        assert c.execute(text("select sum(amount_cents) from payments where date >= '2026-11-01'")).scalar() == 15000
        assert c.execute(text("select count(*) from appointments where status = 'booked'")).scalar() == 1

    # A device holding an old version can't overwrite newer data.
    assert client.put("/api/state", json={"version": 0, "state": s}, headers=auth(tok)).status_code == 409

    # Edit a payment, delete the client, reorder services.
    s["payments"][0]["amount"] = 60000
    s["clients"] = []
    s["services"].reverse()
    assert client.put("/api/state", json={"version": 1, "state": s}, headers=auth(tok)).json() == {"version": 2}
    got = client.get("/api/state", headers=auth(tok)).json()["state"]
    assert got["clients"] == [] and [x["id"] for x in got["services"]] == ["svc-b", "svc-a"]
    with db.connect() as c:
        assert c.execute(text("select amount_cents from payments where id = 'p1'")).scalar() == 60000


def test_bad_state_is_rejected(env):
    client, _ = env
    tok = register(client).json()["token"]
    for bad in [{"payments": "nope"}, {"clients": [{"name": "no id"}]}, {"clients": [{"id": "x" * 65}]}]:
        assert client.put("/api/state", json={"version": 0, "state": bad}, headers=auth(tok)).status_code == 422


def test_cors_allows_the_site_only(env):
    client, _ = env
    ok = client.options("/api/state", headers={"Origin": "https://etozx.github.io", "Access-Control-Request-Method": "PUT"})
    assert ok.headers.get("access-control-allow-origin") == "https://etozx.github.io"
    bad = client.options("/api/state", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "PUT"})
    assert "access-control-allow-origin" not in bad.headers
