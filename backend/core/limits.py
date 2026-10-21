"""
Abuse limits.

The backend is a single process on a 0.5 GB instance with all state in memory,
so an unauthenticated loop creating games or tables could exhaust it and take
the site down for everyone. Two layers guard against that:

  * a per-IP sliding-window limit on the endpoints that allocate state
  * hard caps on how many local games and tables may be live at once

All limits are env-overridable so they can be tuned on App Runner without a
code change.
"""

import os
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


MAX_LIVE_GAMES = _env_int("MAX_LIVE_GAMES", 200)    # local (non-table) games
MAX_LIVE_TABLES = _env_int("MAX_LIVE_TABLES", 100)

CREATE_LIMIT = _env_int("CREATE_RATE_LIMIT", 10)    # creates per window per IP
CREATE_WINDOW_SECONDS = 60


class RateLimiter:
    """Sliding-window counter keyed by client IP. Single-process only."""

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)

    def hit(self, key: str) -> bool:
        """Record a request for `key`. Returns False if it is over the limit."""
        now = time.monotonic()
        hits = self._hits[key]
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            return False
        hits.append(now)
        return True

    def prune(self) -> None:
        """Drop keys with no hits inside the window (called by the cleanup task)."""
        cutoff = time.monotonic() - self.window
        for key in [k for k, h in self._hits.items() if not h or h[-1] <= cutoff]:
            del self._hits[key]

    def reset(self) -> None:
        self._hits.clear()


create_limiter = RateLimiter(CREATE_LIMIT, CREATE_WINDOW_SECONDS)


def limit_creates(request: Request) -> None:
    """FastAPI dependency for endpoints that allocate a game or table."""
    # request.client is the real client IP because uvicorn runs with
    # --proxy-headers behind App Runner (see Dockerfile).
    ip = request.client.host if request.client else "unknown"
    if not create_limiter.hit(ip):
        raise HTTPException(
            status_code=429,
            detail="Too many new games — wait a minute and try again",
            headers={"Retry-After": str(CREATE_WINDOW_SECONDS)},
        )


def ensure_capacity(current: int, cap: int) -> None:
    """Reject new state when the server is already holding `cap` of it."""
    if current >= cap:
        raise HTTPException(
            status_code=503,
            detail="Server is at capacity — try again in a few minutes",
        )
