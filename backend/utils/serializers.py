"""
Utility functions for 31 Card Game

This module contains helper functions for data conversion and formatting.
"""

from typing import Dict, Any
from game_logic import GameState


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
