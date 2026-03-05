# Backend

FastAPI + python-socketio REST & WebSocket API for the 31 card game. Supports local single-player games against AI and real-time online multiplayer via Socket.IO.

## Structure

```
backend/
├── main.py               # FastAPI app + Socket.IO ASGI mount + cleanup task
├── game_logic.py         # Core rules: GameState, Player, Card, round logic
├── table_logic.py        # Multiplayer table / lobby management
├── Procfile              # Heroku / App Runner entry point
├── Dockerfile
├── requirements.txt
├── core/
│   ├── socket.py         # Shared AsyncServer singleton
│   └── store.py          # Centralised GameStore (+ optional Redis)
├── api/
│   ├── game_router.py    # Local game REST endpoints  (/api/games/…)
│   ├── table_router.py   # Multiplayer table REST endpoints (/api/tables/…)
│   └── socket_handlers.py# All WebSocket event handlers
├── ai/
│   └── engine.py         # AI strategy (4 difficulty levels)
└── utils/
    └── serializers.py    # Game state ↔ dict serialisation (per-player hand hiding)
```

## Running locally

```bash
cd backend
source ../.venv/bin/activate          # or: python -m venv ../.venv && …
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Or via Docker (from repo root):

```bash
docker compose up --build
```

## API Endpoints

### Local Game

| Method | Path | Description |
|---|---|---|
| POST | `/api/games` | Create a new game |
| GET | `/api/games/{id}` | Get game state |
| POST | `/api/games/{id}/draw` | Draw from deck or discard pile |
| POST | `/api/games/{id}/discard` | Discard a card |
| POST | `/api/games/{id}/knock` | Knock to end the round |
| POST | `/api/games/{id}/ai-turn` | Process AI player turn |
| POST | `/api/games/{id}/timeout` | Force-skip the current turn |

### Multiplayer Tables

| Method | Path | Description |
|---|---|---|
| POST | `/api/tables` | Create a table |
| GET | `/api/tables/public` | List public tables |
| GET | `/api/tables/{id}` | Get table info |
| POST | `/api/tables/join` | Join by invite code or table ID |
| POST | `/api/tables/{id}/start` | Start game (host only) |
| POST | `/api/tables/{id}/restart` | Restart finished game (host only) |
| POST | `/api/tables/{id}/leave` | Leave table |
| POST | `/api/tables/{id}/add-ai` | Add AI player (host only) |
| GET | `/api/tables/{id}/game` | Get game state (player-scoped) |
| POST | `/api/tables/{id}/game/{action}` | Perform game action |
| GET | `/api/player/{id}/table` | Get player's current table |
| GET | `/api/health` | Health check + stats |

### WebSocket Events (Socket.IO)

| Direction | Event | Payload |
|---|---|---|
| → server | `join_table` | `{table_id, player_id, player_name}` |
| → server | `leave_table` | `{table_id, player_id}` |
| → server | `game_action` | `{table_id, player_id, action, ...params}` |
| → server | `ping` | `{player_id}` — heartbeat every 10 s |
| ← client | `table_updated` | Table dict |
| ← client | `game_updated` | Per-player game state (hidden hands + `your_player_id`) |
| ← client | `player_disconnected` | `{player_id, player_name, new_host_id, may_reconnect}` |
| ← client | `turn_timeout` | `{player_id, player_name}` |
| ← client | `error` | `{message}` |

## AI Difficulty Levels

| Level | Behaviour |
|---|---|
| Easy | Makes occasional mistakes, conservative |
| Medium | Balanced strategy |
| Hard | Suit-building focus, competitive thresholds |
| Expert | Card counting, dynamic knock thresholds, opponent tracking |

## Architecture Notes

- Game state is in-memory (single uvicorn worker). Set `REDIS_URL` to enable persistence for multi-worker scale-out.
- Disconnected players get a 30-second grace period before elimination; voluntary leavers are eliminated immediately.
- AI turns execute server-side via `asyncio.sleep` delays and are broadcast after each move.
- A background cleanup task removes stale tables and orphaned games every 2 minutes.
- Per-player game payloads hide opponents' hands; the `your_player_id` field identifies the requesting player.
