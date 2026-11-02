"""Queen of the Krown API (FastAPI).

Run locally:  uvicorn app.main:app --reload   (from the backend folder)
Settings come from environment variables; see README.md.
"""
import hmac
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import delete, func, insert, select
from sqlalchemy.exc import IntegrityError

from .db import KINDS, make_engine, metadata, owners, sessions
from .security import RateLimiter, hash_password, new_token, token_hash, verify_password
from .sync import Conflict, load_state, save_state

MAX_BODY = 25 * 1024 * 1024  # photos and receipts travel inside the state, so allow a generous size


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=200)


class Register(Credentials):
    setup_code: str = Field(min_length=1, max_length=200)


class StateIn(BaseModel):
    version: int = Field(ge=0)
    state: dict[str, Any]

    @field_validator("state")
    @classmethod
    def lists_of_records(cls, s):
        for kind in KINDS:
            items = s.get(kind, [])
            if not isinstance(items, list) or not all(isinstance(i, dict) and isinstance(i.get("id"), str) and 0 < len(i["id"]) <= 64 for i in items):
                raise ValueError(f"'{kind}' must be a list of records that each have a text id")
            s[kind] = items
        return s


def create_app(database_url=None):
    engine = make_engine(database_url)
    owner_email = os.environ.get("OWNER_EMAIL", "kherissharp@gmail.com").lower()
    setup_code = os.environ.get("OWNER_SETUP_CODE", "")  # registration is closed unless this is set
    session_days = int(os.environ.get("SESSION_DAYS", "30"))
    origins = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "https://etozx.github.io,http://localhost:5173").split(",") if o.strip()]
    limiter = RateLimiter()

    @asynccontextmanager
    async def lifespan(_):
        # shortcut: creates missing tables on start; switch to Alembic migrations before changing existing columns.
        metadata.create_all(engine)
        yield

    app = FastAPI(title="Queen of the Krown API", version="1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST", "PUT"], allow_headers=["Authorization", "Content-Type"], max_age=600)

    @app.middleware("http")
    async def limit_body(request: Request, call_next):
        if int(request.headers.get("content-length") or 0) > MAX_BODY:
            return JSONResponse({"detail": "That's too much data in one save."}, status_code=413)
        return await call_next(request)

    def now():
        return datetime.now(timezone.utc)

    def start_session(conn, owner_id):
        token, digest = new_token()
        conn.execute(delete(sessions).where(sessions.c.expires_at < now()))  # tidy expired sessions
        conn.execute(insert(sessions).values(token_hash=digest, owner_id=owner_id, expires_at=now() + timedelta(days=session_days)))
        return {"token": token, "expires_in_days": session_days}

    def current_owner(authorization: str = Header(default="")):
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(401, "Please log in.")
        with engine.connect() as conn:
            row = conn.execute(select(sessions.c.owner_id, sessions.c.expires_at, owners.c.email)
                               .join(owners, owners.c.id == sessions.c.owner_id)
                               .where(sessions.c.token_hash == token_hash(token))).first()
        expires = row and (row.expires_at if row.expires_at.tzinfo else row.expires_at.replace(tzinfo=timezone.utc))
        if not row or expires < now():
            raise HTTPException(401, "Your login has expired. Please log in again.")
        return {"id": row.owner_id, "email": row.email, "token": token}

    @app.get("/api/health")
    def health():
        return {"ok": True}

    @app.get("/api/auth/status")
    def auth_status():
        with engine.connect() as conn:
            exists = conn.execute(select(func.count()).select_from(owners)).scalar() > 0
        return {"owner_exists": exists, "registration_open": bool(setup_code) and not exists}

    @app.post("/api/auth/register", status_code=201)
    def register(body: Register):
        # Only her email, only once, and only with the setup code the person deploying the API chose.
        if not setup_code or not hmac.compare_digest(body.setup_code.encode(), setup_code.encode()):
            raise HTTPException(403, "That setup code is wrong.")
        if body.email.lower() != owner_email:
            raise HTTPException(403, "Only the business owner's email can create the account.")
        try:
            with engine.begin() as conn:
                if conn.execute(select(func.count()).select_from(owners)).scalar():
                    raise HTTPException(409, "The owner account already exists. Log in instead.")
                owner_id = conn.execute(insert(owners).values(email=owner_email, password_hash=hash_password(body.password)).returning(owners.c.id)).scalar()
                return start_session(conn, owner_id)
        except IntegrityError:
            raise HTTPException(409, "The owner account already exists. Log in instead.")

    @app.post("/api/auth/login")
    def login(body: Credentials, request: Request):
        key = f"{request.client.host if request.client else '?'}|{body.email.lower()}"
        if limiter.blocked(key):
            raise HTTPException(429, "Too many tries. Please wait 15 minutes and try again.")
        with engine.begin() as conn:
            row = conn.execute(select(owners.c.id, owners.c.password_hash).where(owners.c.email == body.email.lower())).first()
            if not row or not verify_password(body.password, row.password_hash):
                limiter.fail(key)
                raise HTTPException(401, "That email or password is wrong.")
            limiter.reset(key)
            return start_session(conn, row.id)

    @app.post("/api/auth/logout", status_code=204)
    def logout(owner=Depends(current_owner)):
        with engine.begin() as conn:
            conn.execute(delete(sessions).where(sessions.c.token_hash == token_hash(owner["token"])))

    @app.get("/api/me")
    def me(owner=Depends(current_owner)):
        return {"email": owner["email"]}

    @app.get("/api/state")
    def get_state(owner=Depends(current_owner)):
        with engine.connect() as conn:
            version, state = load_state(conn, owner["id"])
        return {"version": version, "state": state}

    @app.put("/api/state")
    def put_state(body: StateIn, owner=Depends(current_owner)):
        try:
            with engine.begin() as conn:
                return {"version": save_state(conn, owner["id"], body.version, body.state)}
        except Conflict as c:
            raise HTTPException(409, {"message": "Another device saved first.", "version": c.version})
        except IntegrityError:  # two devices made the very first save at the same moment
            raise HTTPException(409, {"message": "Another device saved first.", "version": None})

    return app


app = create_app()
