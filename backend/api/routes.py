"""
Game routes for 31 Card Game API

This module contains all game-related HTTP endpoints.
"""

from flask import Blueprint, request, jsonify
from typing import Dict

from game_logic import (
    create_deck, shuffle_deck, deal_cards, create_new_game, 
    draw_card, discard_card, knock, GameState, AIDifficulty
)
from utils.serializers import game_state_to_dict
from ai.engine import advanced_ai_turn

# In-memory game storage (for development - use database for production)
games: Dict[str, GameState] = {}

# Create blueprint for game routes
game_routes = Blueprint('game_routes', __name__, url_prefix='/api')

@game_routes.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify API is running"""
    return jsonify({
        'status': 'healthy',
        'message': '31 Card Game API is running',
        'cors_test': True
    })

@game_routes.route("/")
def read_root():
    return jsonify({"message": "Welcome to the 31 Card Game Backend!", "version": "1.0.0"})


@game_routes.route("/api/game-data")
def get_game_data():
    """Legacy endpoint for backward compatibility"""
    deck = create_deck()
    deck = shuffle_deck(deck)
    hands, remaining_deck = deal_cards(deck, 4)  # Example: 4 players
    return jsonify({"hands": hands, "remainingDeck": remaining_deck})


@game_routes.route("/api/games", methods=["POST"])
def create_game():
    """Create a new game"""
    try:
        data = request.get_json()
        player_names = data.get("player_names", [])
        num_ai_players = data.get("num_ai_players", 0)
        ai_difficulties_str = data.get("ai_difficulties", [])
        
        if not player_names:
            return jsonify({"detail": "At least one player name required"}), 400
        
        # Convert string difficulties to enum
        ai_difficulties = []
        for diff_str in ai_difficulties_str:
            try:
                ai_difficulties.append(AIDifficulty(diff_str.lower()))
            except ValueError:
                ai_difficulties.append(AIDifficulty.MEDIUM)  # Default fallback
        
        game_state = create_new_game(player_names, num_ai_players, ai_difficulties)
        games[game_state.game_id] = game_state
        return jsonify(game_state_to_dict(game_state))
    except Exception as e:
        return jsonify({"detail": str(e)}), 400


@game_routes.route("/api/games/<game_id>")
def get_game(game_id: str):
    """Get current game state"""
    if game_id not in games:
        return jsonify({"detail": "Game not found"}), 404
    return jsonify(game_state_to_dict(games[game_id]))


@game_routes.route("/api/games/<game_id>/draw", methods=["POST"])
def draw_card_endpoint(game_id: str):
    """Player draws a card"""
    if game_id not in games:
        return jsonify({"detail": "Game not found"}), 404
    
    data = request.get_json()
    player_id = data.get("player_id")
    from_discard = data.get("from_discard", False)
    
    if not player_id:
        return jsonify({"detail": "player_id required"}), 400
    
    game_state = games[game_id]
    success = draw_card(game_state, player_id, from_discard)
    
    if not success:
        return jsonify({"detail": "Invalid draw action"}), 400
    
    return jsonify(game_state_to_dict(game_state))


@game_routes.route("/api/games/<game_id>/discard", methods=["POST"])
def discard_card_endpoint(game_id: str):
    """Player discards a card"""
    if game_id not in games:
        return jsonify({"detail": "Game not found"}), 404
    
    data = request.get_json()
    player_id = data.get("player_id")
    card_index = data.get("card_index")
    
    if not player_id or card_index is None:
        return jsonify({"detail": "player_id and card_index required"}), 400
    
    game_state = games[game_id]
    success = discard_card(game_state, player_id, card_index)
    
    if not success:
        return jsonify({"detail": "Invalid discard action"}), 400
    
    return jsonify(game_state_to_dict(game_state))


@game_routes.route("/api/games/<game_id>/knock", methods=["POST"])
def knock_endpoint(game_id: str):
    """Player knocks"""
    if game_id not in games:
        return jsonify({"detail": "Game not found"}), 404
    
    data = request.get_json()
    player_id = data.get("player_id")
    
    if not player_id:
        return jsonify({"detail": "player_id required"}), 400
    
    game_state = games[game_id]
    success = knock(game_state, player_id)
    
    if not success:
        return jsonify({"detail": "Invalid knock action"}), 400
    
    return jsonify(game_state_to_dict(game_state))


@game_routes.route("/api/games")
def list_games():
    """List all active games"""
    return jsonify({
        "games": [
            {
                "game_id": game_id,
                "players": len(game_state.players),
                "phase": game_state.phase.value,
                "round": game_state.round_number
            }
            for game_id, game_state in games.items()
        ]
    })


@game_routes.route("/api/games/<game_id>", methods=["DELETE"])
def delete_game(game_id: str):
    """Delete a game"""
    if game_id not in games:
        return jsonify({"detail": "Game not found"}), 404
    
    del games[game_id]
    return jsonify({"message": "Game deleted successfully"})


@game_routes.route("/api/games/<game_id>/ai-turn", methods=["POST"])
def ai_turn_endpoint(game_id: str):
    """Process AI turn"""
    if game_id not in games:
        return jsonify({"detail": "Game not found"}), 404
    
    game_state = games[game_id]
    current_player = game_state.players.get(game_state.current_player_id)
    
    if not current_player or not current_player.is_ai:
        return jsonify({"detail": "Current player is not AI"}), 400
    
    # Process AI turn
    success = advanced_ai_turn(game_state, game_state.current_player_id)
    
    if not success:
        return jsonify({"detail": "AI turn failed"}), 400
    
    return jsonify(game_state_to_dict(game_state))


@game_routes.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify API is running"""
    return jsonify({
        'status': 'healthy',
        'message': '31 Card Game API is running',
        'cors_test': True
    })
