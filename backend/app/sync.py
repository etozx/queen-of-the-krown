"""Turns the app's state document into table rows and back.

The app is local-first: each device keeps a full copy and sends the whole state when it saves.
The server is the system of record. Writes use optimistic locking: a save names the version it
started from, and if another device saved first the server answers 409 so the app can reload.
Only rows that actually changed are written.
"""
from sqlalchemy import delete, insert, select, update

from .db import KINDS, columns_for, profiles, record_tables


class Conflict(Exception):
    def __init__(self, version):
        self.version = version


def load_state(conn, owner_id):
    prof = conn.execute(select(profiles.c.version, profiles.c.data).where(profiles.c.owner_id == owner_id)).first()
    if not prof:
        return 0, None
    state = dict(prof.data)
    for kind, t in record_tables.items():
        rows = conn.execute(select(t.c.data).where(t.c.owner_id == owner_id).order_by(t.c.pos)).scalars()
        state[kind] = list(rows)
    return prof.version, state


def save_state(conn, owner_id, base_version, state):
    """Writes the state if `base_version` is current. Returns the new version. Call inside a transaction."""
    # FOR UPDATE: two saves for the same owner run one after the other, never interleaved.
    prof = conn.execute(select(profiles.c.version).where(profiles.c.owner_id == owner_id).with_for_update()).first()
    current = prof.version if prof else 0
    if base_version != current:
        raise Conflict(current)

    for kind, t in record_tables.items():
        incoming = {}
        for pos, item in enumerate(state[kind]):
            incoming[item["id"]] = (pos, item)  # a repeated id keeps its last copy
        existing = {r.id: (r.pos, r.data) for r in conn.execute(select(t.c.id, t.c.pos, t.c.data).where(t.c.owner_id == owner_id))}
        gone = existing.keys() - incoming.keys()
        if gone:
            conn.execute(delete(t).where(t.c.owner_id == owner_id, t.c.id.in_(gone)))
        for rid, (pos, item) in incoming.items():
            if existing.get(rid) == (pos, item):
                continue
            row = {"pos": pos, "data": item, **columns_for(kind, item)}
            if rid in existing:
                conn.execute(update(t).where(t.c.owner_id == owner_id, t.c.id == rid).values(**row))
            else:
                conn.execute(insert(t).values(owner_id=owner_id, id=rid, **row))

    rest = {k: v for k, v in state.items() if k not in KINDS}
    new_version = current + 1
    if prof:
        conn.execute(update(profiles).where(profiles.c.owner_id == owner_id).values(version=new_version, data=rest))
    else:
        conn.execute(insert(profiles).values(owner_id=owner_id, version=new_version, data=rest))
    return new_version
