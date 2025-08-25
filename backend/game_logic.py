import random
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Card values and suits
CARD_VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
CARD_SUITS = ['hearts', 'diamonds', 'spades', 'clubs']

class GamePhase(Enum):
    WAITING = "waiting"
    PLAYING = "playing"
    FINAL_ROUND = "final_round"
    FINISHED = "finished"

class PlayerAction(Enum):
    DRAW_DECK = "draw_deck"
    DRAW_DISCARD = "draw_discard"
    DISCARD = "discard"
    KNOCK = "knock"

class AIDifficulty(Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"

@dataclass
class Card:
    value: str
    suit: str
    
    def __post_init__(self):
        if self.value not in CARD_VALUES:
            raise ValueError(f"Invalid card value: {self.value}")
        if self.suit not in CARD_SUITS:
            raise ValueError(f"Invalid card suit: {self.suit}")
    
    def get_point_value(self) -> int:
        """Get the point value of the card for scoring"""
        if self.value in ['J', 'Q', 'K']:
            return 10
        elif self.value == 'A':
            return 11
        else:
            return int(self.value)
    
    def to_dict(self) -> dict:
        return {"value": self.value, "suit": self.suit}

@dataclass
class Player:
    id: str
    name: str
    hand: List[Card] = field(default_factory=list)
    lives: int = 3
    is_ai: bool = False
    ai_difficulty: Optional[AIDifficulty] = None
    has_knocked: bool = False
    is_eliminated: bool = False
    
    def calculate_best_score(self) -> Tuple[int, str]:
        """Calculate the best possible score for this player's hand"""
        suit_totals = {}
        
        for card in self.hand:
            if card.suit not in suit_totals:
                suit_totals[card.suit] = 0
            suit_totals[card.suit] += card.get_point_value()
        
        # Check for three aces (special case = 31)
        ace_count = sum(1 for card in self.hand if card.value == 'A')
        if ace_count == 3:
            return 31, "hearts"  # Suit doesn't matter for three aces
        
        if not suit_totals:
            return 0, ""
        
        best_suit = max(suit_totals, key=suit_totals.get)
        best_score = suit_totals[best_suit]
        
        return best_score, best_suit
    
    def lose_life(self):
        """Player loses a life"""
        old_lives = self.lives
        self.lives -= 1
        print(f"[LIFE_LOSS] {self.name}: {old_lives} -> {self.lives} lives")  # Debug logging
        if self.lives <= 0:
            self.is_eliminated = True
            print(f"[ELIMINATION] {self.name} has been eliminated!")  # Debug logging

@dataclass
class GameState:
    game_id: str
    players: Dict[str, Player] = field(default_factory=dict)
    deck: List[Card] = field(default_factory=list)
    discard_pile: List[Card] = field(default_factory=list)
    current_player_id: str = ""
    phase: GamePhase = GamePhase.WAITING
    round_number: int = 1
    turn_count: int = 0
    final_round_started: bool = False
    knocked_player_id: str = ""
    winner_id: str = ""
    recent_message: str = ""  # For broadcasting game events
    game_log: List[str] = field(default_factory=list)  # Play-by-play log
    host_player_id: str = ""  # Track the original host for first round
    last_round_winner_id: str = ""  # Track who won the previous round
    current_turn_start_time: Optional[datetime] = None  # Track when current player's turn started
    
    def is_game_over(self) -> bool:
        """Check if the game is over"""
        active_players = [p for p in self.players.values() if not p.is_eliminated]
        human_players = [p for p in active_players if not p.is_ai]
        return len(active_players) <= 1 or self.phase == GamePhase.FINISHED or len(human_players) == 0
    
    def get_active_players(self) -> List[Player]:
        """Get list of active (non-eliminated) players"""
        return [p for p in self.players.values() if not p.is_eliminated]
    
    def get_active_human_players(self) -> List[Player]:
        """Get list of active human (non-AI) players"""
        return [p for p in self.players.values() if not p.is_eliminated and not p.is_ai]
    
    def get_next_player_id(self, current_id: str) -> str:
        """Get the next active player's ID"""
        active_players = self.get_active_players()
        if not active_players:
            return ""
        
        current_index = next(
            (i for i, p in enumerate(active_players) if p.id == current_id), 
            -1
        )
        
        next_index = (current_index + 1) % len(active_players)
        return active_players[next_index].id

    def set_current_player(self, player_id: str) -> None:
        """Set the current player and track turn start time"""
        self.current_player_id = player_id
        self.current_turn_start_time = datetime.now()

    def get_turn_time_remaining(self, timeout_seconds: int = 45) -> int:
        """Get remaining seconds for current player's turn"""
        if not self.current_turn_start_time:
            return timeout_seconds
        
        elapsed = (datetime.now() - self.current_turn_start_time).total_seconds()
        remaining = max(0, timeout_seconds - elapsed)
        return int(remaining)

    def check_turn_timeout(self, timeout_seconds: int = 45) -> bool:
        """Check if current player's turn has timed out"""
        return self.get_turn_time_remaining(timeout_seconds) <= 0

    def handle_turn_timeout(self, timeout_seconds: int = 45) -> bool:
        """Handle a player's turn timeout by forcing an action"""
        print(f"[TIMEOUT CHECK] Checking timeout for player {self.current_player_id}, remaining time: {self.get_turn_time_remaining(timeout_seconds)}")
        
        if not self.check_turn_timeout(timeout_seconds):
            return False
        
        current_player = self.players.get(self.current_player_id)
        if not current_player:
            print(f"[TIMEOUT] No current player found: {self.current_player_id}")
            return False
        
        # Don't timeout AI players - they should handle their own turns
        if current_player.is_ai:
            print(f"[TIMEOUT] Skipping timeout for AI player: {current_player.name}")
            return False
        
        print(f"[TIMEOUT] Processing timeout for human player: {current_player.name}")
        self.add_to_game_log(f"⏰ {current_player.name}'s turn timed out!")
        
        # Force the player to draw from deck if they haven't drawn yet
        if len(current_player.hand) == 3:
            # Player hasn't drawn yet - force draw from deck
            if self.deck:
                card = self.deck.pop()
                current_player.add_card(card)
                self.add_to_game_log(f"🃏 {current_player.name} was forced to draw from deck (timeout)")
        
        # If player has 4 cards, force discard of first card
        if len(current_player.hand) > 3:
            discarded_card = current_player.hand.pop(0)  # Remove first card
            self.discard_pile.append(discarded_card)
            self.add_to_game_log(f"🗑️ {current_player.name} was forced to discard {discarded_card.value} of {discarded_card.suit} (timeout)")
        
        # Move to next player
        self.set_current_player(self.get_next_player_id(self.current_player_id))
        return True

    # Game logging methods
    def add_to_game_log(self, message: str) -> None:
        """Add a message to the game log"""
        self.game_log.append(message)
        # Keep log to a reasonable size (last 50 entries)
        if len(self.game_log) > 50:
            self.game_log = self.game_log[-50:]

    def log_game_start(self) -> None:
        """Log the start of the game with first player info"""
        self.add_to_game_log("🎮 31 Card Game has started!")
        if self.current_player_id in self.players:
            current_player = self.players[self.current_player_id]
            if self.round_number == 1 and self.current_player_id == self.host_player_id:
                self.add_to_game_log(f"👑 {current_player.name} (host) goes first!")
            else:
                self.add_to_game_log(f"� {current_player.name} goes first!")
        
        # Log all players
        for player in self.players.values():
            if player.is_ai:
                self.add_to_game_log(f"🤖 {player.name} joined the game")
            else:
                self.add_to_game_log(f"👤 {player.name} joined the game")

    def log_card_action(self, player_name: str, action: str, card_info: str = "") -> None:
        """Log card draw/discard actions"""
        if action == "draw_deck":
            self.add_to_game_log(f"🃏 {player_name} drew a card from the deck")
        elif action == "draw_discard":
            self.add_to_game_log(f"♻️ {player_name} took {card_info} from discard pile")
        elif action == "discard":
            self.add_to_game_log(f"🗑️ {player_name} discarded {card_info}")

    def log_knock(self, player_name: str) -> None:
        """Log when a player knocks"""
        self.add_to_game_log(f"✊ {player_name} knocked! Final round begins")

    def log_instant_win(self, player_name: str, score: int) -> None:
        """Log instant win (31 points)"""
        self.add_to_game_log(f"🎉 INSTANT WIN! {player_name} got {score} points!")

    def log_round_end(self, round_results: Dict[str, any]) -> None:
        """Log round results"""
        self.add_to_game_log(f"🏁 Round {self.round_number} ended")
        for player_name, result in round_results.items():
            score = result.get('score', 0)
            lives = result.get('lives', 0)
            if result.get('eliminated', False):
                self.add_to_game_log(f"💀 {player_name} eliminated! Final score: {score}")
            else:
                self.add_to_game_log(f"📊 {player_name}: {score} points, {lives} lives")

    def log_player_elimination(self, player_name: str) -> None:
        """Log when a player is eliminated"""
        self.add_to_game_log(f"💀 {player_name} has been eliminated!")

    def log_game_end(self, winner_name: str, final_scores: Dict[str, int]) -> None:
        """Log game end with winner and final scores"""
        self.add_to_game_log(f"🏆 GAME OVER! {winner_name} wins the game!")
        for player_name, score in final_scores.items():
            self.add_to_game_log(f"📈 Final: {player_name} - {score} points")

# Game logic functions
def create_deck() -> List[Card]:
    """Create a full deck of 52 cards"""
    return [Card(value=value, suit=suit) for value in CARD_VALUES for suit in CARD_SUITS]

def shuffle_deck(deck: List[Card]) -> List[Card]:
    """Shuffle the deck in place and return it"""
    random.shuffle(deck)
    return deck

def deal_initial_cards(game_state: GameState) -> None:
    """Deal 3 cards to each player and set up discard pile"""
    if len(game_state.deck) < len(game_state.players) * 3 + 1:
        raise ValueError("Not enough cards in deck to deal")
    
    # Deal 3 cards to each player
    for player in game_state.players.values():
        player.hand = [game_state.deck.pop() for _ in range(3)]
    
    # Start discard pile with one card
    if game_state.deck:
        game_state.discard_pile = [game_state.deck.pop()]

def create_new_game(player_names: List[str], num_ai_players: int = 0, ai_difficulties: Optional[List[AIDifficulty]] = None, host_player_id: str = "") -> GameState:
    """Create a new game with the specified players"""
    game_id = str(uuid.uuid4())
    game_state = GameState(game_id=game_id)
    
    # Add human players
    for i, name in enumerate(player_names):
        player_id = f"player_{i+1}"
        game_state.players[player_id] = Player(id=player_id, name=name)
    
    # Add AI players with difficulties
    if ai_difficulties is None:
        ai_difficulties = [AIDifficulty.MEDIUM] * num_ai_players
    
    for i in range(num_ai_players):
        player_id = f"ai_{i+1}"
        difficulty = ai_difficulties[i] if i < len(ai_difficulties) else AIDifficulty.MEDIUM
        game_state.players[player_id] = Player(
            id=player_id, 
            name=f"AI Player {i+1} ({difficulty.value.title()})", 
            is_ai=True,
            ai_difficulty=difficulty
        )
    
    # Initialize deck and deal cards
    game_state.deck = create_deck()
    shuffle_deck(game_state.deck)
    deal_initial_cards(game_state)
    
    # Set host player ID for first round logic
    game_state.host_player_id = host_player_id
    
    # Set first player (host for first round, or first player if no host specified)
    if game_state.players:
        if host_player_id and host_player_id in game_state.players:
            game_state.set_current_player(host_player_id)
        else:
            game_state.set_current_player(list(game_state.players.keys())[0])
        game_state.phase = GamePhase.PLAYING
        game_state.log_game_start()
    
    return game_state

def can_player_act(game_state: GameState, player_id: str, action: PlayerAction) -> bool:
    """Check if a player can perform a specific action"""
    if game_state.phase not in [GamePhase.PLAYING, GamePhase.FINAL_ROUND]:
        return False
    
    if player_id != game_state.current_player_id:
        return False
    
    player = game_state.players.get(player_id)
    if not player or player.is_eliminated:
        return False
    
    if action in [PlayerAction.DRAW_DECK, PlayerAction.DRAW_DISCARD]:
        return len(player.hand) == 3
    elif action == PlayerAction.DISCARD:
        return len(player.hand) == 4
    elif action == PlayerAction.KNOCK:
        return len(player.hand) == 3 and not player.has_knocked
    
    return False

def draw_card(game_state: GameState, player_id: str, from_discard: bool = False) -> bool:
    """Player draws a card from deck or discard pile"""
    if not can_player_act(game_state, player_id, 
                         PlayerAction.DRAW_DISCARD if from_discard else PlayerAction.DRAW_DECK):
        return False
    
    player = game_state.players[player_id]
    
    if from_discard and game_state.discard_pile:
        card = game_state.discard_pile.pop(0)
        player.hand.append(card)
        card_info = f"{card.value} of {card.suit}"
        game_state.log_card_action(player.name, "draw_discard", card_info)
        return True
    elif not from_discard:
        # Check if deck is empty
        if not game_state.deck:
            # Reshuffle discard pile into deck (keeping top card)
            if len(game_state.discard_pile) > 1:
                top_card = game_state.discard_pile.pop(0)  # Keep top card
                cards_to_shuffle = game_state.discard_pile[:]  # Copy remaining cards
                game_state.discard_pile = [top_card]  # Reset discard pile with just top card
                
                # Shuffle and create new deck
                shuffle_deck(cards_to_shuffle)
                game_state.deck = cards_to_shuffle
                game_state.add_to_game_log("🔀 Deck reshuffled from discard pile")
            else:
                # No cards available to draw
                return False
        
        if game_state.deck:
            card = game_state.deck.pop()
            player.hand.append(card)
            game_state.log_card_action(player.name, "draw_deck")
            return True
    
    return False

def discard_card(game_state: GameState, player_id: str, card_index: int) -> bool:
    """Player discards a card and ends their turn"""
    if not can_player_act(game_state, player_id, PlayerAction.DISCARD):
        return False
    
    player = game_state.players[player_id]
    
    if 0 <= card_index < len(player.hand):
        card = player.hand.pop(card_index)
        game_state.discard_pile.insert(0, card)
        card_info = f"{card.value} of {card.suit}"
        game_state.log_card_action(player.name, "discard", card_info)
        
        # Check for automatic win (31 points)
        score, _ = player.calculate_best_score()
        if score == 31:
            score, suit = player.calculate_best_score()
            print(f"[INSTANT_WIN] {player.name} got 31 points! Everyone else loses a life")  # Debug logging
            game_state.log_instant_win(player.name, score)
            # Set message for instant win
            game_state.recent_message = f"{player.name} got 31 points! Instant win!"
            # Everyone else loses a life
            for other_player in game_state.players.values():
                if other_player.id != player_id:
                    print(f"[INSTANT_WIN_LOSS] {other_player.name} loses a life due to instant win")  # Debug logging
                    other_player.lose_life()
            end_round(game_state, skip_life_loss=True)  # Skip additional life loss
            return True
        
        # Move to next player
        game_state.set_current_player(game_state.get_next_player_id(player_id))
        game_state.turn_count += 1
        
        # Check if final round should end
        if game_state.phase == GamePhase.FINAL_ROUND:
            if game_state.current_player_id == game_state.knocked_player_id:
                end_round(game_state)
        
        return True
    
    return False

def clear_recent_message(game_state: GameState) -> None:
    """Clear the recent message after it's been displayed"""
    game_state.recent_message = ""


def knock(game_state: GameState, player_id: str) -> bool:
    """Player knocks, starting the final round"""
    if not can_player_act(game_state, player_id, PlayerAction.KNOCK):
        return False
    
    player = game_state.players[player_id]
    player.has_knocked = True
    game_state.knocked_player_id = player_id
    game_state.phase = GamePhase.FINAL_ROUND
    player = game_state.players[player_id]
    game_state.log_knock(player.name)
    game_state.final_round_started = True
    
    # Set message to broadcast the knock
    game_state.recent_message = f"{player.name} has knocked! Final round starting."
    
    # Move to next player for final round
    game_state.set_current_player(game_state.get_next_player_id(player_id))
    
    return True

def end_round(game_state: GameState, skip_life_loss: bool = False) -> None:
    """End the current round and determine who loses lives"""
    # Calculate scores for all active players
    player_scores = {}
    for player in game_state.get_active_players():
        score, _ = player.calculate_best_score()
        player_scores[player.id] = score
    
    if not player_scores:
        return
    
    # Determine round winner (highest score)
    max_score = max(player_scores.values())
    round_winners = [pid for pid, score in player_scores.items() if score == max_score]
    
    # Set the round winner for next round's starting player
    # If there's a tie, pick the first winner (could be randomized if desired)
    if round_winners:
        game_state.last_round_winner_id = round_winners[0]
    
    # Log round end with player results
    round_results = {}
    for player_id, score in player_scores.items():
        player = game_state.players[player_id]
        round_results[player.name] = {
            'score': score,
            'lives': player.lives,
            'eliminated': player.is_eliminated
        }
    game_state.log_round_end(round_results)
    
    # Only apply life loss for lowest scores if not skipping (i.e., not a 31-point win)
    if not skip_life_loss:
        # Find the lowest score(s)
        min_score = min(player_scores.values())
        losers = [pid for pid, score in player_scores.items() if score == min_score]
        
        print(f"[ROUND_END] Min score: {min_score}, Losers: {[game_state.players[pid].name for pid in losers]}")  # Debug logging
        
        # Players with lowest score lose a life
        for player_id in losers:
            player = game_state.players[player_id]
            print(f"[LIFE_LOSS] {player.name} loses a life (score: {player_scores[player_id]})")  # Debug logging
            game_state.players[player_id].lose_life()
            # Check for elimination
            if game_state.players[player_id].lives <= 0:
                game_state.players[player_id].is_eliminated = True
                player = game_state.players[player_id]
                game_state.log_player_elimination(player.name)
    else:
        print(f"[ROUND_END] Skipping life loss (instant win scenario)")  # Debug logging
    
    # Check if game is over
    active_players = game_state.get_active_players()
    active_human_players = game_state.get_active_human_players()
    
    # Game ends if only 1 or fewer active players, or no human players remain
    if len(active_players) <= 1 or len(active_human_players) == 0:
        game_state.phase = GamePhase.FINISHED
        
        # Handle different end conditions
        if len(active_human_players) == 0 and len(active_players) > 0:
            # All human players eliminated, AI wins
            game_state.add_to_game_log("🤖 All human players have been eliminated!")
            # Pick the AI with the best score as winner
            ai_scores = {}
            for player in active_players:
                if player.is_ai:
                    score, _ = player.calculate_best_score()
                    ai_scores[player.id] = score
            if ai_scores:
                best_ai_id = max(ai_scores.keys(), key=lambda x: ai_scores[x])
                game_state.winner_id = best_ai_id
                winner = game_state.players[best_ai_id]
                game_state.add_to_game_log(f"🏆 {winner.name} (AI) wins the game!")
        elif len(active_players) == 1:
            # Normal win condition - last player standing
            game_state.winner_id = active_players[0].id
            winner = game_state.players[game_state.winner_id]
            game_state.add_to_game_log(f"🏆 {winner.name} wins the game!")
        elif len(active_players) == 0:
            # Edge case - no players left
            game_state.add_to_game_log("🏁 Game ended - no players remaining")
        
        # Log final scores
        final_scores = {}
        for player in game_state.players.values():
            score, _ = player.calculate_best_score()
            final_scores[player.name] = score
        
        if game_state.winner_id:
            winner = game_state.players[game_state.winner_id]
            game_state.log_game_end(winner.name, final_scores)
        else:
            game_state.add_to_game_log("🏁 Game ended")
        return
    
    # Start new round
    start_new_round(game_state)

def start_new_round(game_state: GameState) -> None:
    """Start a new round"""
    game_state.round_number += 1
    game_state.phase = GamePhase.PLAYING
    game_state.final_round_started = False
    game_state.knocked_player_id = ""
    game_state.turn_count = 0
    game_state.recent_message = ""  # Clear any previous messages
    
    # Reset knocked status for all players
    for player in game_state.players.values():
        player.has_knocked = False
    
    # Create new deck and deal cards
    game_state.deck = create_deck()
    shuffle_deck(game_state.deck)
    deal_initial_cards(game_state)
    
    # Set first active player based on round logic
    active_players = game_state.get_active_players()
    if active_players:
        # First round: host goes first
        # Subsequent rounds: winner of previous round goes first
        if game_state.round_number == 1:
            # Host goes first in first round
            if game_state.host_player_id and game_state.host_player_id in game_state.players and not game_state.players[game_state.host_player_id].is_eliminated:
                game_state.set_current_player(game_state.host_player_id)
                host_name = game_state.players[game_state.host_player_id].name
                game_state.add_to_game_log(f"🆕 Round {game_state.round_number} begins!")
                game_state.add_to_game_log(f"👑 {host_name} (host) goes first")
            else:
                # Fallback if host is not available
                game_state.set_current_player(active_players[0].id)
                game_state.add_to_game_log(f"🆕 Round {game_state.round_number} begins!")
                game_state.add_to_game_log(f"🃏 {active_players[0].name} goes first")
        else:
            # Winner of previous round goes first
            if game_state.last_round_winner_id and game_state.last_round_winner_id in game_state.players and not game_state.players[game_state.last_round_winner_id].is_eliminated:
                game_state.set_current_player(game_state.last_round_winner_id)
                winner_name = game_state.players[game_state.last_round_winner_id].name
                game_state.add_to_game_log(f"🆕 Round {game_state.round_number} begins!")
                game_state.add_to_game_log(f"🏆 {winner_name} (previous winner) goes first")
            else:
                # Fallback if previous winner is eliminated
                game_state.set_current_player(active_players[0].id)
                game_state.add_to_game_log(f"🆕 Round {game_state.round_number} begins!")
                game_state.add_to_game_log(f"🃏 {active_players[0].name} goes first")

# Legacy functions for backward compatibility
def deal_cards(deck, num_players):
    """Legacy function - creates a simplified game state"""
    hands = {}
    deck_copy = deck.copy()
    
    for player in range(1, num_players + 1):
        hands[str(player)] = [card.to_dict() if hasattr(card, 'to_dict') else card 
                             for card in deck_copy[:3]]
        deck_copy = deck_copy[3:]
    
    remaining = [card.to_dict() if hasattr(card, 'to_dict') else card 
                for card in deck_copy]
    
    return hands, remaining

# Example usage
if __name__ == "__main__":
    # Test the new game logic
    game = create_new_game(["Alice", "Bob"], num_ai_players=2)
    print("Game created with ID:", game.game_id)
    print("Players:", [p.name for p in game.players.values()])
    print("Current player:", game.current_player_id)
    
    # Test legacy compatibility
    deck = create_deck()
    deck = shuffle_deck(deck)
    hands, remaining_deck = deal_cards(deck, 4)
    print("\nLegacy compatibility test:")
    print("Player Hands:", hands)
    print("Remaining Deck length:", len(remaining_deck))
