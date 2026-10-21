"""
Utility functions for 31 Card Game

This module contains helper functions for data conversion and formatting.
game_state_to_dict  — serialise a live GameState object → JSON-safe dict
table_to_dict        — lightweight table summary used by REST and socket events
"""

from typing import Dict, Any, Optional
from game_logic import GameState, GamePhase


def game_state_to_dict(
    game_state: GameState,
    requesting_player_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Convert GameState to dictionary for JSON response.

    Parameters
    ----------
    requesting_player_id : str | None
        The *game-level* player ID of the person receiving this payload.
        When set, other players' hands are hidden (replaced with card-back
        placeholders) so that a client cannot cheat by inspecting the data.
        When ``None`` (local / single-player games, or finished games) every
        hand is revealed.
    """
    game_is_over = game_state.phase == GamePhase.FINISHED
    players_dict = {}
    for player_id, player in game_state.players.items():
        # Reveal hand only to the requesting player, or when the game is over
        reveal_hand = (
            requesting_player_id is None
            or player_id == requesting_player_id
            or game_is_over
        )

        player_data = {
            "id": player.id,
            "name": player.name,
            "hand": (
                [card.to_dict() for card in player.hand]
                if reveal_hand
                else [{"value": "?", "suit": "?"} for _ in player.hand]
            ),
            "hand_size": len(player.hand),
            "lives": player.lives,
            "is_ai": player.is_ai,
            "has_knocked": player.has_knocked,
            "is_eliminated": player.is_eliminated,
            "score": player.calculate_best_score()[0] if reveal_hand else None,
        }
        
        # Add AI difficulty if it's an AI player
        if player.is_ai and player.ai_difficulty:
            player_data["ai_difficulty"] = player.ai_difficulty.value
        
        players_dict[player_id] = player_data
    
    return {
        "game_id": game_state.game_id,
        "players": players_dict,
        "current_player_id": game_state.current_player_id,
        "phase": game_state.phase.value,
        "discard_pile": [card.to_dict() for card in game_state.discard_pile],
        "deck_size": len(game_state.deck),
        "round_number": game_state.round_number,
        "winner_id": game_state.winner_id if game_state.winner_id else None,
        "recent_message": game_state.recent_message,
        "game_log": game_state.game_log,
        "turn_time_remaining": game_state.get_turn_time_remaining(),
    }


def table_to_dict(table) -> Dict[str, Any]:
    """Lightweight serialisation of a GameTable for REST/WebSocket payloads."""
    players_list = []
    for p in table.players.values():
        players_list.append({
            "id": p.id,
            "name": p.name,
            "status": p.status.value,
            "is_host": p.is_host,
            "is_ai": p.is_ai,
            "ai_difficulty": p.ai_difficulty.value if p.ai_difficulty else None,
        })

    return {
        "table_id": table.table_id,
        "table_name": table.table_name,
        "host_id": table.host_id,
        "invite_code": table.invite_code,
        "status": table.status.value,
        "max_players": table.max_players,
        "is_private": table.is_private,
        "players": players_list,
        "player_count": len(table.players),
        "has_game": table.game_state is not None,
    }
