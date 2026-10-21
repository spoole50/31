"""
Centralised state store.

Holds live Python objects in process memory. Nothing is persisted, so a
redeploy or restart drops every game and table, and the service must run as a
single process (App Runner pinned to max 1 instance).

Usage
-----
    from core.store import store

    store.add_game(game_state)
    store.get_game(game_id)

    # Socket ↔ player tracking
    store.register_sid(sid, player_id)
    store.get_player_for_sid(sid)
    store.remove_sid(sid)
"""

from typing import Dict, Optional


class GameStore:
    """In-memory store for local games and socket ↔ player mappings."""

    def __init__(self):
        # Only *local* (non-table) games live here; table games are owned by
        # table_logic.table_manager and reached via table.game_state.
        self._games: Dict[str, object] = {}       # game_id -> GameState

        # Socket tracking
        self._sid_to_player: Dict[str, str] = {}  # socket sid -> player_id
        self._player_to_sid: Dict[str, str] = {}  # player_id -> socket sid

    # ------------------------------------------------------------------
    # Game CRUD
    # ------------------------------------------------------------------

    def add_game(self, game_state) -> None:
        self._games[game_state.game_id] = game_state

    def get_game(self, game_id: str) -> Optional[object]:
        return self._games.get(game_id)

    def remove_game(self, game_id: str) -> None:
        self._games.pop(game_id, None)

    def all_games(self) -> Dict[str, object]:
        return dict(self._games)

    # ------------------------------------------------------------------
    # Socket ↔ Player tracking
    # ------------------------------------------------------------------

    def register_sid(self, sid: str, player_id: str) -> None:
        # Evict any stale SID that previously belonged to this player
        old_sid = self._player_to_sid.get(player_id)
        if old_sid and old_sid != sid:
            self._sid_to_player.pop(old_sid, None)

        self._sid_to_player[sid] = player_id
        self._player_to_sid[player_id] = sid

    def get_player_for_sid(self, sid: str) -> Optional[str]:
        return self._sid_to_player.get(sid)

    def get_sid_for_player(self, player_id: str) -> Optional[str]:
        return self._player_to_sid.get(player_id)

    def remove_sid(self, sid: str) -> Optional[str]:
        """Remove a socket mapping and return the player_id it belonged to."""
        player_id = self._sid_to_player.pop(sid, None)
        if player_id and self._player_to_sid.get(player_id) == sid:
            self._player_to_sid.pop(player_id, None)
        return player_id

    # ------------------------------------------------------------------
    # Health / diagnostics
    # ------------------------------------------------------------------

    def stats(self) -> dict:
        # Tables are owned by table_manager, not this store — import locally to
        # avoid a circular import at module load.
        from table_logic import table_manager

        return {
            "games": len(self._games),
            "tables": len(table_manager.tables),
            "connected_players": len(self._sid_to_player),
        }


# Singleton — import this everywhere
store = GameStore()
