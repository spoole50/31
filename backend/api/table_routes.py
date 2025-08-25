"""
Table management routes for 31 Card Game API

This module contains all table-related HTTP endpoints for multiplayer functionality.
"""

from flask import Blueprint, request, jsonify
from typing import Optional

from table_logic import table_manager, TableStatus, AIDifficulty
from utils.serializers import game_state_to_dict

# Create blueprint for table routes
table_routes = Blueprint('table_routes', __name__)


@table_routes.route("/api/debug")
def debug_route():
    """Debug route to test if table routes are working"""
    return jsonify({"message": "Table routes are working!"})


@table_routes.route("/api/tables", methods=["POST"])
def create_table():
    """Create a new game table"""
    try:
        data = request.get_json()
        print(f"Create table request data: {data}")
        
        host_id = data.get("host_id")
        host_name = data.get("host_name")
        table_name = data.get("table_name", "New Game")
        try:
            max_players = int(data.get("max_players", 8))
        except (ValueError, TypeError):
            return jsonify({"error": "max_players must be a valid number"}), 400
        is_private = data.get("is_private", True)
        password = data.get("password")
        
        print(f"Parsed data - host_id: {host_id}, host_name: {host_name}, table_name: {table_name}, max_players: {max_players}")
        
        if not host_id or not host_name:
            print(f"Missing required fields - host_id: {host_id}, host_name: {host_name}")
            return jsonify({"error": "host_id and host_name are required"}), 400
        
        if max_players < 2 or max_players > 8:
            return jsonify({"error": "max_players must be between 2 and 8"}), 400
        
        # Check if player is already in a table
        existing_table = table_manager.get_player_table(host_id)
        if existing_table:
            return jsonify({"error": "Player is already in a table"}), 400
        
        table = table_manager.create_table(
            host_id=host_id,
            host_name=host_name,
            table_name=table_name,
            max_players=max_players,
            is_private=is_private,
            password=password
        )
        
        return jsonify(table.to_dict()), 201
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/tables/join", methods=["POST"])
def join_table():
    """Join a table using invite code or table ID"""
    try:
        data = request.get_json()
        player_id = data.get("player_id")
        player_name = data.get("player_name")
        invite_code = data.get("invite_code")
        table_id = data.get("table_id")
        password = data.get("password")
        
        if not player_id or not player_name:
            return jsonify({"error": "player_id and player_name are required"}), 400
        
        if not invite_code and not table_id:
            return jsonify({"error": "Either invite_code or table_id is required"}), 400
        
        table = None
        
        if invite_code:
            table = table_manager.join_table_by_code(player_id, player_name, invite_code, password)
        elif table_id:
            table = table_manager.join_table_by_id(player_id, player_name, table_id)
        
        if not table:
            return jsonify({"error": "Could not join table - table not found, full, or incorrect password"}), 400
        
        return jsonify(table.to_dict())
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@table_routes.route("/api/tables/<table_id>/join", methods=["POST"])
def join_table_by_id(table_id):
    """Join a specific table by ID"""
    try:
        data = request.get_json()
        player_id = data.get("player_id")
        password = data.get("password", "")
        
        # Get player name from session or use a default
        player_name = data.get("player_name", f"Player_{player_id[:8]}")
        
        if not player_id:
            return jsonify({"error": "player_id is required"}), 400
        
        print(f"[JOIN_TABLE] Attempting to join table {table_id} with player {player_id}")
        print(f"[JOIN_TABLE] Available tables: {list(table_manager.tables.keys())}")
        print(f"[JOIN_TABLE] Table exists: {table_id in table_manager.tables}")
        
        if table_id in table_manager.tables:
            table = table_manager.tables[table_id]
            print(f"[JOIN_TABLE] Table found: {table.table_name}, is_private: {table.is_private}, can_join: {table.can_join()}")
            print(f"[JOIN_TABLE] Current players: {len(table.players)}, max: {table.max_players}")
        
        table = table_manager.join_table_by_id(player_id, player_name, table_id)
        
        if not table:
            print(f"[JOIN_TABLE] Failed to join table {table_id} - table not found, full, or incorrect password")
            return jsonify({"error": "Could not join table - table not found, full, or incorrect password"}), 400
        
        print(f"[JOIN_TABLE] Successfully joined table {table_id}")
        return jsonify(table.to_dict())
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/tables/<table_id>/leave", methods=["POST"])
def leave_table(table_id: str):
    """Leave a table"""
    try:
        data = request.get_json()
        player_id = data.get("player_id")
        
        if not player_id:
            return jsonify({"error": "player_id is required"}), 400
        
        success = table_manager.leave_table(player_id)
        
        if not success:
            return jsonify({"error": "Player not in table or table not found"}), 400
        
        return jsonify({"message": "Left table successfully"})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/tables/<table_id>")
def get_table(table_id: str):
    """Get table information"""
    table = table_manager.get_table(table_id)
    
    if not table:
        return jsonify({"error": "Table not found"}), 404
    
    return jsonify(table.to_dict())


@table_routes.route("/api/tables/<table_id>/start", methods=["POST"])
def start_table_game(table_id: str):
    """Start the game for a table (host only)"""
    try:
        data = request.get_json()
        host_id = data.get("host_id")
        
        print(f"[START_GAME] Request data: {data}")
        print(f"[START_GAME] Table ID: {table_id}, Host ID: {host_id}")
        
        if not host_id:
            print(f"[START_GAME] Error: host_id is required")
            return jsonify({"error": "host_id is required"}), 400
        
        success = table_manager.start_table_game(table_id, host_id)
        
        print(f"[START_GAME] Start game result: {success}")
        
        if not success:
            print(f"[START_GAME] Error: Could not start game")
            return jsonify({"error": "Could not start game - insufficient players, not host, or table not found"}), 400
        
        table = table_manager.get_table(table_id)
        print(f"[START_GAME] Game started successfully, new status: {table.status}")
        return jsonify(table.to_dict())
    
    except Exception as e:
        print(f"[START_GAME] Exception: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/tables/<table_id>/add-ai", methods=["POST"])
def add_ai_player(table_id: str):
    """Add an AI player to the table (host only)"""
    try:
        data = request.get_json()
        host_id = data.get("host_id")
        difficulty = data.get("difficulty", "medium")
        
        if not host_id:
            return jsonify({"error": "host_id is required"}), 400
        
        table = table_manager.get_table(table_id)
        if not table:
            return jsonify({"error": "Table not found"}), 404
        
        # Verify host
        host = table.get_host()
        if not host or host.id != host_id:
            return jsonify({"error": "Only the host can add AI players"}), 403
        
        # Convert difficulty string to enum
        try:
            ai_difficulty = AIDifficulty(difficulty.lower())
        except ValueError:
            ai_difficulty = AIDifficulty.MEDIUM
        
        success = table.add_ai_player(ai_difficulty)
        
        if not success:
            return jsonify({"error": "Could not add AI player - table may be full or game already started"}), 400
        
        return jsonify(table.to_dict())
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/tables")
@table_routes.route("/api/tables/public")
def list_tables():
    """List all public tables"""
    try:
        public_tables = table_manager.list_public_tables()
        return jsonify({
            "tables": [table.to_dict() for table in public_tables]
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/tables/<table_id>/game")
def get_table_game(table_id: str):
    """Get the current game state for a table"""
    table = table_manager.get_table(table_id)
    
    if not table:
        return jsonify({"error": "Table not found"}), 404
    
    if not table.game_state:
        return jsonify({"error": "No game in progress"}), 400
    
    # Update activity for requesting player if player_id is provided
    player_id = request.args.get("player_id")
    if player_id and player_id in table.players:
        table.update_player_activity(player_id)
    
    return jsonify(game_state_to_dict(table.game_state))


@table_routes.route("/api/tables/<table_id>/game/<action>", methods=["POST"])
def table_game_action(table_id: str, action: str):
    """Perform game actions within a table context"""
    table = table_manager.get_table(table_id)
    
    if not table:
        return jsonify({"error": "Table not found"}), 404
    
    if not table.game_state:
        return jsonify({"error": "No game in progress"}), 400
    
    if table.status != TableStatus.PLAYING:
        return jsonify({"error": "Game is not in playing state"}), 400
    
    # Import game logic functions
    from game_logic import draw_card, discard_card, knock
    from ai.engine import advanced_ai_turn
    
    data = request.get_json()
    player_id = data.get("player_id")
    
    print(f"[GAME_ACTION] Table: {table_id}, Action: {action}, Player: {player_id}")
    
    if not player_id:
        return jsonify({"error": "player_id is required"}), 400
    
    # Verify player is in this table
    if player_id not in table.players:
        return jsonify({"error": "Player not in this table"}), 403
    
    # Update player activity
    table.update_player_activity(player_id)
    
    # Get the corresponding game player ID
    game_player_id = table.get_game_player_id(player_id)
    if not game_player_id:
        return jsonify({"error": "Player not mapped to game"}), 400
    
    game_state = table.game_state
    print(f"[GAME_ACTION] Current turn: {game_state.current_player_id}")
    
    try:
        if action == "draw":
            from_discard = data.get("from_discard", False)
            success = draw_card(game_state, game_player_id, from_discard)
        
        elif action == "discard":
            card_index = data.get("card_index")
            if card_index is None:
                return jsonify({"error": "card_index is required for discard"}), 400
            success = discard_card(game_state, game_player_id, card_index)
        
        elif action == "knock":
            success = knock(game_state, game_player_id)
        
        elif action == "ai-turn":
            # For AI turn, we need to check if the current player is actually AI
            # This action should only be called when it's an AI player's turn
            current_player = game_state.players.get(game_state.current_player_id)
            print(f"[AI_TURN] Current player: {game_state.current_player_id}")
            print(f"[AI_TURN] Player exists: {current_player is not None}")
            if current_player:
                print(f"[AI_TURN] Player name: {current_player.name}, is_ai: {current_player.is_ai}")
            
            if not current_player:
                return jsonify({"error": "Current player not found"}), 400
            
            # Only allow AI turn if current player is AI
            if not current_player.is_ai:
                print(f"[AI_TURN] ERROR: Attempted AI turn for human player {current_player.name}")
                return jsonify({"error": f"Cannot process AI turn - current player {current_player.name} is human"}), 400
                
            print(f"[AI_TURN] Processing AI turn for {current_player.name}")
            success = advanced_ai_turn(game_state, game_state.current_player_id)
        
        else:
            return jsonify({"error": f"Unknown action: {action}"}), 400
        
        if not success:
            return jsonify({"error": f"Invalid {action} action"}), 400
        
        # Schedule AI turn if needed after successful player action
        table.schedule_ai_turn_if_needed()
        
        # Check if game is finished
        if game_state.is_game_over():
            table.status = TableStatus.FINISHED
        
        return jsonify(game_state_to_dict(game_state))
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/player/<string:player_id>/table", methods=["GET"])
def get_player_current_table(player_id: str):
    """Get the table a player is currently in"""
    try:
        print(f"Looking for table for player: {player_id}")
        table = table_manager.get_player_table(player_id)
        
        if not table:
            print(f"No table found for player: {player_id}")
            return jsonify({"error": "Player not in any table"}), 404
        
        print(f"Found table for player: {player_id}")
        return jsonify(table.to_dict())
    except Exception as e:
        print(f"Error in get_player_current_table: {e}")
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/tables/cleanup", methods=["POST"])
def cleanup_tables():
    """Clean up old finished tables and check for disconnected players"""
    try:
        # Check for disconnected players
        disconnected_log = table_manager.check_all_tables_for_disconnects(timeout_seconds=45)
        
        # Clean up old tables
        table_manager.cleanup_old_tables()
        
        return jsonify({
            "message": "Cleanup completed",
            "disconnected_players": disconnected_log
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@table_routes.route("/api/tables/check-disconnects", methods=["POST"])
def check_disconnects():
    """Check for disconnected players across all tables"""
    try:
        disconnected_log = table_manager.check_all_tables_for_disconnects(timeout_seconds=45)
        return jsonify({
            "message": "Disconnect check completed",
            "disconnected_players": disconnected_log
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
