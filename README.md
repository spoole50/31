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
- Node.js 18+ — `.nvmrc` pins 24; with [fnm](https://github.com/Schniz/fnm) or
  nvm installed, `cd` into the repo and the right version is selected for you
- Docker is **not** required (see [DEPLOYMENT.md](DEPLOYMENT.md))

### Setup (once)

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm install
```

### Run

```bash
npm run dev        # uvicorn on :8000 + Vite on :3000, together
```

Or separately:

```bash
npm run dev:backend    # uvicorn main:app --reload --port 8000
npm run dev:frontend   # vite on :3000
```

Vite proxies `/api` and `/socket.io` to `http://localhost:8000`, so no env var is
needed locally. `http://localhost:3000` is always allowed by the backend's CORS
allowlist.

### Stop servers

```bash
# Ctrl+C in the terminal, or kill the backend by port:
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
| POST | `/api/games/{id}/timeout` | Force-skip the current turn (local timer) |
| POST | `/api/games/{id}/ai-turn` | Process AI player turn |
| GET | `/api/health` | Server health + stats |

### Multiplayer Tables (`/api`)

| Method | Path | Description |
|---|---|---|
| POST | `/api/tables` | Create a table |
| GET | `/api/tables` · `/api/tables/public` | List public tables |
| GET | `/api/tables/{id}` | Get table info |
| POST | `/api/tables/join` | Join by `invite_code` **or** `table_id` |
| POST | `/api/tables/{id}/start` | Start game (host only) |
| POST | `/api/tables/{id}/restart` | Restart a finished game (host only) |
| POST | `/api/tables/{id}/leave` | Leave table |
| POST | `/api/tables/{id}/add-ai` | Add AI player (host only) |
| GET | `/api/player/{id}/table` | Get a player's current table |

> **There is deliberately no REST endpoint for reading game state or submitting
> game actions.** Both used to exist and both were unauthenticated — the read
> returned any player's hand to any caller, and the write accepted moves as any
> player. Gameplay goes exclusively through Socket.IO, which verifies the socket
> session owns the claimed player and emits per-player payloads with opponents'
> hands hidden. Clients receive state on join and after every action.

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

### Reducing cost

App Runner does **not** scale to zero — it keeps 0.5 GB provisioned at all times and
bills ~$2.50/month even with no traffic. Two ways to cut that:

1. **Move the container to a scale-to-zero host** (least effort, ~$0/month at low traffic).
   The existing `backend/Dockerfile` runs unchanged on **Google Cloud Run**
   (`--min-instances=0 --max-instances=1`) or **Fly.io** (`auto_stop_machines`).
   See [DEPLOYMENT.md](DEPLOYMENT.md#cost-estimate) for the full comparison.
2. **Make local play client-side** (bigger change, removes the backend from the hot path).
   Every local single-player action currently round-trips to `/api/games/*`, so even
   offline-style play needs the paid server running. Porting `game_logic.py` +
   `ai/engine.py` to JS would make local games run entirely in the browser (static,
   free on Amplify) and leave the backend needed **only** for online multiplayer.

---

## License

[MIT](LICENSE)
