"""
Round-end bookkeeping: the `last_round` snapshot the frontend's round summary
reads, and who loses a life.

These drive game_logic directly with rigged hands — reaching a specific round
outcome through the REST API would depend on the shuffle.
"""

from game_logic import Card, create_new_game, discard_card, end_round, knock
from utils.serializers import game_state_to_dict


def _rig(game, hands):
    for pid, cards in hands.items():
        game.players[pid].hand = [Card(v, s) for v, s in cards]


def test_lowest_score_loses_a_life_and_round_is_snapshotted():
    game = create_new_game(["A", "B"], num_ai_players=1)
    _rig(game, {
        "player_1": [("K", "hearts"), ("Q", "hearts"), ("9", "hearts")],   # 29
        "player_2": [("2", "clubs"), ("3", "spades"), ("4", "hearts")],    # 4
        "ai_1":     [("10", "spades"), ("9", "spades"), ("2", "clubs")],   # 19
    })
    end_round(game)

    snap = game.last_round
    assert snap["round_number"] == 1
    assert snap["instant_winner_id"] is None
    # Sorted best → worst, with the hands as they were before the redeal
    assert [r["player_id"] for r in snap["results"]] == ["player_1", "ai_1", "player_2"]
    assert snap["results"][0]["hand"][0] == {"value": "K", "suit": "hearts"}
    lost = {r["player_id"]: r["lost_life"] for r in snap["results"]}
    assert lost == {"player_1": False, "ai_1": False, "player_2": True}
    assert game.players["player_2"].lives == 2
    # A new round has been dealt, and the snapshot survives it
    assert game.round_number == 2
    assert game_state_to_dict(game, "player_1")["last_round"] == snap


def test_instant_win_costs_everyone_else_a_life_but_not_the_eliminated():
    game = create_new_game(["A", "B", "C"])
    game.players["player_3"].lives = 0
    game.players["player_3"].is_eliminated = True
    game.set_current_player("player_1")
    _rig(game, {
        "player_1": [("A", "hearts"), ("K", "hearts"), ("Q", "hearts"), ("2", "clubs")],
        "player_2": [("2", "spades"), ("3", "spades"), ("4", "spades")],
    })

    assert discard_card(game, "player_1", 3)  # leaves A-K-Q of hearts = 31

    snap = game.last_round
    assert snap["instant_winner_id"] == "player_1"
    assert game.players["player_1"].lives == 3
    assert game.players["player_2"].lives == 2
    # Previously the 31 loop also hit eliminated players, taking them below 0
    assert game.players["player_3"].lives == 0
    assert "player_3" not in {r["player_id"] for r in snap["results"]}


def test_timing_out_the_last_final_round_turn_ends_the_round():
    game = create_new_game(["A", "B"])
    game.set_current_player("player_1")
    assert knock(game, "player_1")
    assert game.current_player_id == "player_2"

    # B runs out the clock on the last turn of the final round
    assert game.handle_turn_timeout(timeout_seconds=0)

    # The round is scored, not handed back to the knocker
    assert game.last_round["round_number"] == 1
    assert game.round_number == 2
