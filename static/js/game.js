const socket = io();
let mySid = null;
let currentRoom = null;
let myHands = {};
let timerInterval = null;
const avatars = ['🧙', '🧝', '🧛', '🧟', '🤖', '👾', '🐲', '👹', '👺', '🤡', '🤠', '🥷'];
let myAvatar = '👤';
let oppAvatar = '👤';

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
    initPrepScreen();
    myAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    // Opponent avatar will be determined during selection/battle phase or randomized here for simplicity
    oppAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    while (oppAvatar === myAvatar) {
        oppAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    }
});

function initPrepScreen() {
    console.log("Initializing Prep Screen Squares");
    document.querySelectorAll('.stat-squares').forEach(container => {
        const max = parseInt(container.dataset.max);
        container.innerHTML = '';
        for (let i = 1; i <= max; i++) {
            const sq = document.createElement('div');
            sq.className = 'square';
            sq.dataset.index = i;
            sq.onclick = (e) => {
                e.stopPropagation();
                setStat(container, i);
            };
            container.appendChild(sq);
        }
    });
}

function setStat(container, value) {
    const squares = container.querySelectorAll('.square');
    squares.forEach((sq, i) => {
        if (i < value) sq.classList.add('filled');
        else sq.classList.remove('filled');
    });
    container.dataset.value = value;
}

function submitPrep() {
    console.log("Submitting Prep Stats");
    const getVal = (hand, type) => {
        const container = document.querySelector(`#config-${hand} .${type}-squares`);
        console.log(`Hand: ${hand}, Type: ${type}, Val: ${container.dataset.value}`);
        return parseInt(container.dataset.value || 0);
    };
    const hands = {
        rock: { atk: getVal('rock', 'atk'), def: getVal('rock', 'def') },
        scissors: { atk: getVal('scissors', 'atk'), def: getVal('scissors', 'def') },
        paper: { atk: getVal('paper', 'atk'), def: getVal('paper', 'def') }
    };
    myHands = hands;
    socket.emit('submit_prep', { room_id: currentRoom, hands: hands });
}

socket.on('start_selection', (data) => {
    showScreen('selection-screen');
    updateUI(data.players);
    startTimer();
    document.querySelectorAll('.hand-list button').forEach(b => {
        b.disabled = false;
        const hand = b.id.replace('btn-', '');
        const myData = data.players[mySid];
        b.innerText = `${{rock:'✊',scissors:'✌️',paper:'✋'}[hand]} ATK:${myData.hands[hand].atk} DEF:${myData.hands[hand].def}`;
    });
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

    // Update opponent stats display
    document.getElementById('opp-stat-rock').innerText = `✊ ATK:${oppData.hands.rock.atk} DEF:${oppData.hands.rock.def}`;
    document.getElementById('opp-stat-scissors').innerText = `✌️ ATK:${oppData.hands.scissors.atk} DEF:${oppData.hands.scissors.def}`;
    document.getElementById('opp-stat-paper').innerText = `✋ ATK:${oppData.hands.paper.atk} DEF:${oppData.hands.paper.def}`;
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

socket.on('battle_result', async (data) => {
    showScreen('battle-screen');
    const myBattle = data.p1.sid === mySid ? data.p1 : data.p2;
    const oppBattle = data.p1.sid === mySid ? data.p2 : data.p1;
    const myData = data.players[mySid];
    const oppSid = Object.keys(data.players).find(sid => sid !== mySid);
    const oppData = data.players[oppSid];

    const handIcons = { rock: '✊', scissors: '✌️', paper: '✋' };
    const log = document.getElementById('battle-log');
    const phaseText = document.getElementById('battle-phase-text');
    const board = document.getElementById('battle-result-board');
    log.innerHTML = "";
    board.classList.add('hidden');

    // Reset Battle Screen
    document.getElementById('battle-self-stats').innerText = `${myData.username || "自分"} HP:${myData.hp} COST:${myData.cost}`;
    document.getElementById('battle-opp-stats').innerText = `${oppData.username || "相手"} HP:${oppData.hp} COST:${oppData.cost}`;
    document.getElementById('battle-hand-self').innerText = "";
    document.getElementById('battle-hand-opp').innerText = "";
    document.getElementById('avatar-self').innerText = myAvatar;
    document.getElementById('avatar-opponent').innerText = oppAvatar;

    // 1. Roulette Animation (6 seconds)
    phaseText.innerText = "RPSルーレット！";
    const runRoulette = async (id, finalHand) => {
        const reel = document.querySelector(`#${id} .roulette-reel`);
        const hands = ['✊', '✌️', '✋'];
        let speed = 100;
        let elapsed = 0;
        const totalTime = 6000;

        while (elapsed < totalTime) {
            const hand = hands[Math.floor(Date.now() / speed) % 3];
            reel.innerText = hand;
            await new Promise(r => setTimeout(r, speed));
            elapsed += speed;
            if (elapsed > 3000) speed += 20; // Slow down
        }
        reel.innerText = handIcons[finalHand];
    };

    await Promise.all([
        runRoulette('roulette-self', myBattle.hand),
        runRoulette('roulette-opp', oppBattle.hand)
    ]);

    // 2. Display Hand Stats
    const myHandStats = myData.hands[myBattle.hand];
    const oppHandStats = oppData.hands[oppBattle.hand];
    document.getElementById('battle-hand-self').innerText = `ATK:${myHandStats.atk} DEF:${myHandStats.def}`;
    document.getElementById('battle-hand-opp').innerText = `ATK:${oppHandStats.atk} DEF:${oppHandStats.def}`;
    await new Promise(r => setTimeout(r, 1000));

    // 3. Result Board Show
    board.classList.remove('hidden');
    const setBoardVal = (id, val, colorClass = "") => {
        const el = document.getElementById(id);
        el.innerText = val;
        el.className = 'damage-val ' + colorClass;
    };

    let p1WinText = "DRAW", p2WinText = "DRAW";
    let p1Color = "draw-color", p2Color = "draw-color";
    if (data.result === 'p1_win') {
        p1WinText = "WIN!"; p2WinText = "LOSE...";
        p1Color = "win-color"; p2Color = "lose-color";
    } else if (data.result === 'p2_win') {
        p1WinText = "LOSE..."; p2WinText = "WIN!";
        p1Color = "lose-color"; p2Color = "win-color";
    }

    document.getElementById('board-p1-winloss').innerText = p1WinText;
    document.getElementById('board-p1-winloss').className = 'winloss-text ' + p1Color;
    document.getElementById('board-p2-winloss').innerText = p2WinText;
    document.getElementById('board-p2-winloss').className = 'winloss-text ' + p2Color;

    setBoardVal('board-p1-cost', data.p1.cost_dmg);
    setBoardVal('board-p2-cost', data.p2.cost_dmg);
    setBoardVal('board-p1-calc', data.p2.calc_dmg); // Damage received
    setBoardVal('board-p2-calc', data.p1.calc_dmg);
    setBoardVal('board-p1-win', data.p2.win_dmg);
    setBoardVal('board-p2-win', data.p1.win_dmg);

    // 4. Staged Calculation
    phaseText.innerText = "コスト計算...";
    await new Promise(r => setTimeout(r, 1000));
    if (myBattle.cost_dmg > 0 || oppBattle.cost_dmg > 0) {
        document.getElementById('battle-self-stats').innerText = `${myData.username || "自分"} HP:${myData.hp - myBattle.cost_dmg} COST:0`;
        document.getElementById('battle-opp-stats').innerText = `${oppData.username || "相手"} HP:${oppData.hp - oppBattle.cost_dmg} COST:0`;
        await new Promise(r => setTimeout(r, 1000));
    }

    phaseText.innerText = "攻撃開始！";
    const runAttackAnim = async (attackerId, effectType) => {
        const attacker = document.getElementById(attackerId);
        const layer = document.getElementById('effect-layer');
        attacker.classList.add('animate-attack'); // generic bump

        const effect = document.createElement('div');
        effect.className = effectType;
        effect.style.left = attackerId === 'char-self' ? '70%' : '20%';
        effect.style.top = '40%';
        layer.appendChild(effect);

        await new Promise(r => setTimeout(r, 500));
        attacker.classList.remove('animate-attack');
        effect.remove();
    };

    const effects = ['slash-effect', 'magic-burst'];
    if (data.result === 'p1_win') {
        await runAttackAnim('char-self', effects[Math.floor(Math.random()*effects.length)]);
    } else if (data.result === 'p2_win') {
        await runAttackAnim('char-opponent', effects[Math.floor(Math.random()*effects.length)]);
    }

    // 5. Damage Fling
    phaseText.innerText = "ダメージ精算！";
    const myTotalDmg = myBattle.cost_dmg + myBattle.calc_dmg + myBattle.win_dmg;
    const oppTotalDmg = oppBattle.cost_dmg + oppBattle.calc_dmg + oppBattle.win_dmg;

    const flingDmg = async (id, val, pClass) => {
        const el = document.getElementById(id);
        el.innerText = "-" + val;
        el.style.opacity = 1;
        el.className = 'total-damage-popup ' + pClass;
        await new Promise(r => setTimeout(r, 1000));
        el.style.opacity = 0;
    };

    await Promise.all([
        flingDmg('total-dmg-p1', myTotalDmg, 'animate-damage-p1'),
        flingDmg('total-dmg-p2', oppTotalDmg, 'animate-damage-p2')
    ]);

    // 6. Final HP Update
    phaseText.innerText = "HP更新！";
    document.getElementById('battle-self-stats').innerText = `${myData.username || "自分"} HP:${myBattle.hp_after} COST:${myBattle.cost_after}`;
    document.getElementById('battle-opp-stats').innerText = `${oppData.username || "相手"} HP:${oppBattle.hp_after} COST:${oppBattle.cost_after}`;

    await new Promise(r => setTimeout(r, 2000));
    board.classList.add('hidden');
    phaseText.innerText = "";
});

socket.on('game_over', (data) => {
    setTimeout(() => {
        showScreen('game-over-screen');
        const winnerText = data.winner === mySid ? "あなたの勝利！" : (data.winner === null ? "引き分け" : "相手の勝利...");
        document.getElementById('winner-text').innerText = winnerText;
    }, 4000);
});
