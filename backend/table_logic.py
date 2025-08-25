"""
Table management system for 31 Card Game

This module handles table creation, player invitations, and lobby management
for online multiplayer functionality.
"""

import uuid
import random
import string
import threading
import time
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta

from game_logic import GameState, Player, AIDifficulty, create_new_game, GamePhase, end_round
from ai.engine import advanced_ai_turn


class TableStatus(Enum):
    WAITING = "waiting"  # Waiting for players to join
    READY = "ready"      # All players joined, ready to start
    PLAYING = "playing"  # Game in progress
    FINISHED = "finished" # Game completed


class PlayerStatus(Enum):
    INVITED = "invited"   # Invited but not joined
    JOINED = "joined"     # In the lobby
    READY = "ready"       # Ready to start game
    PLAYING = "playing"   # Currently playing


@dataclass
class TablePlayer:
    """Represents a player in a table context"""
    id: str
    name: str
    status: PlayerStatus = PlayerStatus.INVITED
    is_host: bool = False
    joined_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None
    is_ai: bool = False
    ai_difficulty: Optional[AIDifficulty] = None
    
    def __post_init__(self):
        if self.joined_at is None and self.status == PlayerStatus.JOINED:
            self.joined_at = datetime.now()
        if self.last_activity is None:
            self.last_activity = datetime.now()
    
    def update_activity(self):
        """Update the last activity timestamp"""
        self.last_activity = datetime.now()


@dataclass
class GameTable:
    """Represents a game table where players can join and play"""
    table_id: str
    table_name: str
    host_id: str
    invite_code: str
    created_at: datetime = field(default_factory=datetime.now)
    status: TableStatus = TableStatus.WAITING
    max_players: int = 8
    min_players: int = 2
    players: Dict[str, TablePlayer] = field(default_factory=dict)
    game_state: Optional[GameState] = None
    is_private: bool = True  # Private tables require invite code
    password: Optional[str] = None  # Optional password protection
    player_id_mapping: Dict[str, str] = field(default_factory=dict)  # table_player_id -> game_player_id
    
    def __post_init__(self):
        if not self.invite_code:
            self.invite_code = self._generate_invite_code()
    
    def _generate_invite_code(self, length: int = 6) -> str:
        """Generate a random invite code"""
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
    
    def can_join(self) -> bool:
        """Check if new players can join this table"""
        return (
            self.status == TableStatus.WAITING and  # Only allow joining before game starts
            len(self.players) < self.max_players
        )
    
    def can_start_game(self) -> bool:
        """Check if the game can be started"""
        joined_players = [p for p in self.players.values() if p.status in [PlayerStatus.JOINED, PlayerStatus.READY]]
        return (
            self.status in [TableStatus.WAITING, TableStatus.READY] and
            len(joined_players) >= self.min_players and
            len(joined_players) <= self.max_players
        )
    
    def get_host(self) -> Optional[TablePlayer]:
        """Get the table host"""
        return next((p for p in self.players.values() if p.is_host), None)
    
    def get_joined_players(self) -> List[TablePlayer]:
        """Get players who have joined the table"""
        return [p for p in self.players.values() if p.status in [PlayerStatus.JOINED, PlayerStatus.READY, PlayerStatus.PLAYING]]
    
    def can_player_rejoin_during_turn(self, player_id: str, grace_period_seconds: int = 20) -> bool:
        """Check if a player can rejoin when it's their turn with time remaining"""
        if not self.game_state or self.status != TableStatus.PLAYING:
            return True  # Always allow rejoin if game not active
        
        # Find the game player ID for this table player
        game_player_id = self.player_id_mapping.get(player_id)
        if not game_player_id:
            return True  # Player not in game, allow rejoin
        
        # Check if it's currently this player's turn
        if self.game_state.current_player_id != game_player_id:
            return True  # Not their turn, allow rejoin
        
        # Check if they have enough time remaining (grace period)
        time_remaining = self.game_state.get_turn_time_remaining()
        return time_remaining >= grace_period_seconds

    def add_player(self, player_id: str, player_name: str, is_host: bool = False) -> bool:
        """Add a player to the table"""
        if not self.can_join():
            return False
        
        # Check if player is trying to rejoin
        if player_id in self.players:
            # Check grace period for rejoining during their turn
            if not self.can_player_rejoin_during_turn(player_id):
                time_remaining = self.game_state.get_turn_time_remaining() if self.game_state else 0
                print(f"[REJOIN_BLOCKED] Player {player_name} blocked from rejoining - only {time_remaining}s remaining on their turn")
                return False
            
            # Update player activity for successful rejoin
            self.players[player_id].update_activity()
            print(f"[REJOIN] Player {player_name} successfully rejoined table")
            return True
        
        # New player joining
        self.players[player_id] = TablePlayer(
            id=player_id,
            name=player_name,
            status=PlayerStatus.JOINED,
            is_host=is_host,
            joined_at=datetime.now()
        )
        
        return True
    
    def remove_player(self, player_id: str) -> bool:
        """Remove a player from the table"""
        if player_id not in self.players:
            return False
        
        was_host = self.players[player_id].is_host
        del self.players[player_id]
        
        # If host left, promote another player to host
        if was_host and self.players:
            next_host = next(iter(self.players.values()))
            next_host.is_host = True
        
        # If no players left, mark table for cleanup
        if not self.players:
            self.status = TableStatus.FINISHED
        
        return True
    
    def update_player_activity(self, player_id: str) -> bool:
        """Update a player's last activity timestamp"""
        if player_id in self.players:
            self.players[player_id].update_activity()
            return True
        return False
    
    def check_for_disconnected_players(self, timeout_seconds: int = 45) -> List[str]:
        """Check for players who have been inactive for too long"""
        disconnected_players = []
        current_time = datetime.now()
        
        # Use extended timeout (45s turn + 20s grace = 65s total) for actual disconnection
        extended_timeout = timeout_seconds + 20
        
        for player_id, player in self.players.items():
            # Don't disconnect AI players
            if player.is_ai:
                continue
                
            # Check if player has been inactive for too long
            if player.last_activity:
                time_since_activity = (current_time - player.last_activity).total_seconds()
                if time_since_activity > extended_timeout:
                    disconnected_players.append(player_id)
        
        return disconnected_players
    
    def remove_disconnected_players(self, timeout_seconds: int = 45) -> List[str]:
        """Remove players who have been disconnected for too long"""
        disconnected_players = self.check_for_disconnected_players(timeout_seconds)
        removed_players = []
        
        for player_id in disconnected_players:
            if self.remove_player(player_id):
                removed_players.append(player_id)
        
        return removed_players
    
    def add_ai_player(self, difficulty: AIDifficulty = AIDifficulty.MEDIUM) -> bool:
        """Add an AI player to the table"""
        if not self.can_join():
            return False
        
        ai_id = f"ai_{uuid.uuid4().hex[:8]}"
        ai_names = ["RoboCard", "ChipBot", "CardMaster", "AceAI", "SuitBot", "DeckWiz", "PokerFace", "GameGenie"]
        ai_name = random.choice(ai_names)
        
        # Make sure name is unique
        existing_names = {p.name for p in self.players.values()}
        counter = 1
        original_name = ai_name
        while ai_name in existing_names:
            ai_name = f"{original_name}{counter}"
            counter += 1
        
        self.players[ai_id] = TablePlayer(
            id=ai_id,
            name=ai_name,
            status=PlayerStatus.READY,  # AI is always ready
            is_ai=True,
            ai_difficulty=difficulty,
            joined_at=datetime.now()
        )
        
        return True
    
    def start_game(self) -> bool:
        """Start the game for this table"""
        if not self.can_start_game():
            return False
        
        try:
            # Prepare player data for game creation
            joined_players = self.get_joined_players()
            human_players = [p for p in joined_players if not p.is_ai]
            ai_players = [p for p in joined_players if p.is_ai]
            
            # Create game with original table player names for ID mapping
            player_names = [p.name for p in human_players]
            
            # Map table player IDs to game player IDs for later reference
            self.player_id_mapping = {}
            game_player_ids = [f"player_{i+1}" for i in range(len(human_players))]
            ai_game_ids = [f"ai_{i+1}" for i in range(len(ai_players))]
            
            # Map human players first to determine host game ID
            host_game_player_id = ""
            for i, table_player in enumerate(human_players):
                if i < len(game_player_ids):
                    game_player_id = game_player_ids[i]
                    self.player_id_mapping[table_player.id] = game_player_id
                    # Track the host's game player ID
                    if table_player.id == self.host_id:
                        host_game_player_id = game_player_id
            
            # Map AI players
            for i, table_player in enumerate(ai_players):
                if i < len(ai_game_ids):
                    ai_game_id = ai_game_ids[i]
                    self.player_id_mapping[table_player.id] = ai_game_id
            
            # Create the game with host information
            self.game_state = create_new_game(
                player_names=player_names,
                num_ai_players=len(ai_players),
                ai_difficulties=[p.ai_difficulty or AIDifficulty.MEDIUM for p in ai_players],
                host_player_id=host_game_player_id
            )
            
            # Update table and player statuses
            self.status = TableStatus.PLAYING
            for player in joined_players:
                player.status = PlayerStatus.PLAYING
            
            # Schedule AI turn if needed
            self.schedule_ai_turn_if_needed()
            
            return True
        except Exception as e:
            print(f"Error starting game: {e}")  # Debug logging
            return False
    
    def to_dict(self) -> dict:
        """Convert table to dictionary for API responses"""
        from utils.serializers import game_state_to_dict
        
        result = {
            "table_id": self.table_id,
            "table_name": self.table_name,
            "host_id": self.host_id,
            "invite_code": self.invite_code,
            "created_at": self.created_at.isoformat(),
            "status": self.status.value,
            "max_players": self.max_players,
            "min_players": self.min_players,
            "current_players": len(self.players),
            "is_private": self.is_private,
            "can_join": self.can_join(),
            "can_start": self.can_start_game(),
            "players": [
                {
                    "id": p.id,
                    "name": p.name,
                    "status": p.status.value,
                    "is_host": p.is_host,
                    "is_ai": p.is_ai,
                    "ai_difficulty": p.ai_difficulty.value if p.ai_difficulty else None,
                    "joined_at": p.joined_at.isoformat() if p.joined_at else None
                }
                for p in self.players.values()
            ]
        }
        
        # Include game state if game is active
        if self.game_state:
            result["game_state"] = game_state_to_dict(self.game_state)
            result["player_id_mapping"] = self.player_id_mapping
        
        return result
    
    def get_game_player_id(self, table_player_id: str) -> Optional[str]:
        """Get the corresponding game player ID for a table player ID"""
        return self.player_id_mapping.get(table_player_id)
    
    def schedule_ai_turn_if_needed(self):
        """Check if it's an AI player's turn and schedule processing with delay"""
        if not self.game_state or self.status != TableStatus.PLAYING:
            return
        
        current_player_id = self.game_state.current_player_id
        current_player = self.game_state.players.get(current_player_id)
        
        if current_player and current_player.is_ai:
            # Random delay between 0.5 and 3 seconds
            delay = random.uniform(0.5, 3.0)
            
            # Schedule AI turn processing in a separate thread
            def process_ai_turn():
                time.sleep(delay)
                if self.game_state and self.game_state.current_player_id == current_player_id:
                    try:
                        # Check if there are still human players before processing AI turn
                        if len(self.game_state.get_active_human_players()) == 0:
                            print(f"No human players remaining - ending game")
                            end_round(self.game_state, skip_life_loss=True)
                            self.status = TableStatus.FINISHED
                            return
                        
                        advanced_ai_turn(self.game_state, current_player_id)
                        print(f"AI player {current_player.name} processed turn after {delay:.1f}s delay")
                        
                        # Check again after AI turn if game should end
                        if self.game_state.is_game_over():
                            end_round(self.game_state, skip_life_loss=True)
                            self.status = TableStatus.FINISHED
                    except Exception as e:
                        print(f"Error processing AI turn for {current_player.name}: {e}")
            
            ai_thread = threading.Thread(target=process_ai_turn, daemon=True)
            ai_thread.start()


class TableManager:
    """Manages all game tables"""
    
    def __init__(self):
        self.tables: Dict[str, GameTable] = {}
        self.player_to_table: Dict[str, str] = {}  # Track which table each player is in
    
    def create_table(self, host_id: str, host_name: str, table_name: str, 
                    max_players: int = 8, is_private: bool = True, password: Optional[str] = None) -> GameTable:
        """Create a new game table"""
        table_id = str(uuid.uuid4())
        
        table = GameTable(
            table_id=table_id,
            table_name=table_name,
            host_id=host_id,
            invite_code="",  # Will be generated in __post_init__
            max_players=min(max_players, 8),  # Cap at 8 players
            is_private=is_private,
            password=password
        )
        
        # Add host as first player
        table.add_player(host_id, host_name, is_host=True)
        
        self.tables[table_id] = table
        self.player_to_table[host_id] = table_id
        
        return table
    
    def join_table_by_code(self, player_id: str, player_name: str, invite_code: str, password: Optional[str] = None) -> Optional[GameTable]:
        """Join a table using invite code"""
        # Find table by invite code
        table = next((t for t in self.tables.values() if t.invite_code == invite_code), None)
        
        if not table:
            return None
        
        if not table.can_join():
            return None
        
        # Check password if required
        if table.password and table.password != password:
            return None
        
        # Remove player from current table if they're in one
        self.leave_table(player_id)
        
        # Add to new table
        if table.add_player(player_id, player_name):
            self.player_to_table[player_id] = table.table_id
            # Check if AI turn needed (in case game is already running)
            table.schedule_ai_turn_if_needed()
            return table
        
        return None
    
    def join_table_by_id(self, player_id: str, player_name: str, table_id: str) -> Optional[GameTable]:
        """Join a table by table ID (for public tables)"""
        if table_id not in self.tables:
            return None
        
        table = self.tables[table_id]
        
        if table.is_private or not table.can_join():
            return None
        
        # Remove player from current table if they're in one
        self.leave_table(player_id)
        
        # Add to new table
        if table.add_player(player_id, player_name):
            self.player_to_table[player_id] = table_id
            # Check if AI turn needed (in case game is already running)
            table.schedule_ai_turn_if_needed()
            return table
        
        return None
    
    def leave_table(self, player_id: str) -> bool:
        """Remove player from their current table"""
        if player_id not in self.player_to_table:
            return False
        
        table_id = self.player_to_table[player_id]
        if table_id not in self.tables:
            del self.player_to_table[player_id]
            return False
        
        table = self.tables[table_id]
        success = table.remove_player(player_id)
        
        if success:
            del self.player_to_table[player_id]
        
        # Clean up empty tables
        if not table.players:
            del self.tables[table_id]
        
        return success
    
    def get_player_table(self, player_id: str) -> Optional[GameTable]:
        """Get the table a player is currently in"""
        if player_id not in self.player_to_table:
            return None
        
        table_id = self.player_to_table[player_id]
        return self.tables.get(table_id)
    
    def get_table(self, table_id: str) -> Optional[GameTable]:
        """Get table by ID"""
        return self.tables.get(table_id)
    
    def list_public_tables(self) -> List[GameTable]:
        """List all public tables that can be joined"""
        return [
            table for table in self.tables.values()
            if not table.is_private and table.can_join()
        ]
    
    def start_table_game(self, table_id: str, host_id: str) -> bool:
        """Start game for a table (only host can start)"""
        table = self.get_table(table_id)
        if not table:
            return False
        
        # Verify host
        host = table.get_host()
        if not host or host.id != host_id:
            return False
        
        return table.start_game()
    
    def check_all_tables_for_disconnects(self, timeout_seconds: int = 45):
        """Check all tables for disconnected players and turn timeouts"""
        disconnected_log = []
        
        for table_id, table in list(self.tables.items()):
            # Check for turn timeouts in active games
            if table.game_state and table.status == TableStatus.PLAYING:
                print(f"[BACKGROUND] Checking table {table_id} for timeouts...")
                if table.game_state.handle_turn_timeout(timeout_seconds):
                    print(f"[BACKGROUND] Turn timeout handled in table {table_id}")
                    disconnected_log.append(f"Player turn timed out in table {table_id}")
            
            # Check for disconnected players
            removed_players = table.remove_disconnected_players(timeout_seconds)
            
            for player_id in removed_players:
                # Remove from player-to-table mapping
                if player_id in self.player_to_table:
                    del self.player_to_table[player_id]
                
                # Log the disconnect
                player_name = table.players.get(player_id, {}).name if player_id in table.players else "Unknown"
                disconnected_log.append(f"Player {player_name} ({player_id}) disconnected from table {table_id}")
                
                # If game is in progress, we might need to handle this in game logic too
                if table.game_state and player_id in table.player_id_mapping:
                    game_player_id = table.player_id_mapping[player_id]
                    if game_player_id in table.game_state.players:
                        # Mark player as eliminated in the game
                        table.game_state.players[game_player_id].is_eliminated = True
                        table.game_state.add_to_game_log(f"💀 {player_name} disconnected and was eliminated")
                        
                        # Check if game should end due to no human players remaining
                        if table.game_state.is_game_over():
                            # Use the proper end_round logic to finish the game correctly
                            end_round(table.game_state, skip_life_loss=True)
                            table.status = TableStatus.FINISHED
            
            # Clean up empty tables
            if not table.players:
                del self.tables[table_id]
        
        return disconnected_log
    
    def cleanup_old_tables(self, max_age_hours: int = 24):
        """Clean up old finished tables"""
        cutoff_time = datetime.now() - timedelta(hours=max_age_hours)
        
        tables_to_remove = []
        for table_id, table in self.tables.items():
            if table.status == TableStatus.FINISHED and table.created_at < cutoff_time:
                tables_to_remove.append(table_id)
        
        for table_id in tables_to_remove:
            # Remove player mappings
            players_to_remove = [
                player_id for player_id, tid in self.player_to_table.items()
                if tid == table_id
            ]
            for player_id in players_to_remove:
                del self.player_to_table[player_id]
            
            # Remove table
            del self.tables[table_id]


# Global table manager instance
table_manager = TableManager()
