# 31 Card Game - Online Multiplayer Table System

## Overview

The 31 Card Game now features a comprehensive online multiplayer system with a table-based lobby approach. Players can create or join tables, invite friends, and play together with a mix of human and AI players.

## New Features

### 🎮 Main Menu
- Choose between **Local Game** (immediate play with AI) or **Online Multiplayer**
- Beautiful, modern interface with game rules summary

### 🌐 Online Table System
- **Create Tables**: Host your own game table with customizable settings
- **Join Tables**: Use invite codes or browse public tables
- **Private/Public Tables**: Control who can join your games
- **Password Protection**: Optional password for extra security
- **AI Integration**: Add AI players with different difficulty levels
- **Real-time Updates**: Live updates as players join/leave

### 📋 Table Management Features
- **Table Codes**: Easy 6-character invite codes (e.g., "ABC123")
- **Player Capacity**: Support for 2-8 players per table
- **Host Controls**: Only hosts can start games and add AI players
- **Status Tracking**: See table status (waiting, ready, playing, finished)
- **Player Management**: View player list with statuses and roles

## How to Use

### Creating a Table
1. From the main menu, click "Play Online"
2. Enter your name
3. Click "Create Table"
4. Configure:
   - Table name
   - Maximum players (2-8)
   - Private/Public setting
   - Optional password
5. Share the invite code with friends

### Joining a Table
1. From the main menu, click "Play Online"
2. Enter your name
3. Either:
   - Enter an invite code to join a private table
   - Browse and join public tables

### Starting a Game
1. Wait for players to join (minimum 2 players)
2. Host can add AI players for additional challenge
3. Host clicks "Start Game" when ready
4. Game begins automatically

## API Endpoints

### Table Management
- `POST /api/tables` - Create a new table
- `POST /api/tables/join` - Join a table by code or ID
- `GET /api/tables/{id}` - Get table information
- `POST /api/tables/{id}/start` - Start the game (host only)
- `POST /api/tables/{id}/add-ai` - Add AI player (host only)
- `POST /api/tables/{id}/leave` - Leave a table
- `GET /api/tables` - List public tables

### Game Actions (Table Context)
- `POST /api/tables/{id}/game/draw` - Draw a card
- `POST /api/tables/{id}/game/discard` - Discard a card
- `POST /api/tables/{id}/game/knock` - Knock
- `POST /api/tables/{id}/game/ai-turn` - Process AI turn
- `GET /api/tables/{id}/game` - Get current game state

### Player Management
- `GET /api/player/{id}/table` - Get player's current table

## Technical Architecture

### Backend Components
- **`table_logic.py`**: Core table management system
- **`api/table_routes.py`**: REST API endpoints for tables
- **`TableManager`**: Global table state manager
- **`GameTable`**: Individual table representation
- **`TablePlayer`**: Player context within tables

### Frontend Components
- **`MainMenu.js`**: Game mode selection screen
- **`TableLobby.js`**: Table creation and joining interface
- **`TableGameBoard.js`**: Game interface for table-based games
- **Auto-refresh**: Real-time updates via polling
- **State management**: Clean separation of local vs online game states

## Game Flow

```
Main Menu → Online Lobby → Table Selection/Creation → Game Lobby → Game Playing → Results → Back to Lobby
```

## Future Enhancements

- **WebSocket Integration**: Real-time updates instead of polling
- **Spectator Mode**: Watch games in progress
- **Tournament Mode**: Bracket-style tournaments
- **Player Profiles**: Statistics and achievements
- **Chat System**: In-game messaging
- **Reconnection**: Handle network disconnections gracefully
- **Game Replays**: Review completed games

## Configuration

### Table Settings
- **Max Players**: 2-8 (configurable per table)
- **Min Players**: 2 (required to start)
- **AI Difficulties**: Easy, Medium, Hard, Expert
- **Table Cleanup**: Automatic cleanup of old finished tables

### Security Features
- **Invite Codes**: Random 6-character codes
- **Password Protection**: Optional table passwords
- **Host Validation**: Only hosts can modify table settings
- **Player Verification**: Players must be in table to perform actions

## Error Handling

The system includes comprehensive error handling for:
- Invalid table operations
- Network connectivity issues
- Player permission violations
- Game state inconsistencies
- Server errors

All errors are displayed to users with clear, actionable messages.

## Performance Considerations

- **In-Memory Storage**: Current implementation uses in-memory storage (suitable for development)
- **Polling Interval**: 2-second updates for optimal balance of responsiveness and server load
- **Cleanup System**: Automatic removal of old tables to prevent memory leaks
- **Database Ready**: Architecture prepared for database integration in production

---

The table system provides a solid foundation for online multiplayer gaming while maintaining the simplicity and fun of the original 31 card game!
