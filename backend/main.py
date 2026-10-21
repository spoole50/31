"""
31 Card Game — v2 Backend

Stack:  FastAPI  +  python-socketio  +  uvicorn (ASGI)

Architecture:
  - FastAPI handles all REST endpoints (game CRUD, table management, health)
  - python-socketio handles all real-time multiplayer (join/leave rooms, game
    actions, disconnect detection)
  - Both are mounted into a single ASGI app so they share one port and one
    process
  - Core state lives in core.store (in-memory, optionally backed by Redis)

Entry points:
  Local:       uvicorn main:app --reload --port 8000
  Production:  uvicorn main:app --host 0.0.0.0 --port 8000 --proxy-headers
  (Single process because in-memory state is per-process. App Runner must be
   pinned to max 1 instance for the same reason.)
"""

import asyncio
import logging
import os
import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import ALLOWED_ORIGINS
from core.limits import create_limiter
from core.socket import sio
from core.store import store
from api.game_router import router as game_router
from api.table_router import router as table_router
from table_logic import table_manager
import api.socket_handlers  # noqa: F401  — registers all @sio.on handlers

# LOG_LEVEL=DEBUG surfaces per-turn game events (timeouts, life loss, round
# results). App Runner ships stdout to CloudWatch Logs as-is.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Background cleanup task ───────────────────────────────────────────────────

CLEANUP_INTERVAL_SECONDS = 120  # run every 2 minutes
GAME_IDLE_TIMEOUT_SECONDS = 1800  # 30 minutes — remove games idle longer than this
TABLE_IDLE_TIMEOUT_SECONDS = 3600  # 1 hour — remove tables with no player activity


async def _periodic_cleanup():
    """Remove stale tables and games that have been idle too long."""
    from datetime import datetime

    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            now = datetime.now()

            create_limiter.prune()

            # ── Local (non-table) games ───────────────────────────────────────
            # store only ever holds local games; table games live on the table.
            stale_game_ids = [
                gid
                for gid, game in store.all_games().items()
                if (now - game.last_activity).total_seconds() > GAME_IDLE_TIMEOUT_SECONDS
            ]
            for gid in stale_game_ids:
                store.remove_game(gid)
            if stale_game_ids:
                logger.info(f"[CLEANUP] Removed {len(stale_game_ids)} idle local game(s)")

            # ── Finished tables older than 24h ────────────────────────────────
            removed = table_manager.cleanup_old_tables()
            if removed:
                logger.info(f"[CLEANUP] Removed {removed} old finished table(s)")

            # ── Abandoned tables in any status ────────────────────────────────
            # cleanup_old_tables only reaps FINISHED tables, so a table left in
            # WAITING or PLAYING (everyone closed their tab, host never had
            # anyone join) would otherwise live until the process restarts —
            # holding a whole GameState on a 0.5 GB instance.
            idle_table_ids = [
                tid
                for tid, table in table_manager.tables.items()
                if _table_idle_seconds(table, now) > TABLE_IDLE_TIMEOUT_SECONDS
            ]
            for tid in idle_table_ids:
                table_manager.remove_table(tid)
            if idle_table_ids:
                logger.info(f"[CLEANUP] Removed {len(idle_table_ids)} abandoned table(s)")
        except Exception as e:
            logger.exception(f"[CLEANUP] Error during periodic cleanup: {e}")


def _table_idle_seconds(table, now) -> float:
    """Seconds since anything happened at this table.

    Uses the most recent player activity, falling back to table creation time
    for a table nobody has ever interacted with.
    """
    timestamps = [p.last_activity for p in table.players.values() if p.last_activity]
    if table.game_state:
        timestamps.append(table.game_state.last_activity)
    latest = max(timestamps) if timestamps else table.created_at
    return (now - latest).total_seconds()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start the periodic cleanup task when the app starts."""
    task = asyncio.create_task(_periodic_cleanup())
    yield
    task.cancel()


# ── FastAPI app ───────────────────────────────────────────────────────────────

fastapi_app = FastAPI(
    title="31 Card Game API",
    version="2.0.0",
    description="REST + WebSocket backend for the 31 card game",
    lifespan=lifespan,
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Player-Token"],
)

fastapi_app.include_router(game_router, prefix="/api")
fastapi_app.include_router(table_router, prefix="/api")


@fastapi_app.get("/api/health")
def health():
    from core.store import store
    return {"status": "healthy", "version": "2.0.0", **store.stats()}


# ── Combined ASGI app  ────────────────────────────────────────────────────────
# Socket.IO wraps FastAPI so that:
#   - /socket.io/* is handled by python-socketio
#   - everything else is forwarded to FastAPI

app = socketio.ASGIApp(sio, fastapi_app)
