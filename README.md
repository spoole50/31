# 31 Card Game

A mobile-first web implementation of the classic card game **31** (also known as Scat or Blitz). Build the highest same-suit hand — a score of 31 wins instantly.

Live at [31.spoole.fyi](https://31.spoole.fyi) · Built by [spoole50](https://github.com/spoole50)

---

## Game Rules

**Objective:** Get the highest total value of cards in the same suit. A score of 31 is an instant win.

**Card values:**
- Ace — 11 points
- King, Queen, Jack — 10 points each
- Number cards — face value (2–10)

**Special cases:**
- Three Aces = 31 (instant win for holder — everyone else loses a life)
- Getting 31 = instant win for the round

**Gameplay:**
1. Each player is dealt 3 cards and receives 3 lives
2. On your turn: draw from the deck or discard pile, then discard one card
3. **Knock** to trigger the final round — all other players get one last turn
4. The player with the lowest hand score loses a life
5. Ties for lowest both lose a life
6. Last player with lives remaining wins

---

## Features

- **Local game** — play against up to 7 AI opponents, no account needed
- **Pass-and-play** — multiple human players share a device with a hand-reveal handoff screen
- **AI difficulty levels** — Easy, Medium, Hard, Expert
- **Optional turn timer** — 45-second countdown per turn (toggle in setup)
- **Online multiplayer** — create or join tables with a 6-character invite code
- **Real-time via WebSocket** — Socket.IO replaces polling; instant disconnect detection
- **Card animations** — spring flip-in, draw pop, Framer Motion throughout
- **31 celebration** — suit-symbol confetti burst on instant win
- **Dark casino theme** — mobile-first Tailwind CSS, gold-on-felt design

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, Zustand 4, Framer Motion 11, React Router v6 |
| Realtime | socket.io-client 4, 10 s heartbeat, reconnect on drop |
| Backend | Python 3.11, FastAPI 0.115, python-socketio 5, uvicorn, Gunicorn |
| State | In-memory (single worker) · Redis stub ready for multi-worker scale-out |
| Hosting | AWS Amplify (frontend) · AWS App Runner (backend) |
| Container | Docker (linux/amd64), UvicornWorker |

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend

```bash
cd backend
source ../.venv/bin/activate      # or: python -m venv ../.venv && source ../.venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install                        # first time only
npm run dev                        # starts on http://localhost:3000
```

The Vite dev server proxies `/api` and `/socket.io` to `http://localhost:8000` automatically.

### Stop servers

```bash
# Frontend — Ctrl+C in that terminal

# Backend — Ctrl+C, or kill by port:
lsof -ti :8000 | xargs kill
```

### Health check

```bash
curl http://localhost:8000/api/health
# {"status":"healthy","version":"2.0.0","games":0,"tables":0,"connected_players":0,"redis":false}
```

---

## Project Structure

```
31/
├── backend/
│   ├── main.py               # FastAPI app + socketio ASGI mount
│   ├── game_logic.py         # Core rules, GameState, Player, Card
│   ├── table_logic.py        # Table / lobby management
│   ├── core/
│   │   ├── socket.py         # Shared AsyncServer singleton
│   │   └── store.py          # Centralised GameStore (+ Redis stub)
│   ├── api/
│   │   ├── game_router.py    # Local game REST endpoints
│   │   ├── table_router.py   # Multiplayer table REST endpoints
│   │   └── socket_handlers.py# All WebSocket events
│   ├── ai/
│   │   └── engine.py         # AI strategy (4 difficulty levels)
│   └── utils/
│       └── serializers.py    # Game state serialization / deserialization
├── frontend/
│   ├── index.html            # Vite root
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx          # ReactDOM entry
│       ├── App.jsx           # React Router v6 routes
│       ├── lib/socket.js     # Socket.IO singleton
│       ├── store/
│       │   └── gameStore.js  # Zustand store (local + online slices)
│       ├── pages/
│       │   ├── MainMenu.jsx
│       │   ├── LocalSetup.jsx
│       │   ├── LocalGame.jsx
│       │   ├── OnlineLobby.jsx
│       │   ├── TableLobby.jsx
│       │   └── GameRoom.jsx
│       └── components/
│           ├── GameBoard.jsx  # Main game view (pass-and-play + celebration)
│           ├── Card.jsx       # Animated playing card
│           ├── PlayerHand.jsx # Hand with draw-pop detection
│           ├── DiscardPile.jsx
│           ├── TurnTimer.jsx  # SVG ring countdown
│           ├── OpponentStrip.jsx
│           ├── GameLog.jsx
│           └── RulesModal.jsx
├── docker-compose.yml
└── amplify.yml
```

---

## API Reference

### Local Game (`/api`)

| Method | Path | Description |
|---|---|---|
| POST | `/api/games` | Create a new local game |
| GET | `/api/games/{id}` | Get game state |
| POST | `/api/games/{id}/draw` | Draw from deck or discard pile |
| POST | `/api/games/{id}/discard` | Discard a card |
| POST | `/api/games/{id}/knock` | Knock to end the round |
| POST | `/api/games/{id}/ai-turn` | Process AI player turn |
| GET | `/api/health` | Server health + stats |

### Multiplayer Tables (`/api`)

| Method | Path | Description |
|---|---|---|
| POST | `/api/tables` | Create a table |
| GET | `/api/tables/public` | List public tables |
| POST | `/api/tables/{id}/join` | Join by table ID |
| POST | `/api/tables/join-by-code` | Join using invite code |
| POST | `/api/tables/{id}/start` | Start game (host only) |
| POST | `/api/tables/{id}/leave` | Leave table |
| POST | `/api/tables/{id}/add-ai` | Add AI player (host only) |

### WebSocket Events (`/socket.io`)

| Direction | Event | Description |
|---|---|---|
| → server | `join_table` | Join a table room |
| → server | `leave_table` | Leave a table room |
| → server | `game_action` | `draw` / `discard` / `knock` |
| → server | `ping` | Heartbeat (every 10 s) |
| ← client | `table_updated` | Lobby / table state changed |
| ← client | `game_updated` | Game state after any action |
| ← client | `player_disconnected` | A player dropped |
| ← client | `turn_timeout` | Turn was auto-skipped |
| ← client | `error` | Action rejected with reason |

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full AWS guide.

**Infrastructure:**
- Frontend: AWS Amplify — auto-deploys on push to `main` (`npm run build → build/`)
- Backend: AWS App Runner (`us-east-1`) — deploys from ECR on image push
- Single Gunicorn worker with `UvicornWorker` (in-memory state; set `REDIS_URL` to enable multi-worker)

---

## License

[MIT](LICENSE)


---

## Game Rules

**Objective:** Get the highest total value of cards in the same suit. A score of 31 is an instant win.

**Card values:**
- Ace — 11 points
- King, Queen, Jack — 10 points each
- Number cards — face value (2–10)

**Special cases:**
- Three of a kind Aces = 31 (instant win)
- Three of any kind = 30 points

**Gameplay:**
1. Each player is dealt 3 cards
2. On your turn, draw from the deck or discard pile, then discard one card
3. Knock to end the round — all other players get one final turn
4. The player with the lowest hand score loses a life
5. Start with 3 lives — last player standing wins

---

## Features

- **Local game** — play against up to 7 AI opponents instantly, no account needed
- **AI difficulty levels** — Easy, Medium, Hard, and Expert
- **Online multiplayer** — create or join tables using a 6-character invite code
- **Public tables** — browse open games without a code
- **Private tables** — optional password protection
- **Dark casino theme** — gold-on-black design system

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Create React App, Axios |
| Backend | Python 3.11, Flask 2.3, Gunicorn |
| Hosting | AWS Amplify (frontend) + AWS App Runner (backend) |
| Container | Docker (linux/amd64) |

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker Desktop (optional, recommended)

### With Docker

```bash
# Backend on :8000
docker compose up --build
```

```bash
# Frontend on :3000 (separate terminal)
cd frontend
npm start
```

### Without Docker

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

```bash
# Frontend (separate terminal)
cd frontend
npm install
npm start
```

The frontend proxies API requests to `http://localhost:8000` automatically in development.

---

## Project Structure

```
31/
├── backend/
│   ├── main.py             # Flask app factory, CORS, startup
│   ├── game_logic.py       # Core game rules and state
│   ├── table_logic.py      # Multiplayer table management
│   ├── api/
│   │   ├── routes.py       # Local game API endpoints
│   │   └── table_routes.py # Multiplayer table endpoints
│   ├── ai/
│   │   └── engine.py       # AI strategy (4 difficulty levels)
│   └── utils/
│       └── serializers.py  # Game state serialization
├── frontend/
│   └── src/
│       ├── App.js
│       ├── components/     # React UI components
│       ├── hooks/          # useTableManager, useScrollDirection
│       └── styles/         # Design system + component CSS
├── backend/Dockerfile
├── docker-compose.yml
└── amplify.yml
```

---

## API Endpoints

### Local Game
| Method | Path | Description |
|---|---|---|
| POST | `/games/create` | Create a new local game |
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

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full AWS setup guide.

**Deployed infrastructure:**
- Frontend: AWS Amplify — auto-deploys on every push to `main`
- Backend: AWS App Runner (`us-east-1`) — auto-deploys on ECR image push
- Container registry: Amazon ECR

---

## License

[MIT](LICENSE)
