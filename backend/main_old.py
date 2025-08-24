from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Optional, Any
import uvicorn

from game_logic import (
    create_deck, shuffle_deck, deal_cards, create_new_game, 
    draw_card, discard_card, knock, GameState, Player, Card
)

app = FastAPI(title="31 Card Game API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.get("/")
def read_root():
    return {"message": "Welcome to the 31 Card Game Backend!", "version": "1.0.0"}

@app.get("/api/game-data")
def get_game_data():
    """Legacy endpoint for backward compatibility"""
    deck = create_deck()
    deck = shuffle_deck(deck)
    hands, remaining_deck = deal_cards(deck, 4)  # Example: 4 players
    return {"hands": hands, "remainingDeck": remaining_deck}

@app.post("/api/games")
def create_game(request: Dict[str, Any]):
    """Create a new game"""
    try:
        player_names = request.get("player_names", [])
        num_ai_players = request.get("num_ai_players", 0)
        
        if not player_names:
            raise HTTPException(status_code=400, detail="At least one player name required")
        
        game_state = create_new_game(player_names, num_ai_players)
        games[game_state.game_id] = game_state
        return game_state_to_dict(game_state)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/games/{game_id}")
def get_game(game_id: str):
    """Get current game state"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    return game_state_to_dict(games[game_id])

@app.post("/api/games/{game_id}/draw")
def draw_card_endpoint(game_id: str, request: Dict[str, Any]):
    """Player draws a card"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    player_id = request.get("player_id")
    from_discard = request.get("from_discard", False)
    
    if not player_id:
        raise HTTPException(status_code=400, detail="player_id required")
    
    game_state = games[game_id]
    success = draw_card(game_state, player_id, from_discard)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid draw action")
    
    return game_state_to_dict(game_state)

@app.post("/api/games/{game_id}/discard")
def discard_card_endpoint(game_id: str, request: Dict[str, Any]):
    """Player discards a card"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    player_id = request.get("player_id")
    card_index = request.get("card_index")
    
    if not player_id or card_index is None:
        raise HTTPException(status_code=400, detail="player_id and card_index required")
    
    game_state = games[game_id]
    success = discard_card(game_state, player_id, card_index)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid discard action")
    
    return game_state_to_dict(game_state)

@app.post("/api/games/{game_id}/knock")
def knock_endpoint(game_id: str, request: Dict[str, Any]):
    """Player knocks"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    player_id = request.get("player_id")
    
    if not player_id:
        raise HTTPException(status_code=400, detail="player_id required")
    
    game_state = games[game_id]
    success = knock(game_state, player_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid knock action")
    
    return game_state_to_dict(game_state)

@app.get("/api/games")
def list_games():
    """List all active games"""
    return {
        "games": [
            {
                "game_id": game_id,
                "players": len(game_state.players),
                "phase": game_state.phase.value,
                "round": game_state.round_number
            }
            for game_id, game_state in games.items()
        ]
    }

@app.delete("/api/games/{game_id}")
def delete_game(game_id: str):
    """Delete a game"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    del games[game_id]
    return {"message": "Game deleted successfully"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)

@app.get("/")
def read_root():
    return {"message": "Welcome to the 31 Card Game Backend!", "version": "1.0.0"}

@app.get("/api/game-data")
def get_game_data():
    """Legacy endpoint for backward compatibility"""
    deck = create_deck()
    deck = shuffle_deck(deck)
    hands, remaining_deck = deal_cards(deck, 4)  # Example: 4 players
    return {"hands": hands, "remainingDeck": remaining_deck}

@app.post("/api/games")
def create_game(request: CreateGameRequest):
    """Create a new game"""
    try:
        game_state = create_new_game(request.player_names, request.num_ai_players)
        games[game_state.game_id] = game_state
        return game_state_to_response(game_state)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/games/{game_id}")
def get_game(game_id: str):
    """Get current game state"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    return game_state_to_response(games[game_id])

@app.post("/api/games/{game_id}/draw")
def draw_card_endpoint(game_id: str, request: DrawCardRequest):
    """Player draws a card"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game_state = games[game_id]
    success = draw_card(game_state, request.player_id, request.from_discard)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid draw action")
    
    return game_state_to_response(game_state)

@app.post("/api/games/{game_id}/discard")
def discard_card_endpoint(game_id: str, request: DiscardCardRequest):
    """Player discards a card"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game_state = games[game_id]
    success = discard_card(game_state, request.player_id, request.card_index)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid discard action")
    
    return game_state_to_response(game_state)

@app.post("/api/games/{game_id}/knock")
def knock_endpoint(game_id: str, request: GameActionRequest):
    """Player knocks"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game_state = games[game_id]
    success = knock(game_state, request.player_id)
    
    if not success:
        raise HTTPException(status_code=400, detail="Invalid knock action")
    
    return game_state_to_response(game_state)

@app.get("/api/games")
def list_games():
    """List all active games"""
    return {
        "games": [
            {
                "game_id": game_id,
                "players": len(game_state.players),
                "phase": game_state.phase.value,
                "round": game_state.round_number
            }
            for game_id, game_state in games.items()
        ]
    }

@app.delete("/api/games/{game_id}")
def delete_game(game_id: str):
    """Delete a game"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    del games[game_id]
    return {"message": "Game deleted successfully"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
