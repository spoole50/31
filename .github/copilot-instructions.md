<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This project is a web app for the card game "31". It uses React for the frontend and Python Flask for the backend. The app includes a graphical interface for moveable cards, score tracking, and support for up to 8 players including AI players with varying difficulty levels. The backend is prepared for future online multiplayer functionality.

31 Game Rules:
#### Objective:

The goal of the game is to have the highest total value of cards in the same suit. A perfect score is 31, which is an automatic win.

#### Card Values:

- Number cards: Face value (e.g., 2 = 2 points, 10 = 10 points).
- Face cards (Jack, Queen, King): 10 points each.
- Ace: 11 points.

#### Setup:

1. Shuffle a standard deck of 52 cards.
2. Deal 3 cards to each player.
3. Place the remaining deck in the center and flip the top card to start the discard pile.

#### Gameplay:

1. **Turn Order**:
    - The youngest player goes first, and play proceeds clockwise.
2. **Player Actions**:
    - On their turn, a player can:
        - **Draw a card**: Take the top card from the deck or the discard pile.
        - **Knock**: Indicate that they are ending the round.
    - After drawing, the player temporarily has 4 cards in hand while deciding which one to discard.
    - The player must discard one card to the discard pile before their turn ends.
3. **Knocking**:
    - A player can knock on any turn, including their first turn.
    - When a player knocks, all other players get one final turn.
    - After the final turns, all players reveal their hands.
4. **Scoring**:
    - Calculate the total value of cards in the same suit for each player.
    - The player with the lowest score loses a life.
5. **Lives**:
    - Each player starts with 3 lives.
    - If a player loses all their lives, they are eliminated.
6. **Winning**:
    - A player wins immediately if they achieve a score of 31 in the same suit.
    - The last player remaining after all others are eliminated wins the game.

#### Special Rules:

- If two or more players tie for the lowest score, they all lose a life.
- If a player gets 31 everyone else loses a life
- 3 Aces also counts as 31
