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

from core.socket import sio
from core.store import store
from table_logic import table_manager, TableStatus
from game_logic import draw_card, discard_card, knock, GamePhase
from ai.engine import advanced_ai_turn
from utils.serializers import game_state_to_dict, table_to_dict


# ── Helpers shared across handlers ────────────────────────────────────────────

async def _emit_game_to_table(table, game=None) -> None:
    """Send a per-player game_updated to every connected player at this table.

    Each player receives a payload where only *their own* hand is visible.
    """
    if game is None:
        game = table.game_state
    if game is None:
        return

    for table_player_id, table_player in table.players.items():
        sid = store.get_sid_for_player(table_player_id)
        if not sid:
            continue  # player not currently connected
        game_player_id = table.get_game_player_id(table_player_id)
        payload = game_state_to_dict(game, requesting_player_id=game_player_id)
        payload["your_player_id"] = game_player_id
        await sio.emit("game_updated", payload, to=sid)


# ── Connection lifecycle ──────────────────────────────────────────────────────

@sio.on("connect")
async def on_connect(sid, environ):
    print(f"[WS] connect  sid={sid}")


@sio.on("disconnect")
async def on_disconnect(sid):
    """
    Fired immediately when a socket closes (tab closed, network drop, etc.)
    We skip the disconnected player's turn (if active) but do NOT immediately
    eliminate them.  A background task waits DISCONNECT_GRACE_SECONDS; if they
    haven't reconnected by then they are eliminated and removed from the table.
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

    # ── If game is active, skip their turn so the game doesn't freeze ─────────
    if table.game_state and table.status == TableStatus.PLAYING:
        game = table.game_state
        game_player_id = table.get_game_player_id(player_id)

        if game_player_id and game.current_player_id == game_player_id:
            game.add_to_game_log(f"⏸ {player_name} disconnected — turn skipped")
            game.handle_turn_timeout(timeout_seconds=0)
            await sio.emit(
                "turn_timeout",
                {"player_id": player_id, "player_name": player_name},
                room=table_id,
            )
            await _run_ai_turns_if_needed(table_id)

        # Broadcast updated game state (per-player, hands hidden)
        await _emit_game_to_table(table)

    # Notify room — player may reconnect within the grace period
    await sio.emit(
        "player_disconnected",
        {
            "player_id": player_id,
            "player_name": player_name,
            "new_host_id": None,
            "may_reconnect": True,
        },
        room=table_id,
    )
    await sio.leave_room(sid, table_id)

    # Schedule deferred cleanup
    asyncio.ensure_future(
        _delayed_disconnect_cleanup(player_id, table_id, player_name)
    )


async def _delayed_disconnect_cleanup(
    player_id: str, table_id: str, player_name: str
) -> None:
    """Wait for the grace period, then eliminate + remove if not reconnected."""
    await asyncio.sleep(DISCONNECT_GRACE_SECONDS)

    # If a new socket registered in the meantime, the player reconnected
    if store.get_sid_for_player(player_id):
        print(f"[GRACE] {player_name} reconnected within {DISCONNECT_GRACE_SECONDS}s")
        return

    table = table_manager.get_table(table_id)
    if not table:
        return  # table already cleaned up

    print(f"[GRACE_EXPIRED] {player_name} did not reconnect — eliminating")

    # ── Eliminate from game ───────────────────────────────────────────────────
    if table.game_state and table.status == TableStatus.PLAYING:
        game = table.game_state
        game_player_id = table.get_game_player_id(player_id)

        if game_player_id:
            gp = game.players.get(game_player_id)
            if gp and not gp.is_eliminated:
                gp.is_eliminated = True
                game.add_to_game_log(f"💀 {player_name} timed out and was eliminated")

            if game.current_player_id == game_player_id:
                game.handle_turn_timeout(timeout_seconds=0)
                await _run_ai_turns_if_needed(table_id)

            if game.is_game_over():
                from game_logic import end_round
                end_round(game, skip_life_loss=True)
                table.status = TableStatus.FINISHED

            await _emit_game_to_table(table)

    # ── Host migration & table removal ────────────────────────────────────────
    was_host = player_id in table.players and table.players[player_id].is_host
    table_manager.leave_table(player_id)

    updated_table = table_manager.get_table(table_id)
    new_host_id = None
    if updated_table and was_host:
        new_host = updated_table.get_host()
        if new_host:
            new_host_id = new_host.id
            print(f"[HOST_MIGRATION] {player_name} removed → new host: {new_host.name}")

    await sio.emit(
        "player_disconnected",
        {
            "player_id": player_id,
            "player_name": player_name,
            "new_host_id": new_host_id,
            "may_reconnect": False,
        },
        room=table_id,
    )
    if updated_table:
        await sio.emit("table_updated", table_to_dict(updated_table), room=table_id)


# ── Lobby events ──────────────────────────────────────────────────────────────

@sio.on("join_table")
async def on_join_table(sid, data):
    """Player connects to a table room (after joining via REST).
    Also serves as the reconnection path: if the player was briefly
    disconnected the grace-period task will see the new SID and keep them.
    """
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

    # Register the socket mapping (also evicts any stale SID)
    store.register_sid(sid, player_id)
    await sio.enter_room(sid, table_id)

    print(f"[WS] join_table  player={player_name}  table={table_id}")

    # Update activity so inactivity-based checks don't kick them immediately
    table.update_player_activity(player_id)

    await sio.emit("table_updated", table_to_dict(table), room=table_id)

    # If game is already running, send per-player game state (reconnect path)
    if table.game_state:
        game_player_id = table.get_game_player_id(player_id)
        payload = game_state_to_dict(table.game_state, requesting_player_id=game_player_id)
        payload["your_player_id"] = game_player_id
        await sio.emit("game_updated", payload, to=sid)


@sio.on("leave_table")
async def on_leave_table(sid, data):
    """Voluntary leave — immediately eliminate from game (no grace period)."""
    table_id = data.get("table_id")
    player_id = data.get("player_id")

    if not table_id or not player_id:
        return

    # Verify the socket belongs to this player
    if store.get_player_for_sid(sid) != player_id:
        await _error(sid, "Session mismatch")
        return

    table = table_manager.get_table(table_id)
    player = table.players.get(player_id) if table else None
    player_name = player.name if player else player_id

    # ── Eliminate from game if one is running ─────────────────────────────────
    if table and table.game_state and table.status == TableStatus.PLAYING:
        game = table.game_state
        game_player_id = table.get_game_player_id(player_id)

        if game_player_id:
            gp = game.players.get(game_player_id)
            if gp and not gp.is_eliminated:
                gp.is_eliminated = True
                game.add_to_game_log(f"💀 {player_name} left the game")

            if game.current_player_id == game_player_id:
                game.handle_turn_timeout(timeout_seconds=0)
                await _run_ai_turns_if_needed(table_id)

            if game.is_game_over():
                from game_logic import end_round
                end_round(game, skip_life_loss=True)
                table.status = TableStatus.FINISHED

            await _emit_game_to_table(table)

    # ── Host migration & removal ──────────────────────────────────────────────
    was_host = player and player.is_host
    table_manager.leave_table(player_id)
    store.remove_sid(sid)
    await sio.leave_room(sid, table_id)

    updated_table = table_manager.get_table(table_id)
    new_host_id = None
    if updated_table and was_host:
        new_host = updated_table.get_host()
        if new_host:
            new_host_id = new_host.id

    if updated_table:
        await sio.emit("table_updated", table_to_dict(updated_table), room=table_id)
    await sio.emit(
        "player_disconnected",
        {"player_id": player_id, "player_name": player_name, "new_host_id": new_host_id},
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

    # Verify the socket belongs to the claimed player (prevents impersonation)
    if store.get_player_for_sid(sid) != player_id:
        await _error(sid, "Session mismatch — reconnect and try again")
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
        await _emit_game_to_table(table)
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

    # Broadcast updated state (per-player, hands hidden)
    await _emit_game_to_table(table)

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
            await _emit_game_to_table(table)
            return

        current = game.players.get(game.current_player_id)
        if not current or not current.is_ai:
            break

        # Small delay so the frontend can animate each AI move
        await asyncio.sleep(0.9)

        success = advanced_ai_turn(game, game.current_player_id)
        await _emit_game_to_table(table)

        if not success or game.is_game_over():
            if game.is_game_over():
                table.status = TableStatus.FINISHED
            break


async def _error(sid: str, message: str) -> None:
    await sio.emit("error", {"message": message}, to=sid)
