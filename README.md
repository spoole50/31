# 31 Card Game 🎴

A modern web application implementation of the classic card game "31" (also known as Scat, Blitz, or Ride the Bus). Built with React frontend and Flask backend, featuring drag-and-drop card interactions, AI players, and comprehensive game logic.

## 🎯 Game Overview

**Objective**: Get as close to 31 points as possible using cards of the same suit.

**Scoring**:
- **Ace**: 11 points
- **King, Queen, Jack**: 10 points each  
- **Number cards**: Face value (2-10)
- **Three of a kind**: 30 points (regardless of suit)
- **Ace + King/Queen/Jack of same suit**: 21 points

**Gameplay**:
- Each player starts with 3 cards
- Players take turns drawing from the deck or discard pile
- After drawing, players must discard one card
- Players can "knock" to signal the final round
- Lowest score after final round loses a life

## ✨ Features

- 🎮 **Interactive Gameplay**: Drag-and-drop card interface with smooth animations
- 🤖 **AI Players**: Smart AI opponents with strategic decision-making
- 👥 **Multiplayer Support**: Up to 8 players (human + AI combinations)
- 🎨 **Beautiful UI**: Modern card graphics with responsive design
- 📊 **Score Tracking**: Real-time score calculation and game state management
- 🔄 **Game Flow**: Complete implementation of all 31 game rules
- 🎯 **Strategic Depth**: Knock system and life management

## 🚀 Quick Start

### Prerequisites
- **Python 3.9+** (tested with Python 3.13)
- **Node.js 16+**
- **npm** or **yarn**

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/spoole50/31.git
   cd 31
   ```

2. **Set up the backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Set up the frontend**:
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

#### Start the Backend (Terminal 1):
```bash
cd backend
python main.py
```
The backend will run on `http://localhost:8000`

#### Start the Frontend (Terminal 2):
```bash
cd frontend
npm start
```
The frontend will run on `http://localhost:3000`

### Alternative: Use VS Code Tasks
If you're using VS Code, you can use the pre-configured tasks:
- `Ctrl/Cmd + Shift + P` → "Tasks: Run Task" → "Run Backend"
- `Ctrl/Cmd + Shift + P` → "Tasks: Run Task" → "Run Frontend"

## 🎮 How to Play

1. **Game Setup**: 
   - Choose number of players (2-8)
   - Select which players are human vs AI
   - Click "Create Game" to start

2. **Taking Turns**:
   - **Draw a card**: Click "Draw from Deck" or click the top card of the discard pile
   - **Discard a card**: Drag a card from your hand to the discard pile
   - **Knock**: Click "Knock" when you're confident in your hand (ends the round)

3. **Player Selection**:
   - Use the dropdown to switch between controlling different human players
   - AI players automatically take their turns

4. **Winning**:
   - Game continues until only one player has lives remaining
   - Each round, the player with the lowest score loses a life

## 🏗️ Architecture

### Backend (Flask)
- **`main.py`**: Flask API server with game endpoints
- **`game_logic.py`**: Core game engine with complete 31 rules
- **RESTful API**: Clean endpoints for game actions
- **AI Logic**: Simple but effective AI decision-making

### Frontend (React)
- **`App.js`**: Main game orchestration and state management
- **`components/`**: Modular React components
  - `GameBoard.js`: Main game layout
  - `PlayerHand.js`: Individual player's cards
  - `DiscardPile.js`: Discard pile with draw functionality
  - `GameActions.js`: Action buttons (draw, knock)
  - `Card.js`: Individual card rendering
- **React DnD**: Drag-and-drop card interactions
- **Axios**: API communication

### Project Structure
```
31/
├── backend/
│   ├── main.py              # Flask API server
│   ├── game_logic.py        # Core game rules
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.js          # Main React app
│   │   └── components/     # React components
│   ├── package.json        # Node dependencies
│   └── public/
│       └── card_images/    # Card graphics
├── .gitignore
└── README.md
```

## 🔧 API Endpoints

- `POST /games/create` - Create a new game
- `GET /games/{game_id}` - Get game state
- `POST /games/{game_id}/draw` - Draw a card
- `POST /games/{game_id}/discard` - Discard a card  
- `POST /games/{game_id}/knock` - Knock to end round
- `POST /games/{game_id}/ai-turn` - Process AI turn

## 🤖 AI Behavior

The AI players use strategic logic:
- **Drawing**: Prefer cards that improve their best suit
- **Discarding**: Keep valuable cards, discard low-value cards
- **Knocking**: Knock when they have a competitive score (18+ points)
- **Suit Focus**: Prioritize building the best possible suit combination

## 🎨 Card Graphics

High-quality PNG card images are included in `/public/card_images/PNG-cards-1.3/`. The game automatically loads the appropriate card graphics based on the game state.

## 🔮 Future Enhancements

- 🌐 **Online Multiplayer**: WebSocket-based real-time multiplayer
- 🎯 **Advanced AI**: Multiple difficulty levels and strategies
- 📱 **Mobile Optimization**: Touch-friendly interface
- 🏆 **Tournament Mode**: Multi-round tournaments
- 📈 **Statistics**: Player performance tracking
- 🎨 **Themes**: Multiple card designs and table themes
- 🔊 **Sound Effects**: Audio feedback for actions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🐛 Troubleshooting

### Common Issues:

**Cards not displaying**: 
- Ensure card images are in `/public/card_images/PNG-cards-1.3/`
- Check browser console for 404 errors

**AI players not taking turns**:
- Verify backend is running on port 8000
- Check browser console for API errors

**Drag and drop not working**:
- Ensure you're using a modern browser
- Check that React DnD is properly initialized

### Need Help?
- Check the browser console for error messages
- Verify both backend and frontend are running
- Ensure all dependencies are installed

## 🎉 Acknowledgments

- Card images from [Bicycle Cards](https://bicyclecards.com/) design inspiration
- React DnD library for smooth drag-and-drop interactions
- Flask and React communities for excellent documentation

---

**Enjoy playing 31! 🎴**
