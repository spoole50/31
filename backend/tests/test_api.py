"""
API-level tests for the 31 backend.

Run in-process with Starlette's TestClient — no live server needed, so this
works unchanged in CI. Tests the REST surface the frontend actually uses, plus
the security guarantees this branch introduced:

  * the two unauthenticated game endpoints stay deleted (404)
  * CORS is an allowlist, not `*`

The socket layer (game_action SID verification, per-player hand hiding) is
exercised separately by scripts/socket_smoke.py against a running server; it
needs a real ASGI transport that TestClient does not provide for Socket.IO.
"""

import pytest
from fastapi.testclient import TestClient

import main
from core.limits import create_limiter


@pytest.fixture()
def client():
    # Every TestClient request comes from the same "testclient" host, so reset
    # the per-IP create limit or later tests would trip it.
    create_limiter.reset()
    # `with` runs the lifespan, which starts (and cancels) the cleanup task.
    with TestClient(main.fastapi_app) as c:
        yield c


# ── Health ────────────────────────────────────────────────────────────────────

def test_health_reports_version_and_counts(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "healthy"
    assert body["version"] == "2.0.0"
    # These keys are what the README documents; keep them stable.
    for key in ("games", "tables", "connected_players"):
        assert key in body


# ── Local game happy path ─────────────────────────────────────────────────────

def test_local_game_full_turn(client):
    created = client.post(
        "/api/games",
        json={"player_names": ["You"], "num_ai_players": 2,
              "ai_difficulties": ["medium", "hard"]},
    )
    assert created.status_code == 200
    game = created.json()
    gid = game["game_id"]
    assert game["phase"] == "playing"
    assert set(game["players"]) == {"player_1", "ai_1", "ai_2"}
    assert len(game["players"]["player_1"]["hand"]) == 3
    assert game["deck_size"] == 42  # 52 - 3 players*3 dealt - 1 to discard

    # Draw from the deck, then discard the first card.
    drawn = client.post(f"/api/games/{gid}/draw",
                        json={"player_id": "player_1", "from_discard": False})
    assert drawn.status_code == 200
    assert len(drawn.json()["players"]["player_1"]["hand"]) == 4

    discarded = client.post(f"/api/games/{gid}/discard",
                            json={"player_id": "player_1", "card_index": 0})
    assert discarded.status_code == 200
    state = discarded.json()
    assert len(state["players"]["player_1"]["hand"]) == 3
    assert state["current_player_id"] == "ai_1"  # turn advanced

    # Drive the AI turn and confirm play moves on.
    ai = client.post(f"/api/games/{gid}/ai-turn", json={})
    assert ai.status_code == 200
    assert ai.json()["current_player_id"] != "ai_1"


def test_get_missing_game_is_404(client):
    assert client.get("/api/games/does-not-exist").status_code == 404


def test_draw_out_of_turn_is_rejected(client):
    game = client.post(
        "/api/games",
        json={"player_names": ["You"], "num_ai_players": 1,
              "ai_difficulties": ["easy"]},
    ).json()
    gid = game["game_id"]
    # ai_1 is not the starting player; acting as them must fail.
    r = client.post(f"/api/games/{gid}/draw",
                    json={"player_id": "ai_1", "from_discard": False})
    assert r.status_code == 400


# ── Table lobby (REST) ────────────────────────────────────────────────────────

def test_create_and_join_table_by_code(client):
    created = client.post(
        "/api/tables",
        json={"host_id": "p_alice", "host_name": "Alice",
              "table_name": "Test", "max_players": 4},
    )
    assert created.status_code == 201
    table = created.json()  # REST returns the table dict flattened, no wrapper
    code = table["invite_code"]
    assert len(code) == 6
    assert table["player_count"] == 1

    joined = client.post(
        "/api/tables/join",
        json={"player_id": "p_bob", "player_name": "Bob", "invite_code": code},
    )
    assert joined.status_code == 200
    assert joined.json()["player_count"] == 2


def test_join_with_bad_code_is_rejected(client):
    r = client.post(
        "/api/tables/join",
        json={"player_id": "p_x", "player_name": "X", "invite_code": "ZZZZZZ"},
    )
    # A bad/unknown code is a 400 (could be not-found, full, in-progress, or
    # wrong password — the endpoint deliberately does not distinguish, so a
    # prober can't enumerate valid codes).
    assert r.status_code == 400


# ── Security: the deleted game endpoints must stay gone ───────────────────────

def test_rest_game_read_endpoint_is_gone(client):
    """GET /tables/{id}/game leaked any player's hand to any caller."""
    r = client.get("/api/tables/anything/game", params={"player_id": "someone"})
    assert r.status_code == 404


@pytest.mark.parametrize("action", ["draw", "discard", "knock"])
def test_rest_game_action_endpoint_is_gone(client, action):
    """POST /tables/{id}/game/{action} accepted moves as any player."""
    r = client.post(f"/api/tables/anything/game/{action}", json={})
    assert r.status_code == 404


# ── Security: CORS is an allowlist, not a wildcard ────────────────────────────

def test_cors_allows_localhost(client):
    r = client.get("/api/health", headers={"Origin": "http://localhost:3000"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_blocks_unlisted_origin(client):
    r = client.get("/api/health", headers={"Origin": "https://evil.example"})
    # No ACAO header echoed back => the browser blocks the response.
    assert r.headers.get("access-control-allow-origin") is None
    assert "*" not in (r.headers.get("access-control-allow-origin") or "")


# ── Abuse limits ──────────────────────────────────────────────────────────────

LOCAL_GAME = {"player_names": ["You"], "num_ai_players": 1}


def test_create_rate_limit_returns_429(client):
    for _ in range(create_limiter.limit):
        assert client.post("/api/games", json=LOCAL_GAME).status_code == 200
    r = client.post("/api/games", json=LOCAL_GAME)
    assert r.status_code == 429
    assert r.headers.get("retry-after") == "60"
    # Tables share the same per-IP budget.
    r = client.post("/api/tables", json={"host_id": "p_rl", "host_name": "RL"})
    assert r.status_code == 429


def test_game_capacity_cap_returns_503(client, monkeypatch):
    import api.game_router as game_router
    from core.store import store

    monkeypatch.setattr(game_router, "MAX_LIVE_GAMES", len(store.all_games()))
    r = client.post("/api/games", json=LOCAL_GAME)
    assert r.status_code == 503


def test_table_capacity_cap_returns_503(client, monkeypatch):
    import api.table_router as table_router
    from table_logic import table_manager

    monkeypatch.setattr(table_router, "MAX_LIVE_TABLES", len(table_manager.tables))
    r = client.post("/api/tables", json={"host_id": "p_cap", "host_name": "Cap"})
    assert r.status_code == 503


@pytest.mark.parametrize("body", [
    {"player_names": ["Solo"], "num_ai_players": 0},              # 1 player
    {"player_names": ["A", "B"], "num_ai_players": 7},            # 9 players
])
def test_local_game_player_count_bounds(client, body):
    assert client.post("/api/games", json=body).status_code == 400


@pytest.mark.parametrize("body", [
    {"player_names": ["x" * 33], "num_ai_players": 1},            # name too long
    {"player_names": ["You"], "num_ai_players": 10_000},          # absurd AI count
    {"player_names": ["p"] * 9, "num_ai_players": 0},             # too many names
])
def test_local_game_rejects_oversized_input(client, body):
    assert client.post("/api/games", json=body).status_code == 422


def test_table_rejects_overlong_name(client):
    r = client.post("/api/tables", json={"host_id": "p_long", "host_name": "x" * 33})
    assert r.status_code == 422


# ── Private tables ────────────────────────────────────────────────────────────

def test_private_table_is_hidden_and_needs_the_code(client):
    created = client.post(
        "/api/tables",
        json={"host_id": "p_priv", "host_name": "Host", "is_private": True},
    ).json()
    tid, code = created["table_id"], created["invite_code"]

    listed = client.get("/api/tables/public").json()["tables"]
    assert tid not in {t["table_id"] for t in listed}

    by_id = client.post("/api/tables/join",
                        json={"player_id": "p_snoop", "player_name": "S", "table_id": tid})
    assert by_id.status_code == 400

    by_code = client.post("/api/tables/join",
                          json={"player_id": "p_friend", "player_name": "F", "invite_code": code})
    assert by_code.status_code == 200


# ── Seat tokens: player ids are public, so they must not be credentials ──────

def _seat_two(client, host="p_host", guest="p_guest"):
    """Create a table and seat a second player; return (table, host_tok, guest_tok)."""
    created = client.post("/api/tables", json={"host_id": host, "host_name": "Host"}).json()
    joined = client.post("/api/tables/join", json={
        "player_id": guest, "player_name": "Guest", "invite_code": created["invite_code"],
    }).json()
    return created, created["player_token"], joined["player_token"]


def _tok(token):
    return {"X-Player-Token": token}


def test_create_and_join_return_a_private_seat_token(client):
    table, host_tok, guest_tok = _seat_two(client, "p_t1", "p_t2")
    assert host_tok and guest_tok and host_tok != guest_tok
    # The shared table payload never carries anyone's token.
    public = client.get(f"/api/tables/{table['table_id']}").json()
    assert "player_token" not in public
    assert all("token" not in p for p in public["players"])


def test_host_actions_need_the_hosts_token(client):
    table, host_tok, guest_tok = _seat_two(client, "p_h1", "p_g1")
    url = f"/api/tables/{table['table_id']}/add-ai"
    body = {"host_id": "p_h1", "difficulty": "easy"}
    assert client.post(url, json=body).status_code == 403                     # no token
    assert client.post(url, json=body, headers=_tok(guest_tok)).status_code == 403  # wrong seat
    assert client.post(url, json=body, headers=_tok(host_tok)).status_code == 200

    start = f"/api/tables/{table['table_id']}/start"
    assert client.post(start, json={"host_id": "p_h1"}, headers=_tok(guest_tok)).status_code == 403
    assert client.post(start, json={"host_id": "p_h1"}, headers=_tok(host_tok)).status_code == 200


def test_cannot_kick_another_player_without_their_token(client):
    table, host_tok, guest_tok = _seat_two(client, "p_h2", "p_g2")
    url = f"/api/tables/{table['table_id']}/leave"
    r = client.post(url, json={"player_id": "p_g2"}, headers=_tok(host_tok))
    assert r.status_code == 403
    assert client.post(url, json={"player_id": "p_g2"}, headers=_tok(guest_tok)).status_code == 200


def test_cannot_join_as_a_seated_player(client):
    table, host_tok, guest_tok = _seat_two(client, "p_h3", "p_g3")
    hijack = {"player_id": "p_g3", "player_name": "Mallory", "invite_code": table["invite_code"]}
    assert client.post("/api/tables/join", json=hijack).status_code == 409
    # The real owner (holding the token) may rejoin; it re-seats them with a
    # fresh token, and the old one stops working.
    again = client.post("/api/tables/join", json=hijack, headers=_tok(guest_tok))
    assert again.status_code == 200
    new_tok = again.json()["player_token"]
    assert new_tok != guest_tok
    assert client.get("/api/player/p_g3/table", headers=_tok(guest_tok)).status_code == 403
    assert client.get("/api/player/p_g3/table", headers=_tok(new_tok)).status_code == 200


def test_player_table_lookup_needs_token(client):
    _, _, guest_tok = _seat_two(client, "p_h4", "p_g4")
    assert client.get("/api/player/p_g4/table").status_code == 403
    assert client.get("/api/player/p_g4/table", headers=_tok(guest_tok)).status_code == 200


def test_cors_preflight_allows_the_token_header(client):
    r = client.options("/api/tables/x/leave", headers={
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-player-token",
    })
    assert r.status_code == 200
    assert "x-player-token" in r.headers.get("access-control-allow-headers", "").lower()


# ── Turn timer ────────────────────────────────────────────────────────────────

def test_idle_online_turn_is_skipped_without_any_action(client):
    """The background sweep skips an expired turn on its own — the idle player
    never has to send anything for the table to move on."""
    import time
    from datetime import datetime, timedelta
    from table_logic import table_manager

    table, host_tok, _ = _seat_two(client, "p_idle1", "p_idle2")
    tid = table["table_id"]
    assert client.post(f"/api/tables/{tid}/start", json={"host_id": "p_idle1"},
                       headers=_tok(host_tok)).status_code == 200

    game = table_manager.get_table(tid).game_state
    stalled = game.current_player_id
    game.current_turn_start_time = datetime.now() - timedelta(seconds=60)

    deadline = time.monotonic() + 5
    while game.current_player_id == stalled and time.monotonic() < deadline:
        time.sleep(0.1)
    assert game.current_player_id != stalled
    assert any("timed out" in line for line in game.game_log)
