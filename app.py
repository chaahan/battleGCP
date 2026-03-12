import random
from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room
from logic import calculate_battle_results

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# Game data structure
# rooms = {
#     room_id: {
#         'players': {
#             sid: {
#                 'username': str,
#                 'hp': 10,
#                 'cost': 10,
#                 'hands': { 'rock': {'atk': 0, 'def': 0}, ... },
#                 'selected_hand': str,
#                 'ready_prep': bool,
#                 'ready_selection': bool
#             }
#         },
#         'state': 'WAITING' | 'PREPARING' | 'SELECTING' | 'BATTLING' | 'GAMEOVER'
#     }
# }
rooms = {}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('create_room')
def on_create_room(data):
    username = data.get('username')
    room_id = str(random.randint(1000, 9999))
    while room_id in rooms:
        room_id = str(random.randint(1000, 9999))

    rooms[room_id] = {
        'players': {
            request.sid: {
                'username': username,
                'hp': 10,
                'cost': 10,
                'hands': {},
                'selected_hand': None,
                'ready_prep': False,
                'ready_selection': False
            }
        },
        'state': 'WAITING'
    }
    join_room(room_id)
    emit('room_created', {'room_id': room_id, 'sid': request.sid})

@socketio.on('join_room')
def on_join_room(data):
    username = data.get('username')
    room_id = data.get('room_id')

    if room_id in rooms and len(rooms[room_id]['players']) < 2:
        rooms[room_id]['players'][request.sid] = {
            'username': username,
            'hp': 10,
            'cost': 10,
            'hands': {},
            'selected_hand': None,
            'ready_prep': False,
            'ready_selection': False
        }
        join_room(room_id)
        emit('room_joined', {'room_id': room_id, 'sid': request.sid})

        if len(rooms[room_id]['players']) == 2:
            rooms[room_id]['state'] = 'PREPARING'
            emit('game_start', {'state': 'PREPARING'}, room=room_id)
    else:
        emit('error', {'message': 'Room not found or full'})

@socketio.on('submit_prep')
def on_submit_prep(data):
    # data: { room_id, hands: { rock: {atk, def}, paper, scissors } }
    room_id = data.get('room_id')
    hands = data.get('hands')

    if room_id in rooms and request.sid in rooms[room_id]['players']:
        player = rooms[room_id]['players'][request.sid]
        player['hands'] = hands
        player['ready_prep'] = True

        all_ready = all(p['ready_prep'] for p in rooms[room_id]['players'].values())
        if all_ready and len(rooms[room_id]['players']) == 2:
            rooms[room_id]['state'] = 'SELECTING'
            # Reset for next phase
            for p in rooms[room_id]['players'].values():
                p['ready_selection'] = False

            # Send initial game state to start selection
            players_info = {}
            for sid, p in rooms[room_id]['players'].items():
                players_info[sid] = {
                    'username': p['username'],
                    'hp': p['hp'],
                    'cost': p['cost'],
                    'hands': p['hands']
                }
            emit('start_selection', {'players': players_info}, room=room_id)

@socketio.on('select_hand')
def on_select_hand(data):
    room_id = data.get('room_id')
    hand = data.get('hand') # 'rock', 'paper', 'scissors' or None (timeout)

    if room_id in rooms and request.sid in rooms[room_id]['players']:
        player = rooms[room_id]['players'][request.sid]

        if hand is None:
            hand = random.choice(['rock', 'paper', 'scissors'])

        player['selected_hand'] = hand
        player['ready_selection'] = True

        all_ready = all(p['ready_selection'] for p in rooms[room_id]['players'].values())
        if all_ready and len(rooms[room_id]['players']) == 2:
            process_battle(room_id)

def process_battle(room_id):
    room = rooms[room_id]
    sids = list(room['players'].keys())
    p1_sid = sids[0]
    p2_sid = sids[1]
    p1 = room['players'][p1_sid]
    p2 = room['players'][p2_sid]

    # Store initial state for UI animation
    p1_initial = {'hp': p1['hp'], 'cost': p1['cost'], 'hands': p1['hands']}
    p2_initial = {'hp': p2['hp'], 'cost': p2['cost'], 'hands': p2['hands']}

    hand_map = {'rock': 0, 'scissors': 1, 'paper': 2}
    h1_name = p1['selected_hand']
    h2_name = p2['selected_hand']

    # Convert hands to numeric for logic.py
    p1_hands_numeric = {
        '0': p1['hands']['rock'],
        '1': p1['hands']['scissors'],
        '2': p1['hands']['paper']
    }
    p2_hands_numeric = {
        '0': p2['hands']['rock'],
        '1': p2['hands']['scissors'],
        '2': p2['hands']['paper']
    }

    res = calculate_battle_results(
        hand_map[h1_name], p1_hands_numeric,
        hand_map[h2_name], p2_hands_numeric,
        p1['cost'], p2['cost']
    )

    p1['hp'] -= res['p1_total']
    p2['hp'] -= res['p2_total']

    # Apply consumption and recovery
    p1['cost'] = max(0, p1['cost'] - res['p1_cons'])
    p2['cost'] = max(0, p2['cost'] - res['p2_cons'])
    p1['cost'] = min(10, p1['cost'] + 5)
    p2['cost'] = min(10, p2['cost'] + 5)

    result_str = "draw"
    if res['winner'] == 1: result_str = "p1_win"
    elif res['winner'] == 2: result_str = "p2_win"

    battle_data = {
        'p1': {
            'sid': p1_sid,
            'hand': h1_name,
            'cost_dmg': res['p1_cost_dmg'],
            'calc_dmg': res['p1_calc_dmg'],
            'win_dmg': res['p1_win_dmg'],
            'hp_after': p1['hp'],
            'cost_after': p1['cost']
        },
        'p2': {
            'sid': p2_sid,
            'hand': h2_name,
            'cost_dmg': res['p2_cost_dmg'],
            'calc_dmg': res['p2_calc_dmg'],
            'win_dmg': res['p2_win_dmg'],
            'hp_after': p2['hp'],
            'cost_after': p2['cost']
        },
        'result': result_str,
        'players': {
            p1_sid: p1_initial,
            p2_sid: p2_initial
        }
    }

    emit('battle_result', battle_data, room=room_id)

    # Check Game Over
    if p1['hp'] <= 0 or p2['hp'] <= 0:
        rooms[room_id]['state'] = 'GAMEOVER'
        winner = None
        if p1['hp'] > p2['hp']:
            winner = p1_sid
        elif p2['hp'] > p1['hp']:
            winner = p2_sid
        emit('game_over', {'winner': winner}, room=room_id)
    else:
        rooms[room_id]['state'] = 'SELECTING'
        for p in rooms[room_id]['players'].values():
            p['ready_selection'] = False
            p['selected_hand'] = None

        # We will trigger start_selection from the client after animation or use a timer here
        # For robustness, let's use a client-side trigger or a delayed emit
        socketio.sleep(18) # Reduced from 50 to match actual animation length (~15s)
        if room_id in rooms and rooms[room_id]['state'] == 'SELECTING':
            players_info = {}
            for sid, p in rooms[room_id]['players'].items():
                players_info[sid] = {
                    'username': p['username'],
                    'hp': p['hp'],
                    'cost': p['cost'],
                    'hands': p['hands']
                }
            emit('start_selection', {'players': players_info}, room=room_id)

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    socketio.run(app, host='0.0.0.0', port=port, debug=False)
