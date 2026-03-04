# Backend

Flask REST API for the 31 card game. Supports local single-player games against AI and online multiplayer via a table lobby system.

## Structure

```
backend/
├── main.py                 # Flask app factory, CORS, startup
├── game_logic.py           # Core game rules and state (local games)
├── table_logic.py          # Multiplayer table management
├── requirements.txt
├── Dockerfile
├── wsgi.py                 # Gunicorn entry point
├── api/
│   ├── routes.py           # Local game endpoints
│   └── table_routes.py     # Multiplayer table endpoints
├── ai/
│   └── engine.py           # AI strategy (4 difficulty levels)
└── utils/
    └── serializers.py      # Game state serialization
```

## Running locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Server runs on `http://localhost:8000`.

Or via Docker (from repo root):

```bash
docker compose up --build
```

## API Endpoints

### Local Game
| Method | Path | Description |
|---|---|---|
| POST | `/games/create` | Create a new game |
| GET | `/games/{id}` | Get game state |
| POST | `/games/{id}/draw` | Draw from deck or discard pile |
| POST | `/games/{id}/discard` | Discard a card |
| POST | `/games/{id}/knock` | Knock to end the round |
| POST | `/games/{id}/ai-turn` | Process AI player turn |

### Multiplayer Tables
| Method | Path | Description |
|---|---|---|
| POST | `/api/tables` | Create a table |
| GET | `/api/tables/public` | List public tables |
| POST | `/api/tables/{id}/join` | Join by table ID |
| POST | `/api/tables/join-by-code` | Join using invite code |
| POST | `/api/tables/{id}/start` | Start game (host only) |
| POST | `/api/tables/{id}/leave` | Leave table |
| POST | `/api/tables/{id}/add-ai` | Add AI player (host only) |
| GET | `/api/player/{id}/table` | Get player's current table |
| GET | `/api/health` | Health check |

## AI Difficulty Levels

| Level | Behaviour |
|---|---|
| Easy | Makes occasional mistakes, conservative |
| Medium | Balanced strategy |
| Hard | Suit-building focus, competitive thresholds |
| Expert | Card counting, dynamic knock thresholds, opponent tracking |

## Notes

- Game state is stored in-memory. Restarting the container clears all games and tables.
- A background thread runs every 5 seconds to remove disconnected players from tables (45-second timeout).
- Single Gunicorn worker is required to maintain in-memory state consistency.
