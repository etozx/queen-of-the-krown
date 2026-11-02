# Queen of the Krown API

FastAPI + PostgreSQL backend for the money tracker. The website (GitHub Pages) works without it;
with it, the owner logs in and her records are backed up and synced across devices.

## How it works

- **Local-first.** Each device keeps a full copy (IndexedDB) and works offline. When she saves, the
  site sends the state to `PUT /api/state`; the server is the system of record.
- **Real tables.** Every client, appointment, payment, expense, service and stock item is its own row
  (`app/db.py`). Columns used for totals and filters (`date`, `amount_cents`, `client_id`, ...) are typed;
  the full record is in a JSONB `data` column, so new app fields need no migration.
- **No lost updates.** Saves carry the version they started from. If another device saved first the API
  answers `409` and the site reloads the newer copy (optimistic locking, row lock on the owner's profile).
- **Small writes.** Only rows that changed are written.

## Security

- One owner account: only `OWNER_EMAIL`, only once, and only with `OWNER_SETUP_CODE` (registration is
  closed when the code isn't set).
- Passwords: scrypt (Python standard library), random salt per password.
- Sessions: random 256-bit tokens sent as `Authorization: Bearer`; only their SHA-256 is stored, they
  expire after `SESSION_DAYS` (30), and logout deletes them.
- Login rate limit: 8 failed tries per IP + email per 15 minutes.
- CORS allows only `ALLOWED_ORIGINS`. Request bodies over 25 MB are refused.

## Settings (environment variables)

| Name | Example | Notes |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/postgres` | Any PostgreSQL. Defaults to a local SQLite file for development. |
| `OWNER_SETUP_CODE` | a long random phrase | Needed once to create the owner account. |
| `OWNER_EMAIL` | `kherissharp@gmail.com` | |
| `ALLOWED_ORIGINS` | `https://etozx.github.io` | Comma-separated. |
| `SESSION_DAYS` | `30` | |

## Run locally

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # macOS/Linux: .venv/bin/python
.venv/Scripts/python -m pytest -q
OWNER_SETUP_CODE=dev-code .venv/Scripts/python -m uvicorn app.main:app --reload
```

## Endpoints

| Method | Path | |
|---|---|---|
| GET | `/api/health` | |
| GET | `/api/auth/status` | `{owner_exists, registration_open}` |
| POST | `/api/auth/register` | `{email, password, setup_code}` → `{token}` |
| POST | `/api/auth/login` | `{email, password}` → `{token}` |
| POST | `/api/auth/logout` | |
| GET | `/api/me` | |
| GET | `/api/state` | `{version, state}` |
| PUT | `/api/state` | `{version, state}` → `{version}` or `409` |

## Forgot password

There's no email service, so reset it on the server: `python -m app.cli reset-password`
(this also logs out every device).

## Next steps when it grows

- Alembic migrations before changing existing columns (tables are created on start for now).
- Per-record changes instead of whole-state saves if the data gets large.
- Move photos and receipts out of the records into file storage.
