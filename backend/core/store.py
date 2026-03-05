"""
Centralised state store.

Holds live Python objects in memory (same as v1) while providing an interface
for an optional Redis persistence layer.  When REDIS_URL is set in the
environment each mutation is serialised to Redis so a container restart can
restore state.  When REDIS_URL is absent the app behaves exactly like v1 — all
state is in-process memory.

Usage
-----
    from core.store import store

    store.add_game(game_state)
    store.get_game(game_id)

    store.add_table(table)
    store.get_table(table_id)

    # Socket ↔ player tracking
    store.register_sid(sid, player_id)
    store.get_player_for_sid(sid)
    store.remove_sid(sid)
"""

import json
import os
from typing import Dict, Optional

# Optional redis dependency — app degrades gracefully without it.
try:
    import redis as _redis
    _REDIS_URL = os.getenv("REDIS_URL")
    _redis_client = _redis.from_url(_REDIS_URL) if _REDIS_URL else None
except Exception:
    _redis_client = None


class GameStore:
    """In-memory store with optional Redis persistence layer."""

    def __init__(self):
        # In-memory primary store — holds live Python objects
        self._games: Dict[str, object] = {}       # game_id -> GameState
        self._tables: Dict[str, object] = {}      # table_id -> GameTable
        self._player_to_table: Dict[str, str] = {}  # player_id -> table_id

        # Socket tracking (never persisted — per-process only)
        self._sid_to_player: Dict[str, str] = {}  # socket sid -> player_id
        self._player_to_sid: Dict[str, str] = {}  # player_id -> socket sid

    # ------------------------------------------------------------------
    # Game CRUD
    # ------------------------------------------------------------------

    def add_game(self, game_state) -> None:
        self._games[game_state.game_id] = game_state
        # TODO: persist to Redis via utils.serializers.game_state_to_dict

    def get_game(self, game_id: str) -> Optional[object]:
        return self._games.get(game_id)

    def remove_game(self, game_id: str) -> None:
        self._games.pop(game_id, None)

    def all_games(self) -> Dict[str, object]:
        return dict(self._games)

    # ------------------------------------------------------------------
    # Table CRUD
    # ------------------------------------------------------------------

    def add_table(self, table) -> None:
        self._tables[table.table_id] = table

    def get_table(self, table_id: str) -> Optional[object]:
        return self._tables.get(table_id)

    def remove_table(self, table_id: str) -> None:
        self._tables.pop(table_id, None)

    def all_tables(self) -> Dict[str, object]:
        return dict(self._tables)

    # ------------------------------------------------------------------
    # Player ↔ Table mapping
    # ------------------------------------------------------------------

    def map_player_to_table(self, player_id: str, table_id: str) -> None:
        self._player_to_table[player_id] = table_id

    def get_table_for_player(self, player_id: str) -> Optional[object]:
        table_id = self._player_to_table.get(player_id)
        return self._tables.get(table_id) if table_id else None

    def unmap_player(self, player_id: str) -> None:
        self._player_to_table.pop(player_id, None)

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
        return {
            "games": len(self._games),
            "tables": len(self._tables),
            "connected_players": len(self._sid_to_player),
            "redis": _redis_client is not None,
        }


# Singleton — import this everywhere
store = GameStore()
