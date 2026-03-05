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

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.socket import sio
from api.game_router import router as game_router
from api.table_router import router as table_router
import api.socket_handlers  # noqa: F401  — registers all @sio.on handlers


# ── FastAPI app ───────────────────────────────────────────────────────────────

fastapi_app = FastAPI(
    title="31 Card Game API",
    version="2.0.0",
    description="REST + WebSocket backend for the 31 card game",
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
