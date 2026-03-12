def calculate_battle_results(p1_hand, p1_stats, p2_hand, p2_stats, p1_cost, p2_cost):
    # Determine winner
    # 0: Rock, 1: Scissor, 2: Paper
    if p1_hand == p2_hand:
        winner = 0  # Draw
    elif (p1_hand == 0 and p2_hand == 1) or \
         (p1_hand == 1 and p2_hand == 2) or \
         (p1_hand == 2 and p2_hand == 0):
        winner = 1  # P1 wins
    else:
        winner = 2  # P2 wins

    # Cost Damage
    p1_selected_stats = p1_stats[str(p1_hand)]
    p2_selected_stats = p2_stats[str(p2_hand)]

    p1_cons = p1_selected_stats['atk'] + p1_selected_stats['def']
    p2_cons = p2_selected_stats['atk'] + p2_selected_stats['def']

    p1_cost_dmg = max(0, p1_cons - p1_cost)
    p2_cost_dmg = max(0, p2_cons - p2_cost)

    # Calc Damage & Win Damage
    p1_calc_dmg = 0
    p2_calc_dmg = 0
    p1_win_dmg = 0
    p2_win_dmg = 0

    if winner == 1: # P1 win
        p2_calc_dmg = max(0, p1_selected_stats['atk'] - p2_selected_stats['def'])
        p2_win_dmg = 2
    elif winner == 2: # P2 win
        p1_calc_dmg = max(0, p2_selected_stats['atk'] - p1_selected_stats['def'])
        p1_win_dmg = 2
    else: # Draw
        # User confirmed: "in the case of a draw, cost damage + 1 win damage is applied."
        p1_win_dmg = 1
        p2_win_dmg = 1

    p1_total = p1_cost_dmg + p1_calc_dmg + p1_win_dmg
    p2_total = p2_cost_dmg + p2_calc_dmg + p2_win_dmg

    return {
        'winner': winner,
        'p1_cost_dmg': p1_cost_dmg,
        'p1_calc_dmg': p1_calc_dmg,
        'p1_win_dmg': p1_win_dmg,
        'p1_total': p1_total,
        'p2_cost_dmg': p2_cost_dmg,
        'p2_calc_dmg': p2_calc_dmg,
        'p2_win_dmg': p2_win_dmg,
        'p2_total': p2_total,
        'p1_cons': p1_cons,
        'p2_cons': p2_cons
    }
