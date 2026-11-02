"""Passwords, session tokens and a small login rate limiter."""
import hashlib
import hmac
import os
import secrets
import time
from collections import defaultdict, deque

# scrypt (Python standard library): memory-hard, so stolen hashes are slow to crack on GPUs.
N, R, P = 2**15, 8, 1


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.scrypt(password.encode(), salt=salt, n=N, r=R, p=P, maxmem=2**26, dklen=32)
    return f"scrypt${N}${R}${P}${salt.hex()}${key.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, n, r, p, salt, key = stored.split("$")
        got = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p), maxmem=2**26, dklen=32)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(got.hex(), key)


def new_token() -> tuple[str, str]:
    """Returns (token for the browser, hash for the database)."""
    token = secrets.token_urlsafe(32)
    return token, token_hash(token)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class RateLimiter:
    """Allows `limit` failed tries per key in a sliding window.

    shortcut: kept in this process's memory, so it resets on restart and isn't shared between
    servers; move it to Redis or the database if the API ever runs on more than one instance.
    """

    def __init__(self, limit=8, window=15 * 60):
        self.limit, self.window, self.hits = limit, window, defaultdict(deque)

    def _fresh(self, key):
        q, now = self.hits[key], time.monotonic()
        while q and now - q[0] > self.window:
            q.popleft()
        return q

    def blocked(self, key) -> bool:
        return len(self._fresh(key)) >= self.limit

    def fail(self, key):
        self._fresh(key).append(time.monotonic())

    def reset(self, key):
        self.hits.pop(key, None)
