"""
REST endpoints for table / lobby management.

Replaces the old Flask table_routes.py with a FastAPI router.
The WebSocket layer (socket_handlers.py) handles real-time events;
these endpoints handle lobby creation, joining, and control actions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from table_logic import table_manager, TableStatus, AIDifficulty
from core.socket import sio
from utils.serializers import table_to_dict

router = APIRouter()


# ── Request models ────────────────────────────────────────────────────────────

class CreateTableRequest(BaseModel):
    host_id: str
    host_name: str
    table_name: str = "New Game"
    max_players: int = 8
    is_private: bool = True
    password: Optional[str] = None


class JoinTableRequest(BaseModel):
    player_id: str
    player_name: str
    invite_code: Optional[str] = None
    table_id: Optional[str] = None
    password: Optional[str] = None


class StartGameRequest(BaseModel):
    host_id: str


class AddAIRequest(BaseModel):
    host_id: str
    difficulty: str = "medium"


class LeaveTableRequest(BaseModel):
    player_id: str


class RestartGameRequest(BaseModel):
    host_id: str


# ── Table lifecycle ───────────────────────────────────────────────────────────

@router.post("/tables", status_code=201)
def create_table(req: CreateTableRequest):
    if not req.host_id or not req.host_name:
        raise HTTPException(status_code=400, detail="host_id and host_name are required")

    if not (2 <= req.max_players <= 8):
        raise HTTPException(status_code=400, detail="max_players must be between 2 and 8")

    existing = table_manager.get_player_table(req.host_id)
    if existing:
        raise HTTPException(status_code=400, detail="Player is already in a table")

    table = table_manager.create_table(
        host_id=req.host_id,
        host_name=req.host_name,
        table_name=req.table_name,
        max_players=req.max_players,
        is_private=req.is_private,
        password=req.password,
    )
    return table_to_dict(table)


@router.post("/tables/join")
def join_table(req: JoinTableRequest):
    if not req.player_id or not req.player_name:
        raise HTTPException(status_code=400, detail="player_id and player_name are required")

    if not req.invite_code and not req.table_id:
        raise HTTPException(status_code=400, detail="Either invite_code or table_id is required")

    if req.invite_code:
        table = table_manager.join_table_by_code(
            req.player_id, req.player_name, req.invite_code, req.password
        )
    else:
        table = table_manager.join_table_by_id(req.player_id, req.player_name, req.table_id)

    if not table:
        raise HTTPException(
            status_code=400,
            detail="Could not join table — not found, full, game in progress, or wrong password",
        )

    return table_to_dict(table)


@router.post("/tables/{table_id}/leave")
def leave_table(table_id: str, req: LeaveTableRequest):
    success = table_manager.leave_table(req.player_id)
    if not success:
        raise HTTPException(status_code=400, detail="Player not in table")
    return {"message": "Left table successfully"}


@router.get("/tables")
@router.get("/tables/public")
def list_tables():
    return {"tables": [table_to_dict(t) for t in table_manager.list_public_tables()]}


@router.get("/tables/{table_id}")
def get_table(table_id: str):
    table = table_manager.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table_to_dict(table)


# ── Game control (host only) ──────────────────────────────────────────────────

@router.post("/tables/{table_id}/start")
async def start_game(table_id: str, req: StartGameRequest):
    table = table_manager.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if not table.is_host(req.host_id):
        raise HTTPException(status_code=403, detail="Only the host can start the game")

    # Granular validation so the frontend gets actionable error messages.
    if table.status.value not in ("waiting", "ready"):
        raise HTTPException(status_code=400, detail="Game has already started")
    joined = [p for p in table.players.values() if p.status.value in ("joined", "ready")]
    if len(joined) < table.min_players:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least {table.min_players} players to start (currently {len(joined)}). Add an AI player or wait for more players to join.",
        )

    success = table_manager.start_table_game(table_id, req.host_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot start game — host ID mismatch or table not found",
        )

    updated = table_manager.get_table(table_id)

    # Notify all players in the room with per-player game state
    if updated and updated.game_state:
        from api.socket_handlers import _emit_game_to_table
        await _emit_game_to_table(updated)
    await sio.emit("table_updated", table_to_dict(updated), room=table_id)

    return table_to_dict(updated)


@router.post("/tables/{table_id}/restart")
def restart_game(table_id: str, req: RestartGameRequest):
    table = table_manager.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if not table.is_host(req.host_id):
        raise HTTPException(status_code=403, detail="Only the host can restart the game")

    if table.status != TableStatus.FINISHED:
        raise HTTPException(status_code=400, detail="Can only restart finished games")

    success = table_manager.restart_table_game(table_id, req.host_id)
    if not success:
        raise HTTPException(status_code=400, detail="Could not restart game")
    return table_to_dict(table_manager.get_table(table_id))


@router.post("/tables/{table_id}/add-ai")
def add_ai(table_id: str, req: AddAIRequest):
    table = table_manager.get_table(table_id)
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    if not table.is_host(req.host_id):
        raise HTTPException(status_code=403, detail="Only the host can add AI players")

    try:
        difficulty = AIDifficulty(req.difficulty.lower())
    except ValueError:
        difficulty = AIDifficulty.MEDIUM

    if not table.add_ai_player(difficulty):
        raise HTTPException(status_code=400, detail="Could not add AI — table may be full")
    return table_to_dict(table)


# ── Game state ────────────────────────────────────────────────────────────────
#
# There are deliberately NO REST endpoints for reading game state or submitting
# game actions.  Both used to exist here and both were unauthenticated:
#
#   GET  /tables/{id}/game?player_id=X   revealed X's hand to any caller, and
#        opponent IDs are published to the whole table in table_to_dict.
#   POST /tables/{id}/game/{action}      accepted actions as any player_id with
#        no socket-session check, unlike the Socket.IO path.
#
# Everything now goes through socket_handlers.py, which verifies that the
# socket session actually belongs to the claimed player before touching state,
# and emits per-player payloads with opponents' hands hidden.  Game state
# reaches a client on join (`join_table` → `game_updated`) and after every
# action — there is no need to fetch it over REST.


# ── Player lookup ─────────────────────────────────────────────────────────────

@router.get("/player/{player_id}/table")
def get_player_table(player_id: str):
    table = table_manager.get_player_table(player_id)
    if not table:
        raise HTTPException(status_code=404, detail="Player not in any table")
    return table_to_dict(table)
