"""
Utility functions for 31 Card Game

This module contains helper functions for data conversion and formatting.
game_state_to_dict  — serialise a live GameState object → JSON-safe dict
game_state_from_dict — reconstruct a GameState from that dict (for Redis restore)
table_to_dict        — lightweight table summary used by REST and socket events
"""

from typing import Dict, Any, List, Optional
from game_logic import (
    GameState, Player, Card, GamePhase, AIDifficulty,
    create_deck, shuffle_deck, deal_initial_cards,
)


def game_state_to_dict(game_state: GameState) -> Dict[str, Any]:
    """Convert GameState to dictionary for JSON response"""
    players_dict = {}
    for player_id, player in game_state.players.items():
        player_data = {
            "id": player.id,
            "name": player.name,
            "hand": [card.to_dict() for card in player.hand],
            "lives": player.lives,
            "is_ai": player.is_ai,
            "has_knocked": player.has_knocked,
            "is_eliminated": player.is_eliminated,
            "score": player.calculate_best_score()[0]
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
        "turn_time_remaining": game_state.get_turn_time_remaining()
    }


def game_state_from_dict(data: Dict[str, Any]) -> GameState:
    """Reconstruct a GameState from a serialised dict (e.g. from Redis)."""
    from datetime import datetime

    gs = GameState(game_id=data["game_id"])
    gs.phase = GamePhase(data["phase"])
    gs.round_number = data.get("round_number", 1)
    gs.turn_count = data.get("turn_count", 0)
    gs.final_round_started = data.get("final_round_started", False)
    gs.knocked_player_id = data.get("knocked_player_id", "")
    gs.winner_id = data.get("winner_id", "")
    gs.recent_message = data.get("recent_message", "")
    gs.game_log = data.get("game_log", [])
    gs.host_player_id = data.get("host_player_id", "")
    gs.last_round_winner_id = data.get("last_round_winner_id", "")
    gs.current_player_id = data.get("current_player_id", "")

    if data.get("current_turn_start_time"):
        gs.current_turn_start_time = datetime.fromisoformat(data["current_turn_start_time"])

    # Reconstruct deck and discard pile
    gs.deck = [Card(**c) for c in data.get("deck", [])]
    gs.discard_pile = [Card(**c) for c in data.get("discard_pile", [])]

    # Reconstruct players
    for pid, pdata in data.get("players", {}).items():
        ai_diff = None
        if pdata.get("ai_difficulty"):
            try:
                ai_diff = AIDifficulty(pdata["ai_difficulty"])
            except ValueError:
                ai_diff = AIDifficulty.MEDIUM

        player = Player(
            id=pdata["id"],
            name=pdata["name"],
            lives=pdata.get("lives", 3),
            is_ai=pdata.get("is_ai", False),
            ai_difficulty=ai_diff,
            has_knocked=pdata.get("has_knocked", False),
            is_eliminated=pdata.get("is_eliminated", False),
        )
        player.hand = [Card(**c) for c in pdata.get("hand", [])]
        gs.players[pid] = player

    return gs


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
