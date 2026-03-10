const socket = io();
let mySid = null;
let currentRoom = null;
let myHands = {};
let timerInterval = null;

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function createRoom() {
    const username = document.getElementById('create-username').value;
    if (!username) return alert('ユーザー名を入力してください');
    socket.emit('create_room', { username });
}

function joinRoom() {
    const username = document.getElementById('join-username').value;
    const roomId = document.getElementById('join-room-id').value;
    if (!username || !roomId) return alert('入力内容を確認してください');
    socket.emit('join_room', { username, room_id: roomId });
}

socket.on('room_created', (data) => {
    mySid = data.sid;
    currentRoom = data.room_id;
    document.getElementById('room-code-display').innerText = currentRoom;
});

socket.on('room_joined', (data) => {
    mySid = data.sid;
    currentRoom = data.room_id;
});

socket.on('game_start', (data) => {
    showScreen('prep-screen');
});

function submitPrep() {
    const hands = {
        rock: {
            atk: parseInt(document.querySelector('#config-rock .atk').value),
            def: parseInt(document.querySelector('#config-rock .def').value)
        },
        scissors: {
            atk: parseInt(document.querySelector('#config-scissors .atk').value),
            def: parseInt(document.querySelector('#config-scissors .def').value)
        },
        paper: {
            atk: parseInt(document.querySelector('#config-paper .atk').value),
            def: parseInt(document.querySelector('#config-paper .def').value)
        }
    };
    myHands = hands;
    socket.emit('submit_prep', { room_id: currentRoom, hands: hands });
}

socket.on('start_selection', (data) => {
    showScreen('selection-screen');
    updateUI(data.players);
    startTimer();
    document.querySelectorAll('.hand-list button').forEach(b => b.disabled = false);
});

function updateUI(players) {
    const myData = players[mySid];
    const oppSid = Object.keys(players).find(sid => sid !== mySid);
    if (!oppSid) return;
    const oppData = players[oppSid];

    // Update self
    document.querySelectorAll('.username').forEach((el, i) => {
        if (el.closest('#my-info') || el.closest('#char-self')) el.innerText = myData.username;
        if (el.closest('#opponent-info') || el.closest('#char-opponent')) el.innerText = oppData.username;
    });

    document.querySelector('#my-info .hp-text').innerText = `HP: ${Math.max(0, myData.hp)}/10`;
    document.querySelector('#my-info .cost-text').innerText = `残りコスト: ${myData.cost}`;
    document.querySelector('#my-info .hp-bar').style.width = (Math.max(0, myData.hp) / 10 * 100) + '%';

    // Update opponent
    document.querySelector('#opponent-info .hp-text').innerText = `HP: ${Math.max(0, oppData.hp)}/10`;
    document.querySelector('#opponent-info .cost-text').innerText = `残りコスト: ${oppData.cost}`;
    document.querySelector('#opponent-info .hp-bar').style.width = (Math.max(0, oppData.hp) / 10 * 100) + '%';
}

function startTimer() {
    let timeLeft = 15;
    document.getElementById('timer').innerText = timeLeft;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            selectHand(null); // Timeout
        }
    }, 1000);
}

function selectHand(hand) {
    clearInterval(timerInterval);
    socket.emit('select_hand', { room_id: currentRoom, hand: hand });
    // Disable buttons
    document.querySelectorAll('.hand-list button').forEach(b => b.disabled = true);
}

socket.on('battle_result', (data) => {
    showScreen('battle-screen');
    const myBattle = data.p1.sid === mySid ? data.p1 : data.p2;
    const oppBattle = data.p1.sid === mySid ? data.p2 : data.p1;

    const handIcons = { rock: '✊', scissors: '✌️', paper: '✋' };
    document.querySelector('#char-self .chosen-hand-display').innerText = handIcons[myBattle.hand];
    document.querySelector('#char-opponent .chosen-hand-display').innerText = handIcons[oppBattle.hand];

    const log = document.getElementById('battle-log');
    log.innerHTML = `お互いの手: ${handIcons[myBattle.hand]} vs ${handIcons[oppBattle.hand]}<br>`;

    // Update HP/Cost in real-time or after animation?
    // Let's update stats slightly after the animation starts

    setTimeout(() => {
        if (data.result === 'draw') {
            log.innerHTML += "引き分け！<br>";
        } else if ((data.result === 'p1_win' && data.p1.sid === mySid) || (data.result === 'p2_win' && data.p2.sid === mySid)) {
            log.innerHTML += "あなたの勝ち！<br>";
            document.getElementById('char-self').classList.add(`attack-${myBattle.hand}-self`);
        } else {
            log.innerHTML += "相手の勝ち！<br>";
            document.getElementById('char-opponent').classList.add(`attack-${oppBattle.hand}-opp`);
        }

        log.innerHTML += `コストダメージ: 自分${myBattle.cost_dmg} 相手${oppBattle.cost_dmg}<br>`;
        log.innerHTML += `計算ダメージ: 自分${myBattle.calc_dmg} 相手${oppBattle.calc_dmg}<br>`;
        log.innerHTML += `勝敗ダメージ: 自分${myBattle.win_dmg} 相手${oppBattle.win_dmg}<br>`;

        // Update stats on Battle Screen
        document.querySelector('#my-info .hp-text').innerText = `HP: ${Math.max(0, myBattle.hp_after)}/10`;
        document.querySelector('#my-info .hp-bar').style.width = (Math.max(0, myBattle.hp_after) / 10 * 100) + '%';
        document.querySelector('#opponent-info .hp-text').innerText = `HP: ${Math.max(0, oppBattle.hp_after)}/10`;
        document.querySelector('#opponent-info .hp-bar').style.width = (Math.max(0, oppBattle.hp_after) / 10 * 100) + '%';

        setTimeout(() => {
            document.getElementById('char-self').classList.remove(`attack-${myBattle.hand}-self`);
            document.getElementById('char-opponent').classList.remove(`attack-${oppBattle.hand}-opp`);

            if (myBattle.hp_after <= 0 || oppBattle.hp_after <= 0) {
                // Wait for game_over event
            } else {
                // Next round: this is handled by server re-emitting start_selection or we wait
                // For simplicity, let's assume the server sends start_selection again
            }
        }, 2000);
    }, 1000);
});

socket.on('game_over', (data) => {
    setTimeout(() => {
        showScreen('game-over-screen');
        const winnerText = data.winner === mySid ? "あなたの勝利！" : (data.winner === null ? "引き分け" : "相手の勝利...");
        document.getElementById('winner-text').innerText = winnerText;
    }, 4000);
});

// Since process_battle sets state back to SELECTING, we need a way to trigger start_selection again.
// Modifying app.py process_battle to re-emit start_selection after a delay might be better.
// Or the server can wait for a 'next_round' signal.
// Let's modify app.py to send players info with battle_result so we can update UI.
