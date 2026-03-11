import unittest
from app import calculate_battle_result

class TestGameLogic(unittest.TestCase):
    def test_damage_calculation_win(self):
        # Winner: 10 ATK, Loser: 5 DEF. Win Damage: 2. Calc Damage: 10-5=5. Total: 7.
        # Cost damage: p1_cost=10, p1_hand={'atk':10, 'def':5} -> cost=15. Cost damage=5.
        p1 = {'hp': 10, 'cost': 10, 'hand': {'atk': 10, 'def': 5}}
        p2 = {'hp': 10, 'cost': 10, 'hand': {'atk': 0, 'def': 0}}

        # p1 wins (rock vs scissors)
        res = calculate_battle_result('rock', p1['hand'], 'scissors', p2['hand'], p1['cost'], p2['cost'])

        self.assertEqual(res['p1_damage'], 5) # Only cost damage for p1
        self.assertEqual(res['p2_damage'], 7) # 5 (calc) + 2 (win)
        self.assertEqual(res['p1_cost_damage'], 5)
        self.assertEqual(res['p2_cost_damage'], 0)

    def test_damage_calculation_draw(self):
        # Draw: 1 damage each.
        p1 = {'hp': 10, 'cost': 10, 'hand': {'atk': 5, 'def': 5}}
        p2 = {'hp': 10, 'cost': 10, 'hand': {'atk': 5, 'def': 5}}

        res = calculate_battle_result('rock', p1['hand'], 'rock', p2['hand'], p1['cost'], p2['cost'])

        self.assertEqual(res['p1_damage'], 0 + 1) # 0 cost damage + 1 draw damage
        self.assertEqual(res['p2_damage'], 0 + 1)
        self.assertEqual(res['winner'], 'draw')

    def test_cost_recovery(self):
        # Cost recovery is 5, cap at 10.
        p1_cost = 2
        p2_cost = 8
        new_p1_cost = min(10, p1_cost + 5)
        new_p2_cost = min(10, p2_cost + 5)
        self.assertEqual(new_p1_cost, 7)
        self.assertEqual(new_p2_cost, 10)

if __name__ == '__main__':
    unittest.main()
