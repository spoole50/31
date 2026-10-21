# 31 Card Game — Online Multiplayer Table System

## Overview

Real-time online multiplayer powered by Socket.IO (long-polling on App Runner, WebSockets locally). Players create or join tables, invite friends via a 6-character code, mix in AI opponents, and play together with live game-state updates.

## Features

### Table Management
- **Create tables** — customisable name, player cap (2–8), optional password
- **6-char invite codes** — share a code like `ABC123`; the app creates every
  table as private, so the code is the only way in
- **Public tables (API only)** — `is_private: false` tables are listed by
  `GET /api/tables` and joinable by id, but the UI doesn't create or browse them
- **Host controls** — only the host can start, restart, or add AI players
- **Status tracking** — waiting → ready → playing → finished

### Real-time Play
- **Socket.IO push** — the server sends state after every move (over long-polling
  in production, since App Runner has no WebSockets)
- **Per-player hand hiding** — each player sees only their own cards; opponents show `?`
- **`your_player_id` field** — server tells each client which game player they are (no name matching)
- **AI turns server-side** — AI moves execute via `asyncio.sleep` delays and are broadcast per-move
- **Disconnect grace period** — 30 seconds to reconnect before elimination
- **Voluntary leave** — immediate elimination, no grace period
- **Host migration** — if the host disconnects, the next player is promoted automatically
- **Turn timer enforcement** — expired turns are auto-skipped server-side
- **Heartbeat** — 10-second `ping` keeps the connection alive

### Game Lifecycle
- **Seamless restart** — host can restart finished games with the same lobby
- **Background cleanup** — stale tables and orphaned games are removed every 2 minutes

## How to Use

### Creating a Table
1. From the main menu → **Play Online**
2. Enter your name
3. Click **Create Table** → set a table name and max players (the table is
   always private; passwords exist in the API but not in the UI)
4. Share the invite code with friends

### Joining a Table
1. **Play Online** → enter your name
2. Paste the invite code the host shared

### Starting a Game
1. Wait for at least 2 players (human + AI count)
2. Host clicks **Start Game**
3. Game begins immediately; all clients receive `game_updated`

### Playing Again
1. After a game finishes the host sees **Play Again**
2. All players stay in the lobby for the next round

## API Endpoints

### REST (Table Management)

| Method | Path | Description |
|---|---|---|
| POST | `/api/tables` | Create a new table |
| POST | `/api/tables/join` | Join by invite code or table ID |
| GET | `/api/tables` | List public tables |
| GET | `/api/tables/{id}` | Get table info |
| POST | `/api/tables/{id}/start` | Start game (host only) |
| POST | `/api/tables/{id}/restart` | Restart finished game (host only) |
| POST | `/api/tables/{id}/add-ai` | Add AI player (host only) |
| POST | `/api/tables/{id}/leave` | Leave a table |
| GET | `/api/player/{id}/table` | Get a player's current table |

> **Seat tokens.** `POST /api/tables` and `POST /api/tables/join` return a
> `player_token` alongside the table. It is sent only to the player it seats.
> Every call that acts as a player (`start`, `restart`, `add-ai`, `leave`,
> `GET /player/{id}/table`, and joining with an id that is already seated)
> needs it in an `X-Player-Token` header, and the `join_table` socket event
> needs it as `player_token`. Player ids are visible to the whole table, so
> they identify a seat but don't prove you own it.

> Table *lobby* management is REST; the *game itself* is Socket.IO only. The old
> `GET /tables/{id}/game` and `POST /tables/{id}/game/{action}` were removed —
> neither verified the caller's identity, so the read leaked opponents' hands
> and the write let anyone move as anyone. Do not reintroduce them.

### WebSocket Events (Socket.IO)

| Direction | Event | Description |
|---|---|---|
| → server | `join_table` | Enter a table room (also reconnect path); needs `player_token` |
| → server | `leave_table` | Voluntarily leave the table |
| → server | `game_action` | `draw` / `discard` / `knock` with SID verification |
| → server | `ping` | Heartbeat (every 10 s) |
| ← client | `table_updated` | Lobby / player-list changed |
| ← client | `game_updated` | Per-player game state (hands hidden, `your_player_id` included) |
| ← client | `player_disconnected` | A player dropped; includes `may_reconnect` flag |
| ← client | `turn_timeout` | A player's turn was auto-skipped |
| ← client | `error` | Action rejected with message |

## Technical Architecture

### Backend Components
- **`table_logic.py`** — `TableManager` singleton, `GameTable` / `TablePlayer` dataclasses
- **`api/table_router.py`** — FastAPI REST endpoints for table lifecycle
- **`api/socket_handlers.py`** — All Socket.IO event handlers + `_emit_game_to_table` helper
- **`core/store.py`** — Centralised `GameStore` (game + table CRUD, SID ↔ player mapping)
- **`utils/serializers.py`** — `game_state_to_dict` with `requesting_player_id` for hand hiding

### Frontend Components
- **`pages/MainMenu.jsx`** — Game-mode selection
- **`pages/OnlineLobby.jsx`** — Create / join tables
- **`pages/TableLobby.jsx`** — Table lobby with player list, host controls
- **`pages/GameRoom.jsx`** — In-game view for online play
- **`store/gameStore.js`** — Zustand store with online slice + Socket.IO wiring

## Security

- **Seat tokens** — a per-player secret issued on create/join; required to attach a socket (`join_table`) or to act as a player over REST, so knowing someone's player id isn't enough to take their seat
- **SID verification** — `game_action` checks the socket SID matches the claimed `player_id`
- **Host validation** — only the host (with the host's seat token) can start, restart, or add AI
- **Invite codes** — random 6-character alphanumeric
- **Password protection** — optional per-table

## Configuration

| Setting | Default | Description |
|---|---|---|
| Max players per table | 8 | Configurable at creation |
| Min players to start | 2 | Human + AI combined |
| Disconnect grace period | 30 s | Before elimination |
| Heartbeat interval | 10 s | Client → server ping |
| Cleanup interval | 120 s | Stale table / game removal |
| AI difficulty levels | Easy, Medium, Hard, Expert | Set per AI player |
