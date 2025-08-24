import random
import uuid
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
        self.lives -= 1
        if self.lives <= 0:
            self.is_eliminated = True

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
    
    def is_game_over(self) -> bool:
        """Check if the game is over"""
        active_players = [p for p in self.players.values() if not p.is_eliminated]
        return len(active_players) <= 1 or self.phase == GamePhase.FINISHED
    
    def get_active_players(self) -> List[Player]:
        """Get list of active (non-eliminated) players"""
        return [p for p in self.players.values() if not p.is_eliminated]
    
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

def create_new_game(player_names: List[str], num_ai_players: int = 0, ai_difficulties: Optional[List[AIDifficulty]] = None) -> GameState:
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
    
    # Set first player
    if game_state.players:
        game_state.current_player_id = list(game_state.players.keys())[0]
        game_state.phase = GamePhase.PLAYING
    
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
            else:
                # No cards available to draw
                return False
        
        if game_state.deck:
            card = game_state.deck.pop()
            player.hand.append(card)
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
        
        # Check for automatic win (31 points)
        score, _ = player.calculate_best_score()
        if score == 31:
            # Everyone else loses a life
            for other_player in game_state.players.values():
                if other_player.id != player_id:
                    other_player.lose_life()
            end_round(game_state)
            return True
        
        # Move to next player
        game_state.current_player_id = game_state.get_next_player_id(player_id)
        game_state.turn_count += 1
        
        # Check if final round should end
        if game_state.phase == GamePhase.FINAL_ROUND:
            if game_state.current_player_id == game_state.knocked_player_id:
                end_round(game_state)
        
        return True
    
    return False

def knock(game_state: GameState, player_id: str) -> bool:
    """Player knocks, starting the final round"""
    if not can_player_act(game_state, player_id, PlayerAction.KNOCK):
        return False
    
    player = game_state.players[player_id]
    player.has_knocked = True
    game_state.knocked_player_id = player_id
    game_state.phase = GamePhase.FINAL_ROUND
    game_state.final_round_started = True
    
    # Move to next player for final round
    game_state.current_player_id = game_state.get_next_player_id(player_id)
    
    return True

def end_round(game_state: GameState) -> None:
    """End the current round and determine who loses lives"""
    # Calculate scores for all active players
    player_scores = {}
    for player in game_state.get_active_players():
        score, _ = player.calculate_best_score()
        player_scores[player.id] = score
    
    if not player_scores:
        return
    
    # Find the lowest score(s)
    min_score = min(player_scores.values())
    losers = [pid for pid, score in player_scores.items() if score == min_score]
    
    # Players with lowest score lose a life
    for player_id in losers:
        game_state.players[player_id].lose_life()
    
    # Check if game is over
    active_players = game_state.get_active_players()
    if len(active_players) <= 1:
        game_state.phase = GamePhase.FINISHED
        if active_players:
            game_state.winner_id = active_players[0].id
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
    
    # Reset knocked status for all players
    for player in game_state.players.values():
        player.has_knocked = False
    
    # Create new deck and deal cards
    game_state.deck = create_deck()
    shuffle_deck(game_state.deck)
    deal_initial_cards(game_state)
    
    # Set first active player
    active_players = game_state.get_active_players()
    if active_players:
        game_state.current_player_id = active_players[0].id

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
