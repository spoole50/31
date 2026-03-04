# 31 Card Game

A web implementation of the classic card game 31 (also known as Scat or Blitz). Built with React and Flask, featuring local play against AI opponents and online multiplayer with a table lobby system.

Live at [31.spoole.fyi](https://31.spoole.fyi)

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
