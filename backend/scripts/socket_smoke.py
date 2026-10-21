#!/usr/bin/env python3
"""
Socket.IO smoke test — exercises the real-time path a TestClient can't.

Runs a two-player online game end to end against a *running* server and asserts
the security-critical behaviours:

  1. per-player payloads hide opponents' hands
  2. game_action from a socket that doesn't own the claimed player is rejected
     (impersonation), while the real owner's identical action is accepted
  3. a player who drops mid-game can rejoin within the grace period and gets
     the running game back; a player who isn't seated can't attach at all
  4. join_table needs the seat token, so knowing a player's (public) id is
     not enough to take over their seat

Usage:
    # start the backend first, e.g. uvicorn main:app --port 8000
    python scripts/socket_smoke.py            # defaults to http://localhost:8000
    python scripts/socket_smoke.py http://host:8000

Requires:  python-socketio[asyncio_client], aiohttp
Exit code: 0 = all checks passed, 1 = a check failed.

Note: game_action takes the TABLE-level player id (p_alice), not the game-level
one (player_1); hidden hands come back as {"value": "?", "suit": "?"}.
"""
import asyncio
import json
import sys
import urllib.request

import socketio

BASE = sys.argv[1].rstrip("/") if len(sys.argv) > 1 else "http://localhost:8000"
API = BASE + "/api"

_failures: list[str] = []


def check(label: str, ok: bool) -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}")
    if not ok:
        _failures.append(label)


def call(method: str, path: str, data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["X-Player-Token"] = token
    req = urllib.request.Request(
        API + path, method=method,
        data=json.dumps(data).encode() if data else None,
        headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def hands_hidden_from(state: dict, own_game_id: str) -> bool:
    """True iff every hand except own_game_id is masked as '?'."""
    for pid, p in state["players"].items():
        hand = p.get("hand") or []
        masked = all(c.get("value") == "?" for c in hand)
        if pid == own_game_id and masked:
            return False   # my own hand should be visible
        if pid != own_game_id and not masked:
            return False   # an opponent's hand leaked
    return True


async def main() -> int:
    table = call("POST", "/tables", {
        "host_id": "p_alice", "host_name": "Alice",
        "table_name": "Smoke", "max_players": 4})
    tid, code, alice_tok = table["table_id"], table["invite_code"], table["player_token"]
    print(f"table {tid[:8]}  invite={code}")
    bob_tok = call("POST", "/tables/join", {
        "player_id": "p_bob", "player_name": "Bob", "invite_code": code})["player_token"]

    a, b = socketio.AsyncClient(), socketio.AsyncClient()
    ev = {"a": [], "b": [], "err": []}
    a.on("game_updated", lambda d: ev["a"].append(d))
    b.on("game_updated", lambda d: ev["b"].append(d))
    a.on("error", lambda d: ev["err"].append(("Alice", d)))
    b.on("error", lambda d: ev["err"].append(("Bob", d)))

    await a.connect(BASE)
    await b.connect(BASE)
    await a.emit("join_table", {"table_id": tid, "player_id": "p_alice",
                                "player_name": "Alice", "player_token": alice_tok})
    await b.emit("join_table", {"table_id": tid, "player_id": "p_bob",
                                "player_name": "Bob", "player_token": bob_tok})
    await asyncio.sleep(0.6)

    call("POST", f"/tables/{tid}/start", {"host_id": "p_alice"}, token=alice_tok)
    await asyncio.sleep(1.2)

    if not ev["a"] or not ev["b"]:
        check("both players received game_updated on start", False)
        await a.disconnect(); await b.disconnect()
        return 1
    ga, gb = ev["a"][-1], ev["b"][-1]

    print("\nper-player hand hiding:")
    check("Alice's payload hides Bob's hand", hands_hidden_from(ga, ga["your_player_id"]))
    check("Bob's payload hides Alice's hand", hands_hidden_from(gb, gb["your_player_id"]))

    # Map the game-level current player back to a table-level id + its socket.
    table_of = {ga["your_player_id"]: ("p_alice", a),
                gb["your_player_id"]: ("p_bob", b)}
    turn_game_id = ga["current_player_id"]
    owner_tid, owner_sock = table_of[turn_game_id]
    atk_tid, atk_sock = table_of[next(k for k in table_of if k != turn_game_id)]

    print("\nimpersonation guard:")
    n = len(ev["err"])
    await atk_sock.emit("game_action", {"table_id": tid, "player_id": owner_tid,
                                        "action": "draw", "from_discard": False})
    await asyncio.sleep(0.8)
    check("action claiming another player's id is rejected", len(ev["err"]) > n)

    m = len(ev["a"])
    await owner_sock.emit("game_action", {"table_id": tid, "player_id": owner_tid,
                                          "action": "draw", "from_discard": False})
    await asyncio.sleep(0.8)
    check("the real owner's identical action is accepted", len(ev["a"]) > m)

    print("\nrejoin after refresh:")
    await a.disconnect()
    await asyncio.sleep(0.5)
    # What the frontend does on reload: look up its table, then re-attach.
    seated = call("GET", "/player/p_alice/table", token=alice_tok)
    check("disconnected player is still seated during the grace period",
          seated["table_id"] == tid)
    a2 = socketio.AsyncClient()
    rejoined = []
    a2.on("game_updated", lambda d: rejoined.append(d))
    await a2.connect(BASE)
    await a2.emit("join_table", {"table_id": tid, "player_id": "p_alice",
                                 "player_name": "Alice", "player_token": alice_tok})
    await asyncio.sleep(0.8)
    check("rejoining socket receives the running game",
          bool(rejoined) and rejoined[-1]["your_player_id"] == ga["your_player_id"])
    check("rejoined payload still hides opponents' hands",
          bool(rejoined) and hands_hidden_from(rejoined[-1], ga["your_player_id"]))

    print("\nnon-member join_table:")
    c = socketio.AsyncClient()
    c_err = []
    c.on("error", lambda d: c_err.append(d))
    await c.connect(BASE)
    await c.emit("join_table", {"table_id": tid, "player_id": "p_mallory", "player_name": "M"})
    await asyncio.sleep(0.6)
    check("a player who isn't seated can't attach to the table", bool(c_err))

    print("\nseat takeover:")
    n = len(c_err)
    await c.emit("join_table", {"table_id": tid, "player_id": "p_bob", "player_name": "Bob"})
    await asyncio.sleep(0.6)
    check("join_table naming a seated id without its token is rejected", len(c_err) > n)
    n = len(c_err)
    await c.emit("join_table", {"table_id": tid, "player_id": "p_bob",
                                "player_name": "Bob", "player_token": alice_tok})
    await asyncio.sleep(0.6)
    check("another seat's token doesn't work either", len(c_err) > n)

    await a2.disconnect()
    await b.disconnect()
    await c.disconnect()
    return 1 if _failures else 0


if __name__ == "__main__":
    try:
        rc = asyncio.run(main())
    except Exception as e:  # noqa: BLE001 — smoke script, surface anything
        print(f"\nERROR: {e}")
        rc = 1
    print("\n" + ("SMOKE OK" if rc == 0 else "SMOKE FAILED"))
    sys.exit(rc)
