import unittest
from logic import calculate_battle_results

class TestGameLogic(unittest.TestCase):
    def test_draw_damage(self):
        # 0: Rock, 1: Scissor, 2: Paper
        p1_hand = 0
        p2_hand = 0
        p1_stats = {'0': {'atk': 3, 'def': 2}}
        p2_stats = {'0': {'atk': 1, 'def': 1}}
        p1_cost = 10
        p2_cost = 10

        res = calculate_battle_results(p1_hand, p1_stats, p2_hand, p2_stats, p1_cost, p2_cost)

        self.assertEqual(res['winner'], 0)
        self.assertEqual(res['p1_win_dmg'], 1)
        self.assertEqual(res['p2_win_dmg'], 1)
        self.assertEqual(res['p1_total'], 1) # No cost dmg, no calc dmg, 1 win dmg
        self.assertEqual(res['p2_total'], 1)

    def test_p1_win(self):
        p1_hand = 0 # Rock
        p2_hand = 1 # Scissor
        p1_stats = {'0': {'atk': 5, 'def': 0}}
        p2_stats = {'1': {'atk': 0, 'def': 2}}
        p1_cost = 10
        p2_cost = 10

        res = calculate_battle_results(p1_hand, p1_stats, p2_hand, p2_stats, p1_cost, p2_cost)

        self.assertEqual(res['winner'], 1)
        self.assertEqual(res['p2_calc_dmg'], 3) # 5 atk - 2 def
        self.assertEqual(res['p2_win_dmg'], 2)
        self.assertEqual(res['p2_total'], 5)

    def test_cost_damage(self):
        p1_hand = 0
        p2_hand = 0
        p1_stats = {'0': {'atk': 10, 'def': 5}} # Cost 15
        p2_stats = {'0': {'atk': 0, 'def': 0}}
        p1_cost = 10
        p2_cost = 10

        res = calculate_battle_results(p1_hand, p1_stats, p2_hand, p2_stats, p1_cost, p2_cost)

        self.assertEqual(res['p1_cost_dmg'], 5)
        self.assertEqual(res['p1_win_dmg'], 1)
        self.assertEqual(res['p1_total'], 6)

if __name__ == '__main__':
    unittest.main()
