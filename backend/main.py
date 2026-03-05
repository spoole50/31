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
  Production:  gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
  (Single worker because in-memory state is per-process. Add Redis to scale out.)
"""

import asyncio
import socketio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.socket import sio
from core.store import store
from api.game_router import router as game_router
from api.table_router import router as table_router
from table_logic import table_manager
import api.socket_handlers  # noqa: F401  — registers all @sio.on handlers


# ── Background cleanup task ───────────────────────────────────────────────────

CLEANUP_INTERVAL_SECONDS = 120  # run every 2 minutes
GAME_IDLE_TIMEOUT_SECONDS = 1800  # 30 minutes — remove games idle longer than this


async def _periodic_cleanup():
    """Remove stale tables and games that have been idle too long."""
    from datetime import datetime

    while True:
        await asyncio.sleep(CLEANUP_INTERVAL_SECONDS)
        try:
            removed = table_manager.cleanup_old_tables()
            if removed:
                print(f"[CLEANUP] Removed {removed} stale table(s)")

            # Remove games that have been idle for longer than the timeout.
            # This covers both local (non-table) games and orphaned table games.
            now = datetime.now()
            stale_game_ids = []
            for gid, game in store.all_games().items():
                idle = (now - game.last_activity).total_seconds()
                if idle > GAME_IDLE_TIMEOUT_SECONDS:
                    stale_game_ids.append(gid)
            for gid in stale_game_ids:
                store.remove_game(gid)
            if stale_game_ids:
                print(f"[CLEANUP] Removed {len(stale_game_ids)} idle game(s)")
        except Exception as e:
            print(f"[CLEANUP] Error during periodic cleanup: {e}")


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
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
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
