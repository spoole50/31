# 31 Card Game Backend

A clean, modular Flask-based REST API for the 31 card game.

## 🏗️ Architecture

The backend is organized into logical modules for maintainability and scalability:

```
backend/
├── main.py                 # Flask app factory and entry point
├── game_logic.py          # Core game rules and state management
├── requirements.txt       # Python dependencies
├── api/                   # HTTP API endpoints
│   ├── __init__.py
│   └── routes.py          # All REST API routes
├── ai/                    # AI engine and logic
│   ├── __init__.py
│   └── engine.py          # AI difficulty levels and strategy
└── utils/                 # Utility functions
    ├── __init__.py
    └── serializers.py     # Data conversion helpers
```

## 📋 Modules

### **main.py**
- Flask application factory
- CORS configuration
- Blueprint registration
- Entry point for development server

### **api/routes.py**
- All HTTP endpoints (`/api/games`, `/api/games/{id}/draw`, etc.)
- Request validation and error handling
- Game state management
- RESTful API design

### **ai/engine.py**
- Advanced AI with 4 difficulty levels (Easy, Medium, Hard, Expert)
- Strategic decision-making for drawing, discarding, knocking
- Opponent analysis and card counting
- Game state-aware strategy adjustments

### **utils/serializers.py**
- GameState to JSON conversion
- Data formatting helpers
- Response standardization

### **game_logic.py**
- Core 31 card game rules
- Player, Card, and GameState classes
- Game mechanics (drawing, discarding, knocking, scoring)
- Round management and win conditions

## 🚀 Running the Backend

```bash
cd backend
python main.py
```

The server will start on `http://localhost:8000` with hot reloading enabled for development.

## 🔌 API Endpoints

- `GET /` - Welcome message and version
- `POST /api/games` - Create new game
- `GET /api/games/{id}` - Get game state
- `POST /api/games/{id}/draw` - Draw card
- `POST /api/games/{id}/discard` - Discard card
- `POST /api/games/{id}/knock` - Knock
- `POST /api/games/{id}/ai-turn` - Process AI turn
- `GET /api/games` - List all games
- `DELETE /api/games/{id}` - Delete game

## 🤖 AI Difficulty Levels

- **Easy 😊**: Makes mistakes, conservative play
- **Medium 🤔**: Balanced strategy, considers opponents
- **Hard 😠**: Smart competitive play, suit building
- **Expert 🤖**: Advanced strategy, card counting, dynamic thresholds

## 🛠️ Development

The modular structure makes it easy to:
- Add new API endpoints in `api/routes.py`
- Enhance AI logic in `ai/engine.py`
- Extend game rules in `game_logic.py`
- Add utilities in `utils/`

## 🔄 Future Enhancements

- Database integration (replace in-memory storage)
- WebSocket support for real-time updates
- Authentication and user management
- Tournament mode and statistics
- Advanced AI machine learning integration
