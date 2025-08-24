from flask import Flask, request, jsonify
from flask_cors import CORS
from typing import Dict, List, Optional, Any
import json
import random

from game_logic import (
    create_deck, shuffle_deck, deal_cards, create_new_game, 
    draw_card, discard_card, knock, GameState, Player, Card, AIDifficulty
)

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"])

# In-memory game storage (for development - use database for production)
games: Dict[str, GameState] = {}

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

def advanced_ai_turn(game_state, player_id):
    """Advanced AI logic with different difficulty levels"""
    player = game_state.players[player_id]
    difficulty = player.ai_difficulty or AIDifficulty.MEDIUM
    
    # AI draws a card first if hand has 3 cards
    if len(player.hand) == 3:
        draw_success = ai_decide_draw(game_state, player_id, difficulty)
        if not draw_success:
            return False
    
    # AI decides what to discard if hand has 4 cards
    if len(player.hand) == 4:
        return ai_decide_discard_or_knock(game_state, player_id, difficulty)
    
    return True

def ai_decide_draw(game_state, player_id, difficulty):
    """AI decides whether to draw from deck or discard pile"""
    player = game_state.players[player_id]
    
    # Check if top discard card would improve hand
    if game_state.discard_pile:
        top_discard = game_state.discard_pile[0]
        
        # Calculate current best score
        current_score, current_suit = player.calculate_best_score()
        
        # Test if adding the discard card would improve score
        temp_hand = player.hand + [top_discard]
        temp_player = Player(id=player.id, name=player.name, hand=temp_hand, is_ai=True)
        
        # Try all possible discards to see best potential score
        best_potential_score = 0
        for i in range(len(temp_hand)):
            test_hand = temp_hand[:i] + temp_hand[i+1:]
            test_player = Player(id=player.id, name=player.name, hand=test_hand, is_ai=True)
            score, _ = test_player.calculate_best_score()
            best_potential_score = max(best_potential_score, score)
        
        # Decision based on difficulty
        should_take_discard = False
        
        if difficulty == AIDifficulty.EASY:
            # Easy: 30% chance to take discard if it improves score by 2+
            should_take_discard = (best_potential_score > current_score + 1) and random.random() < 0.3
        elif difficulty == AIDifficulty.MEDIUM:
            # Medium: 50% chance to take discard if it improves score by 1+
            should_take_discard = (best_potential_score > current_score) and random.random() < 0.5
        elif difficulty == AIDifficulty.HARD:
            # Hard: 70% chance to take discard if it improves score, considers suit building
            suit_improvement = top_discard.suit == current_suit
            should_take_discard = ((best_potential_score > current_score) or suit_improvement) and random.random() < 0.7
        elif difficulty == AIDifficulty.EXPERT:
            # Expert: Always takes discard if beneficial, considers opponent cards
            opponent_might_want = ai_analyze_opponent_needs(game_state, top_discard, player_id)
            should_take_discard = (best_potential_score > current_score) or (opponent_might_want and current_score >= 15)
        
        if should_take_discard:
            return draw_card(game_state, player_id, True)
    
    # Default: draw from deck
    return draw_card(game_state, player_id, False)

def ai_decide_discard_or_knock(game_state, player_id, difficulty):
    """AI decides whether to knock or which card to discard"""
    player = game_state.players[player_id]
    current_score, current_suit = player.calculate_best_score()
    
    # Analyze all possible discards
    discard_options = []
    for i, card in enumerate(player.hand):
        temp_hand = player.hand[:i] + player.hand[i+1:]
        temp_player = Player(id=player.id, name=player.name, hand=temp_hand, is_ai=True)
        score_after_discard, suit_after = temp_player.calculate_best_score()
        
        discard_options.append({
            'index': i,
            'card': card,
            'score_after': score_after_discard,
            'suit_after': suit_after
        })
    
    # Find best discard option
    best_option = max(discard_options, key=lambda x: x['score_after'])
    best_score = best_option['score_after']
    
    # Decide whether to knock based on difficulty and game state
    should_knock = ai_should_knock(game_state, player_id, best_score, difficulty)
    
    if should_knock and len(player.hand) == 3:
        return knock(game_state, player_id)
    else:
        # Choose which card to discard based on difficulty
        chosen_discard = ai_choose_discard(discard_options, difficulty, game_state, player_id)
        return discard_card(game_state, player_id, chosen_discard['index'])

def ai_should_knock(game_state, player_id, best_score, difficulty):
    """Determine if AI should knock based on difficulty and game state"""
    # Analyze opponent scores (rough estimate)
    estimated_opponent_scores = ai_estimate_opponent_scores(game_state, player_id)
    avg_opponent_score = sum(estimated_opponent_scores.values()) / len(estimated_opponent_scores) if estimated_opponent_scores else 15
    
    knock_thresholds = {
        AIDifficulty.EASY: 20,      # Conservative, high threshold
        AIDifficulty.MEDIUM: 18,    # Moderate threshold
        AIDifficulty.HARD: 16,      # More aggressive
        AIDifficulty.EXPERT: 14     # Very aggressive when ahead
    }
    
    base_threshold = knock_thresholds[difficulty]
    
    # Expert AI adjusts threshold based on game state
    if difficulty == AIDifficulty.EXPERT:
        if best_score > avg_opponent_score + 3:
            base_threshold = 12  # Very aggressive when clearly ahead
        elif game_state.round_number > 3:
            base_threshold = 16  # More conservative in later rounds
    
    # Add some randomness
    knock_probability = {
        AIDifficulty.EASY: 0.2,
        AIDifficulty.MEDIUM: 0.4,
        AIDifficulty.HARD: 0.6,
        AIDifficulty.EXPERT: 0.8
    }
    
    return best_score >= base_threshold and random.random() < knock_probability[difficulty]

def ai_choose_discard(discard_options, difficulty, game_state, player_id):
    """Choose which card to discard based on AI difficulty"""
    if difficulty == AIDifficulty.EASY:
        # Easy: Sometimes makes suboptimal choices
        if random.random() < 0.3:  # 30% chance of random choice
            return random.choice(discard_options)
        else:
            return max(discard_options, key=lambda x: x['score_after'])
    
    elif difficulty == AIDifficulty.MEDIUM:
        # Medium: Usually optimal, sometimes considers opponent needs
        best_options = [opt for opt in discard_options if opt['score_after'] == max(discard_options, key=lambda x: x['score_after'])['score_after']]
        if len(best_options) > 1 and random.random() < 0.4:
            # Consider not giving opponents useful cards
            return ai_filter_discard_by_opponent_needs(best_options, game_state, player_id)
        return max(discard_options, key=lambda x: x['score_after'])
    
    elif difficulty == AIDifficulty.HARD:
        # Hard: Always optimal, considers opponent needs
        best_options = [opt for opt in discard_options if opt['score_after'] == max(discard_options, key=lambda x: x['score_after'])['score_after']]
        return ai_filter_discard_by_opponent_needs(best_options, game_state, player_id)
    
    elif difficulty == AIDifficulty.EXPERT:
        # Expert: Optimal + advanced strategy
        best_options = [opt for opt in discard_options if opt['score_after'] == max(discard_options, key=lambda x: x['score_after'])['score_after']]
        # Consider game state, opponent tendencies, card counting
        return ai_expert_discard_choice(best_options, game_state, player_id)
    
    return max(discard_options, key=lambda x: x['score_after'])

def ai_analyze_opponent_needs(game_state, card, player_id):
    """Analyze if opponents might want this card"""
    # Simple heuristic: high-value cards and face cards are generally wanted
    high_value_cards = ['10', 'J', 'Q', 'K', 'A']
    return card.value in high_value_cards

def ai_estimate_opponent_scores(game_state, player_id):
    """Estimate opponent scores based on their actions"""
    # This is a simplified estimation - in a real game, AI would track cards
    estimates = {}
    for pid, player in game_state.players.items():
        if pid != player_id and not player.is_eliminated:
            # Base estimate around 15, adjust based on game state
            base_estimate = 15
            if game_state.turn_count > 10:  # Later in game, assume higher scores
                base_estimate = 18
            estimates[pid] = base_estimate + random.randint(-3, 3)
    return estimates

def ai_filter_discard_by_opponent_needs(options, game_state, player_id):
    """Filter discard options to avoid helping opponents"""
    # Prefer discarding lower value cards when multiple good options exist
    low_value_options = [opt for opt in options if opt['card'].get_point_value() <= 7]
    if low_value_options:
        return random.choice(low_value_options)
    return random.choice(options)

def ai_expert_discard_choice(options, game_state, player_id):
    """Expert AI discard logic with advanced considerations"""
    # Expert considers: card counting, opponent patterns, endgame strategy
    
    # In final rounds, be more conservative
    if game_state.phase.name == "FINAL_ROUND":
        safe_options = [opt for opt in options if opt['card'].get_point_value() <= 6]
        if safe_options:
            return random.choice(safe_options)
    
    # Default to best score while preferring lower value discards
    return ai_filter_discard_by_opponent_needs(options, game_state, player_id)
    
    return True

@app.route("/api/games/<game_id>/ai-turn", methods=["POST"])
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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
