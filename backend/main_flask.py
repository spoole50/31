from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import Dict, List, Optional, Any
import json

from game_logic import (
    create_deck, shuffle_deck, deal_cards, create_new_game, 
    draw_card, discard_card, knock, GameState, Player, Card
)

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# In-memory game storage (for development - use database for production)
games: Dict[str, GameState] = {}

def game_state_to_dict(game_state: GameState) -> Dict[str, Any]:
    """Convert GameState to dictionary for JSON response"""
    players_dict = {}
    for player_id, player in game_state.players.items():
        players_dict[player_id] = {
            "id": player.id,
            "name": player.name,
            "hand": [card.to_dict() for card in player.hand],
            "lives": player.lives,
            "is_ai": player.is_ai,
            "has_knocked": player.has_knocked,
            "is_eliminated": player.is_eliminated,
            "score": player.calculate_best_score()[0]
        }
    
    return {
        "game_id": game_state.game_id,
        "players": players_dict,
        "current_player_id": game_state.current_player_id,
        "phase": game_state.phase.value,
        "discard_pile": [card.to_dict() for card in game_state.discard_pile],
        "deck_size": len(game_state.deck),
        "round_number": game_state.round_number,
        "winner_id": game_state.winner_id if game_state.winner_id else None
    }

@app.route("/")
def read_root():
    return jsonify({"message": "Welcome to the 31 Card Game Backend!", "version": "1.0.0"})

@app.route("/api/game-data")
def get_game_data():
    """Legacy endpoint for backward compatibility"""
    deck = create_deck()
    deck = shuffle_deck(deck)
    hands, remaining_deck = deal_cards(deck, 4)  # Example: 4 players
    return jsonify({"hands": hands, "remainingDeck": remaining_deck})

@app.route("/api/games", methods=["POST"])
def create_game():
    """Create a new game"""
    try:
        data = request.get_json()
        player_names = data.get("player_names", [])
        num_ai_players = data.get("num_ai_players", 0)
        
        if not player_names:
            return jsonify({"detail": "At least one player name required"}), 400
        
        game_state = create_new_game(player_names, num_ai_players)
        games[game_state.game_id] = game_state
        return jsonify(game_state_to_dict(game_state))
    except Exception as e:
        return jsonify({"detail": str(e)}), 400

@app.route("/api/games/<game_id>")
def get_game(game_id: str):
    """Get current game state"""
    if game_id not in games:
        return jsonify({"detail": "Game not found"}), 404
    return jsonify(game_state_to_dict(games[game_id]))

@app.route("/api/games/<game_id>/draw", methods=["POST"])
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

@app.route("/api/games/<game_id>/discard", methods=["POST"])
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

@app.route("/api/games/<game_id>/knock", methods=["POST"])
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

@app.route("/api/games")
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

@app.route("/api/games/<game_id>", methods=["DELETE"])
def delete_game(game_id: str):
    """Delete a game"""
    if game_id not in games:
        return jsonify({"detail": "Game not found"}), 404
    
    del games[game_id]
    return jsonify({"message": "Game deleted successfully"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
