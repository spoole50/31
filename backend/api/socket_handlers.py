"""
Socket.IO event handlers for real-time multiplayer.

Events the CLIENT sends to server:
  join_table       {table_id, player_id, player_name, invite_code?}
  leave_table      {table_id, player_id}
  game_action      {table_id, player_id, action, ...params}
       action = "draw"    + from_discard: bool
       action = "discard" + card_index: int
       action = "knock"
  ping             {player_id}   — heartbeat every 10 s

Events the SERVER sends to clients (room = table_id):
  table_updated    table_to_dict payload  — lobby/player-list changes
  game_updated     game_state_to_dict payload — any game state change
  player_disconnected  {player_id, player_name, new_host_id?}
  turn_timeout     {player_id, player_name} — a player's turn was force-skipped
  error            {message}  — sent to the individual socket only

Key improvements over v1 polling:
  * Disconnect is detected the instant the socket closes (no 65-second wait)
  * Turn timer is checked on EVERY game_action — expired turns are rejected
    and auto-skipped before the next player is allowed to act
  * Host migration is instant and broadcast to the room
  * AI turns are executed server-side and broadcast immediately after a human move
"""

import asyncio
from typing import Optional

from core.socket import sio
from core.store import store
from table_logic import table_manager, TableStatus
from game_logic import draw_card, discard_card, knock, GamePhase
from ai.engine import advanced_ai_turn
from utils.serializers import game_state_to_dict, table_to_dict


# ── Connection lifecycle ──────────────────────────────────────────────────────

@sio.on("connect")
async def on_connect(sid, environ):
    print(f"[WS] connect  sid={sid}")


@sio.on("disconnect")
async def on_disconnect(sid):
    """
    Fired immediately when a socket closes (tab closed, network drop, etc.)
    This is the real disconnect handler — no more 65-second inactivity wait.
    """
    player_id = store.remove_sid(sid)
    if not player_id:
        return

    print(f"[WS] disconnect  player={player_id}")
    table = table_manager.get_player_table(player_id)
    if not table:
        return

    table_id = table.table_id
    player = table.players.get(player_id)
    player_name = player.name if player else player_id

    # ── If game is active, handle mid-game disconnect ─────────────────────────
    if table.game_state and table.status == TableStatus.PLAYING:
        game = table.game_state
        game_player_id = table.get_game_player_id(player_id)

        if game_player_id:
            # If it was this player's turn, skip it now so the game doesn't freeze
            if game.current_player_id == game_player_id:
                game.add_to_game_log(f"⏸ {player_name} disconnected — turn skipped")
                game.handle_turn_timeout(timeout_seconds=0)  # force immediate skip
                await sio.emit(
                    "turn_timeout",
                    {"player_id": player_id, "player_name": player_name},
                    room=table_id,
                )
                # Run AI turns if the next player(s) are AI
                await _run_ai_turns_if_needed(table_id)

            # Eliminate the disconnected player from the game
            gp = game.players.get(game_player_id)
            if gp and not gp.is_eliminated:
                gp.is_eliminated = True
                game.add_to_game_log(f"💀 {player_name} disconnected and was eliminated")

            if game.is_game_over():
                from game_logic import end_round
                end_round(game, skip_life_loss=True)
                table.status = TableStatus.FINISHED

        # Broadcast updated game state to remaining players
        await sio.emit("game_updated", game_state_to_dict(game), room=table_id)

    # ── Host migration ────────────────────────────────────────────────────────
    new_host_id = None
    was_host = player and player.is_host
    table_manager.leave_table(player_id)
    store.unmap_player(player_id)

    # After leave_table() the table may have a new host (bug fixed in table_logic)
    updated_table = table_manager.get_table(table_id)
    if updated_table and was_host:
        new_host = updated_table.get_host()
        if new_host:
            new_host_id = new_host.id
            print(f"[HOST_MIGRATION] {player_name} left → new host: {new_host.name}")

    # Notify room
    await sio.emit(
        "player_disconnected",
        {
            "player_id": player_id,
            "player_name": player_name,
            "new_host_id": new_host_id,
        },
        room=table_id,
    )

    if updated_table:
        await sio.emit("table_updated", table_to_dict(updated_table), room=table_id)

    await sio.leave_room(sid, table_id)


# ── Lobby events ──────────────────────────────────────────────────────────────

@sio.on("join_table")
async def on_join_table(sid, data):
    """Player connects to a table room (after joining via REST)."""
    table_id = data.get("table_id")
    player_id = data.get("player_id")
    player_name = data.get("player_name", "")

    if not table_id or not player_id:
        await _error(sid, "table_id and player_id are required")
        return

    table = table_manager.get_table(table_id)
    if not table:
        await _error(sid, "Table not found")
        return

    # Register the socket mapping
    store.register_sid(sid, player_id)
    store.map_player_to_table(player_id, table_id)
    await sio.enter_room(sid, table_id)

    print(f"[WS] join_table  player={player_name}  table={table_id}")

    # Update activity so inactivity-based checks don't kick them immediately
    table.update_player_activity(player_id)

    await sio.emit("table_updated", table_to_dict(table), room=table_id)

    # If game is already running, send current game state to the reconnecting player
    if table.game_state:
        await sio.emit("game_updated", game_state_to_dict(table.game_state), to=sid)


@sio.on("leave_table")
async def on_leave_table(sid, data):
    table_id = data.get("table_id")
    player_id = data.get("player_id")

    if not table_id or not player_id:
        return

    table = table_manager.get_table(table_id)
    player = table.players.get(player_id) if table else None
    player_name = player.name if player else player_id

    table_manager.leave_table(player_id)
    store.unmap_player(player_id)
    store.remove_sid(sid)
    await sio.leave_room(sid, table_id)

    updated_table = table_manager.get_table(table_id)
    if updated_table:
        await sio.emit("table_updated", table_to_dict(updated_table), room=table_id)
    await sio.emit(
        "player_disconnected",
        {"player_id": player_id, "player_name": player_name, "new_host_id": None},
        room=table_id,
    )


# ── Heartbeat ─────────────────────────────────────────────────────────────────

@sio.on("ping")
async def on_ping(sid, data):
    """Lightweight heartbeat — just updates last_activity. No response needed."""
    player_id = data.get("player_id") if data else store.get_player_for_sid(sid)
    if not player_id:
        return

    table = table_manager.get_player_table(player_id)
    if table:
        table.update_player_activity(player_id)


# ── Game actions ──────────────────────────────────────────────────────────────

@sio.on("game_action")
async def on_game_action(sid, data):
    """
    Central handler for all in-game player actions.

    Expected payload:
      {
        table_id:     str,
        player_id:    str,        # table-level player ID
        action:       "draw" | "discard" | "knock",
        from_discard: bool,       # for draw
        card_index:   int,        # for discard
      }
    """
    table_id = data.get("table_id")
    player_id = data.get("player_id")
    action = data.get("action")

    if not all([table_id, player_id, action]):
        await _error(sid, "table_id, player_id and action are required")
        return

    table = table_manager.get_table(table_id)
    if not table:
        await _error(sid, "Table not found")
        return

    if not table.game_state or table.status != TableStatus.PLAYING:
        await _error(sid, "Game is not active")
        return

    if player_id not in table.players:
        await _error(sid, "You are not in this table")
        return

    table.update_player_activity(player_id)

    game = table.game_state
    game_player_id = table.get_game_player_id(player_id)

    if not game_player_id:
        await _error(sid, "Player not mapped to game")
        return

    # ── Turn timer enforcement ─────────────────────────────────────────────────
    # If this player's turn has expired, skip them automatically and notify room.
    if game.current_player_id == game_player_id and game.check_turn_timeout():
        player_name = table.players[player_id].name
        game.add_to_game_log(f"⏰ {player_name}'s turn timed out")
        game.handle_turn_timeout(timeout_seconds=0)  # force skip

        await sio.emit(
            "turn_timeout",
            {"player_id": player_id, "player_name": player_name},
            room=table_id,
        )
        await sio.emit("game_updated", game_state_to_dict(game), room=table_id)
        await _error(sid, "Your turn timed out and was skipped automatically")
        await _run_ai_turns_if_needed(table_id)
        return

    # ── Execute action ─────────────────────────────────────────────────────────
    success = False
    try:
        if action == "draw":
            success = draw_card(game, game_player_id, data.get("from_discard", False))
        elif action == "discard":
            ci = data.get("card_index")
            if ci is None:
                await _error(sid, "card_index is required for discard")
                return
            success = discard_card(game, game_player_id, ci)
        elif action == "knock":
            success = knock(game, game_player_id)
        else:
            await _error(sid, f"Unknown action: {action}")
            return
    except Exception as e:
        await _error(sid, f"Action failed: {e}")
        return

    if not success:
        await _error(sid, f"Invalid {action} — check game rules / turn order")
        return

    # ── Check for instant win (31 points) or game over ────────────────────────
    if game.is_game_over():
        table.status = TableStatus.FINISHED

    # Broadcast updated state to entire table room
    await sio.emit("game_updated", game_state_to_dict(game), room=table_id)

    # ── Chain AI turns ────────────────────────────────────────────────────────
    await _run_ai_turns_if_needed(table_id)


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _run_ai_turns_if_needed(table_id: str) -> None:
    """
    Execute all consecutive AI turns after a human action, emitting an update
    after each one so the frontend can animate them with a delay.
    """
    table = table_manager.get_table(table_id)
    if not table or not table.game_state or table.status != TableStatus.PLAYING:
        return

    game = table.game_state
    max_ai_turns = 20  # safety valve against infinite loops

    for _ in range(max_ai_turns):
        if game.is_game_over():
            table.status = TableStatus.FINISHED
            await sio.emit("game_updated", game_state_to_dict(game), room=table_id)
            return

        current = game.players.get(game.current_player_id)
        if not current or not current.is_ai:
            break

        # Small delay so the frontend can animate each AI move
        await asyncio.sleep(0.9)

        success = advanced_ai_turn(game, game.current_player_id)
        await sio.emit("game_updated", game_state_to_dict(game), room=table_id)

        if not success or game.is_game_over():
            if game.is_game_over():
                table.status = TableStatus.FINISHED
            break


async def _error(sid: str, message: str) -> None:
    await sio.emit("error", {"message": message}, to=sid)
