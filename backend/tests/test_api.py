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


@pytest.fixture()
def client():
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
    for key in ("games", "tables", "connected_players", "redis"):
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
