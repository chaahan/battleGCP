const socket = io();
let mySid = null;
let currentRoom = null;
let myHands = {};
let timerInterval = null;
const avatars = ['🧙', '🧝', '🧛', '🧟', '🤖', '👾', '🐲', '👹', '👺', '🤡', '🤠', '🥷'];
let myAvatar = '👤';

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function createRoom() {
    const username = document.getElementById('create-username').value;
    if (!username) return alert('ユーザー名を入力してください');
    myAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    socket.emit('create_room', { username, avatar: myAvatar });
}

function joinRoom() {
    const username = document.getElementById('join-username').value;
    const roomId = document.getElementById('join-room-id').value;
    if (!username || !roomId) return alert('入力内容を確認してください');
    myAvatar = avatars[Math.floor(Math.random() * avatars.length)];
    socket.emit('join_room', { username, room_id: roomId, avatar: myAvatar });
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
});

function initPrepScreen() {
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
    const getVal = (hand, type) => {
        const container = document.querySelector(`#config-${hand} .${type}-squares`);
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
    updateUI(data.players, data.host_sid);
    startTimer();
});

function updateUI(players, hostSid) {
    const p1Sid = hostSid;
    const p2Sid = Object.keys(players).find(sid => sid !== hostSid);
    const p1Data = players[p1Sid];
    const p2Data = players[p2Sid];

    // Left (P1/Host)
    const p1Info = document.getElementById('p1-info');
    p1Info.querySelector('.username').innerText = (mySid === p1Sid ? "自分 (" : "") + p1Data.username + (mySid === p1Sid ? ")" : "");
    p1Info.querySelector('.hp-text').innerText = `HP: ${Math.max(0, p1Data.hp)}/10`;
    p1Info.querySelector('.cost-text').innerText = `残りコスト: ${p1Data.cost}`;
    p1Info.querySelector('.hp-bar').style.width = (Math.max(0, p1Data.hp) / 10 * 100) + '%';

    // Right (P2/Guest)
    const p2Info = document.getElementById('p2-info');
    p2Info.querySelector('.username').innerText = (mySid === p2Sid ? "自分 (" : "") + p2Data.username + (mySid === p2Sid ? ")" : "");
    p2Info.querySelector('.hp-text').innerText = `HP: ${Math.max(0, p2Data.hp)}/10`;
    p2Info.querySelector('.cost-text').innerText = `残りコスト: ${p2Data.cost}`;
    p2Info.querySelector('.hp-bar').style.width = (Math.max(0, p2Data.hp) / 10 * 100) + '%';

    // Buttons visibility
    p1Info.querySelector('.hand-list').style.visibility = (mySid === p1Sid) ? 'visible' : 'hidden';
    p2Info.querySelector('.hand-list').style.visibility = (mySid === p2Sid) ? 'visible' : 'hidden';

    // Set button labels
    const setBtns = (container, hands) => {
        container.querySelectorAll('button').forEach(btn => {
            const hand = btn.className.replace('btn-', '');
            btn.disabled = false;
            btn.innerText = `${{rock:'✊',scissors:'✌️',paper:'✋'}[hand]} A:${hands[hand].atk} D:${hands[hand].def}`;
        });
    };
    setBtns(p1Info, p1Data.hands);
    setBtns(p2Info, p2Data.hands);
}

function startTimer() {
    let timeLeft = 30;
    document.getElementById('timer').innerText = timeLeft;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('timer').innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            selectHand(null);
        }
    }, 1000);
}

function selectHand(hand) {
    clearInterval(timerInterval);
    socket.emit('select_hand', { room_id: currentRoom, hand: hand });
    document.querySelectorAll('.hand-list button').forEach(b => b.disabled = true);
}

async function updateValueSlowly(id, start, end, label, prefix = "") {
    const el = document.getElementById(id);
    const steps = 20;
    const stepVal = (end - start) / steps;
    for (let i = 1; i <= steps; i++) {
        const current = Math.round(start + stepVal * i);
        el.innerText = `${prefix}${label} ${current}`;
        await new Promise(r => setTimeout(r, 50));
    }
    el.innerText = `${prefix}${label} ${end}`;
}

socket.on('battle_result', async (data) => {
    showScreen('battle-screen');
    const p1Sid = data.host_sid;
    const p2Sid = Object.keys(data.players).find(s => s !== p1Sid);

    const p1Battle = data.p1.sid === p1Sid ? data.p1 : data.p2;
    const p2Battle = data.p1.sid === p1Sid ? data.p2 : data.p1;
    const p1Data = data.players[p1Sid];
    const p2Data = data.players[p2Sid];

    const handIcons = { rock: '✊', scissors: '✌️', paper: '✋' };
    const phaseText = document.getElementById('battle-phase-text');
    const board = document.getElementById('battle-result-board');
    board.classList.add('hidden');

    // P1=Left, P2=Right
    document.getElementById('battle-p1-stats').innerText = `${p1Data.username} HP:${p1Data.hp} COST:${p1Data.cost}`;
    document.getElementById('battle-p2-stats').innerText = `${p2Data.username} HP:${p2Data.hp} COST:${p2Data.cost}`;
    document.getElementById('battle-hand-p1').innerText = "";
    document.getElementById('battle-hand-p2').innerText = "";
    document.getElementById('avatar-p1').innerText = p1Data.avatar;
    document.getElementById('avatar-p2').innerText = p2Data.avatar;
    document.querySelector('#char-p1 .username').innerText = p1Data.username;
    document.querySelector('#char-p2 .username').innerText = p2Data.username;
    document.querySelectorAll('.stamp').forEach(s => { s.className = 'stamp'; s.innerText = ''; });

    const setMiniStats = (id, hands) => {
        const el = document.getElementById(id);
        el.innerHTML = `
            <div class="mini-stat">✊ A:${hands.rock.atk} D:${hands.rock.def}</div>
            <div class="mini-stat">✌️ A:${hands.scissors.atk} D:${hands.scissors.def}</div>
            <div class="mini-stat">✋ A:${hands.paper.atk} D:${hands.paper.def}</div>
        `;
    };
    setMiniStats('const-stats-p1', p1Data.hands);
    setMiniStats('const-stats-p2', p2Data.hands);

    document.getElementById('cut-in-layer').innerHTML = '';
    document.getElementById('flash-layer').classList.remove('animate-flash');
    document.getElementById('ko-layer').classList.remove('animate-ko');

    phaseText.innerText = "RPSルーレット！";
    const runRoulette = async (id, finalHand) => {
        const reel = document.querySelector(`#${id} .roulette-reel`);
        const hands = ['✊', '✌️', '✋'];
        let speed = 100;
        let elapsed = 0;
        while (elapsed < 6000) {
            reel.innerText = hands[Math.floor(Date.now() / speed) % 3];
            await new Promise(r => setTimeout(r, speed));
            elapsed += speed;
            if (elapsed > 3000) speed += 20;
        }
        reel.innerText = handIcons[finalHand];
    };

    await Promise.all([runRoulette('roulette-p1', p1Battle.hand), runRoulette('roulette-p2', p2Battle.hand)]);
    phaseText.innerText = "激突！！";
    await runClash();

    document.getElementById('battle-hand-p1').innerText = `ATK:${p1Data.hands[p1Battle.hand].atk} DEF:${p1Data.hands[p1Battle.hand].def}`;
    document.getElementById('battle-hand-p2').innerText = `ATK:${p2Data.hands[p2Battle.hand].atk} DEF:${p2Data.hands[p2Battle.hand].def}`;
    await new Promise(r => setTimeout(r, 1000));

    board.classList.remove('hidden');
    const setBoardVal = (id, val, colorClass = "") => {
        const el = document.getElementById(id);
        el.innerText = val;
        el.className = 'damage-val ' + colorClass;
    };

    const p1ResText = (data.result === 'p1_win') ? "WIN!" : (data.result === 'p2_win' ? "LOSE..." : "DRAW");
    const p2ResText = (data.result === 'p2_win') ? "WIN!" : (data.result === 'p1_win' ? "LOSE..." : "DRAW");
    const p1Color = (data.result === 'p1_win') ? "win-color" : (data.result === 'p2_win' ? "lose-color" : "draw-color");
    const p2Color = (data.result === 'p2_win') ? "win-color" : (data.result === 'p1_win' ? "lose-color" : "draw-color");

    document.getElementById('board-p1-winloss').innerText = p1ResText;
    document.getElementById('board-p1-winloss').className = 'winloss-text ' + p1Color;
    document.getElementById('board-p2-winloss').innerText = p2ResText;
    document.getElementById('board-p2-winloss').className = 'winloss-text ' + p2Color;

    setBoardVal('board-p1-cost', p1Battle.cost_dmg);
    setBoardVal('board-p2-cost', p2Battle.cost_dmg);
    setBoardVal('board-p1-calc', p1Battle.calc_dmg);
    setBoardVal('board-p2-calc', p2Battle.calc_dmg);
    setBoardVal('board-p1-win', p1Battle.win_dmg);
    setBoardVal('board-p2-win', p2Battle.win_dmg);

    phaseText.innerText = "コスト計算...";
    await new Promise(r => setTimeout(r, 1000));
    const p1C = p1Data.hands[p1Battle.hand].atk + p1Data.hands[p1Battle.hand].def;
    const p2C = p2Data.hands[p2Battle.hand].atk + p2Data.hands[p2Battle.hand].def;

    await Promise.all([
        updateValueSlowly('battle-p1-stats', p1Data.cost, Math.max(0, p1Data.cost - p1C), "COST", `${p1Data.username} HP:${p1Data.hp} `),
        updateValueSlowly('battle-p2-stats', p2Data.cost, Math.max(0, p2Data.cost - p2C), "COST", `${p2Data.username} HP:${p2Data.hp} `)
    ]);

    if (p1Battle.cost_dmg > 0 || p2Battle.cost_dmg > 0) {
        phaseText.innerText = "コスト不足！";
        await new Promise(r => setTimeout(r, 500));
        if (p1Battle.cost_dmg > 0) {
            await flingDmg('total-dmg-p1', p1Battle.cost_dmg, 'animate-damage-p1');
            document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 500);
            await updateValueSlowly('battle-p1-stats', p1Data.hp, p1Data.hp - p1Battle.cost_dmg, "HP", `${p1Data.username} `);
        }
        if (p2Battle.cost_dmg > 0) {
            await flingDmg('total-dmg-p2', p2Battle.cost_dmg, 'animate-damage-p2');
            document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 500);
            await updateValueSlowly('battle-p2-stats', p2Data.hp, p2Data.hp - p2Battle.cost_dmg, "HP", `${p2Data.username} `);
        }
    }

    if (data.result !== 'draw') {
        const winName = (data.result === 'p1_win') ? p1Data.username : p2Data.username;
        phaseText.innerText = `${winName}のターン！`;
        await runCutIn(winName + " ATTACK!!");
        await runAttackAnim((data.result === 'p1_win') ? 'char-p1' : 'char-p2', 'slash-effect', 'ドガッ！');
    }

    phaseText.innerText = data.result === "draw" ? "あいこ！ダメージ精算！" : "ダメージ精算！";
    if (p1Battle.calc_dmg + p1Battle.win_dmg > 0 || p2Battle.calc_dmg + p2Battle.win_dmg > 0) {
        await Promise.all([
            (p1Battle.calc_dmg + p1Battle.win_dmg > 0) ? flingDmg('total-dmg-p1', p1Battle.calc_dmg + p1Battle.win_dmg, 'animate-damage-p1') : Promise.resolve(),
            (p2Battle.calc_dmg + p2Battle.win_dmg > 0) ? flingDmg('total-dmg-p2', p2Battle.calc_dmg + p2Battle.win_dmg, 'animate-damage-p2') : Promise.resolve()
        ]);
        document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 500);
        await Promise.all([
            updateValueSlowly('battle-p1-stats', p1Data.hp - p1Battle.cost_dmg, p1Battle.hp_after, "HP", `${p1Data.username} `),
            updateValueSlowly('battle-p2-stats', p2Data.hp - p2Battle.cost_dmg, p2Battle.hp_after, "HP", `${p2Data.username} `)
        ]);
    }

    if (p1Battle.hp_after <= 0 || p2Battle.hp_after <= 0) {
        await new Promise(r => setTimeout(r, 500));
        document.getElementById('ko-layer').classList.add('animate-ko');
        await new Promise(r => setTimeout(r, 1500));
        const s1 = document.getElementById('stamp-p1'), s2 = document.getElementById('stamp-p2');
        if (p1Battle.hp_after > p2Battle.hp_after) { s1.innerText="WIN"; s1.className="stamp win animate-stamp"; s2.innerText="LOSE"; s2.className="stamp lose animate-stamp"; }
        else if (p2Battle.hp_after > p1Battle.hp_after) { s1.innerText="LOSE"; s1.className="stamp lose animate-stamp"; s2.innerText="WIN"; s2.className="stamp win animate-stamp"; }
        else { s1.innerText="DRAW"; s1.className="stamp draw-color animate-stamp"; s2.innerText="DRAW"; s2.className="stamp draw-color animate-stamp"; }
        document.getElementById('battle-footer').classList.remove('hidden');
    }
    await new Promise(r => setTimeout(r, 2000));
});

async function runClash() {
    const clash = document.createElement('div');
    clash.className = 'clash-effect';
    document.getElementById('effect-layer').appendChild(clash);
    document.body.classList.add('shake');
    setTimeout(() => { document.body.classList.remove('shake'); clash.remove(); }, 600);
    await new Promise(r => setTimeout(r, 600));
}

async function runCutIn(text) {
    const banner = document.createElement('div');
    banner.className = 'cut-in-banner animate-cut-in';
    banner.innerHTML = `<div class="cut-in-text">${text}</div>`;
    document.getElementById('cut-in-layer').appendChild(banner);
    await new Promise(r => setTimeout(r, 1200));
    banner.remove();
}

async function runAttackAnim(attId, effType, txt) {
    const att = document.getElementById(attId);
    att.classList.add('animate-attack');
    document.getElementById('flash-layer').classList.add('animate-flash');
    const eff = document.createElement('div');
    eff.className = effType;
    eff.style.left = attId === 'char-p1' ? '70%' : '20%';
    eff.style.top = '40%';
    document.getElementById('effect-layer').appendChild(eff);
    const ono = document.createElement('div');
    ono.className = 'onomatope animate-onomatope';
    ono.innerText = txt;
    ono.style.left = attId === 'char-p1' ? '65%' : '15%';
    ono.style.top = '30%';
    document.getElementById('effect-layer').appendChild(ono);
    document.body.classList.add('shake');
    await new Promise(r => setTimeout(r, 800));
    att.classList.remove('animate-attack');
    document.getElementById('flash-layer').classList.remove('animate-flash');
    document.body.classList.remove('shake');
    eff.remove(); ono.remove();
}

async function flingDmg(id, val, pClass) {
    const el = document.getElementById(id);
    el.innerText = "-" + val;
    el.style.opacity = 1;
    el.className = 'total-damage-popup ' + pClass;
    await new Promise(r => setTimeout(r, 1500));
    el.style.opacity = 0;
}

socket.on('game_over', (data) => {
    setTimeout(() => {
        showScreen('game-over-screen');
        const winnerText = data.winner === mySid ? "あなたの勝利！" : (data.winner === null ? "引き分け" : "相手の勝利...");
        document.getElementById('winner-text').innerText = winnerText;
    }, 15000);
});
