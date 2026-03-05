"""
REST endpoints for single-player / local-game flows.

These mirror the old Flask routes.py but are FastAPI routers.
Local games don't use WebSockets — the frontend polls (or calls on demand).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from game_logic import create_new_game, draw_card, discard_card, knock, AIDifficulty, GamePhase
from ai.engine import advanced_ai_turn
from core.store import store
from utils.serializers import game_state_to_dict

router = APIRouter()


# ── Request models ────────────────────────────────────────────────────────────

class CreateGameRequest(BaseModel):
    player_names: List[str]
    num_ai_players: int = 0
    ai_difficulties: List[str] = []


class DrawRequest(BaseModel):
    player_id: str
    from_discard: bool = False


class DiscardRequest(BaseModel):
    player_id: str
    card_index: int


class KnockRequest(BaseModel):
    player_id: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/games")
def create_game(req: CreateGameRequest):
    """Create a new local game."""
    if not req.player_names:
        raise HTTPException(status_code=400, detail="At least one player name is required")

    difficulties = []
    for d in req.ai_difficulties:
        try:
            difficulties.append(AIDifficulty(d.lower()))
        except ValueError:
            difficulties.append(AIDifficulty.MEDIUM)

    game_state = create_new_game(req.player_names, req.num_ai_players, difficulties)
    store.add_game(game_state)
    return game_state_to_dict(game_state)


@router.get("/games/{game_id}")
def get_game(game_id: str):
    game = store.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    return game_state_to_dict(game)


@router.post("/games/{game_id}/draw")
def draw(game_id: str, req: DrawRequest):
    game = store.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    game.touch()
    success = draw_card(game, req.player_id, req.from_discard)
    if not success:
        raise HTTPException(status_code=400, detail=_action_reject_reason(game, req.player_id, "draw"))
    return game_state_to_dict(game)


@router.post("/games/{game_id}/discard")
def discard(game_id: str, req: DiscardRequest):
    game = store.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    game.touch()
    success = discard_card(game, req.player_id, req.card_index)
    if not success:
        raise HTTPException(status_code=400, detail=_action_reject_reason(game, req.player_id, "discard"))
    return game_state_to_dict(game)


@router.post("/games/{game_id}/knock")
def do_knock(game_id: str, req: KnockRequest):
    game = store.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    game.touch()
    success = knock(game, req.player_id)
    if not success:
        raise HTTPException(status_code=400, detail=_action_reject_reason(game, req.player_id, "knock"))
    return game_state_to_dict(game)


@router.post("/games/{game_id}/timeout")
def force_timeout(game_id: str):
    """Force-skip the current player's turn (used by the frontend timer for local games)."""
    game = store.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # Pass timeout_seconds=0 so check_turn_timeout always returns True
    handled = game.handle_turn_timeout(timeout_seconds=0)
    if not handled:
        raise HTTPException(status_code=400, detail="Could not timeout turn")
    return game_state_to_dict(game)


@router.post("/games/{game_id}/ai-turn")
def ai_turn(game_id: str):
    game = store.get_game(game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    game.touch()
    current = game.players.get(game.current_player_id)
    if not current or not current.is_ai:
        raise HTTPException(status_code=400, detail="Current player is not an AI")

    advanced_ai_turn(game, game.current_player_id)
    return game_state_to_dict(game)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _action_reject_reason(game, player_id: str, action: str) -> str:
    """Build a diagnostic message explaining why an action was rejected."""
    parts = [f"{action} rejected"]
    if game.phase not in (GamePhase.PLAYING, GamePhase.FINAL_ROUND):
        parts.append(f"phase={game.phase.value}")
    if player_id != game.current_player_id:
        parts.append(f"not_your_turn(current={game.current_player_id})")
    player = game.players.get(player_id)
    if not player:
        parts.append("player_not_found")
    elif player.is_eliminated:
        parts.append("player_eliminated")
    else:
        parts.append(f"hand_size={len(player.hand)}")
    return "; ".join(parts)
