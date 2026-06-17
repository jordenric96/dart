// --- JOUW SUPABASE GEGEVENS (VUL DIT IN!) ---
const supabaseUrl = 'JOUW_SUPABASE_URL_HIER';
const supabaseKey = 'JOUW_SUPABASE_API_KEY_HIER';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
// --------------------------------------------

// 7 Spelers
const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Stefaan", "Wim", "Tibe"];

let state = {
    matches: [],     
    standings: [],   
    stats: {}        
};

let currentView = 'dashboard'; 
const appContainer = document.getElementById('app-container');
const navButtons = document.querySelectorAll('.nav-btn');

// --- SUPABASE INITIALISATIE & REALTIME SYNC ---
async function init() {
    // 1. Haal de laatste data op uit de database
    const { data, error } = await supabaseClient.from('toernooi_data').select('state').eq('id', 1).single();
    
    if (data && data.state && Object.keys(data.state).length > 0) {
        state = data.state;
    } else {
        genereerSpeelschema();
        initStats();
        await saveState(true); // Sla lege setup op in database
    }
    render();

    // 2. Luister naar veranderingen van ANDERE schermen (de Live Sync!)
    supabaseClient
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'toernooi_data' }, (payload) => {
          state = payload.new.state;
          berekenKlassement();
          render();
      })
      .subscribe();
}

async function saveState(forceRender = false) {
    berekenKlassement();
    if (forceRender) render(); // UI meteen updaten voor de persoon die klikt
    
    // Stuur naar Supabase (andere schermen vangen dit op via de channel)
    await supabaseClient.from('toernooi_data').update({ state: state }).eq('id', 1);
}

// Navigatie
navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        navButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentView = e.target.getAttribute('data-view');
        render();
    });
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    if(confirm("ALLES wissen en toernooi opnieuw starten?")) {
        genereerSpeelschema();
        initStats();
        await saveState(true);
    }
});

// --- TOERNOOI LOGICA ---
function genereerSpeelschema() {
    state.matches = [];
    let matchId = 1;
    // Iedereen tegen iedereen
    for (let i = 0; i < alleSpelers.length; i++) {
        for (let j = i + 1; j < alleSpelers.length; j++) {
            state.matches.push({
                id: `M${matchId++}`,
                p1: alleSpelers[i], p2: alleSpelers[j],
                status: 'waiting', board: null,
                legs1: 0, legs2: 0,
                score1: 501, score2: 501,
                turn: null, startThrower: null,
                dartsThrown1: 0, dartsThrown2: 0
            });
        }
    }
}

function initStats() {
    alleSpelers.forEach(s => {
        if(!state.stats[s]) {
            state.stats[s] = { totalDarts: 0, legsWon: 0, doubleAttempts: 0, doubleHits: 0, checkouts: [], max180: 0 };
        }
    });
}

function berekenKlassement() {
    let standings = alleSpelers.map(speler => ({ naam: speler, pt: 0, w: 0, v: 0, legsV: 0, legsT: 0, saldo: 0 }));
    
    state.matches.filter(m => m.status === 'finished').forEach(m => {
        let s1 = standings.find(s => s.naam === m.p1);
        let s2 = standings.find(s => s.naam === m.p2);
        s1.legsV += m.legs1; s1.legsT += m.legs2;
        s2.legsV += m.legs2; s2.legsT += m.legs1;
        if (m.legs1 === 3) { s1.w++; s1.pt += 2; s2.v++; }
        if (m.legs2 === 3) { s2.w++; s2.pt += 2; s1.v++; }
    });

    standings.forEach(s => s.saldo = s.legsV - s.legsT);
    standings.sort((a, b) => b.pt - a.pt || b.saldo - a.saldo || b.legsV - a.legsV);
    state.standings = standings;
}

// --- RENDER ROUTER ---
function render() {
    if (currentView === 'dashboard') renderDashboard();
    else renderTablet(currentView); 
}

// --- DASHBOARD (LAPTOP WEERGAVE) ---
function renderDashboard() {
    const activeB1 = state.matches.find(m => m.board === 'board1' && (m.status === 'playing' || m.status === 'bullen'));
    const activeB2 = state.matches.find(m => m.board === 'board2' && (m.status === 'playing' || m.status === 'bullen'));

    let html = `
        <h2 style="font-size: 2.5em; margin-top: 0;">📡 LIVE DASHBOARD</h2>
        <div class="dashboard-grid">
            <div class="grid-left">
                <div class="live-matches">
                    ${generateLiveBoardHTML('BORD 1', activeB1)}
                    ${generateLiveBoardHTML('BORD 2', activeB2)}
                </div>
                <div class="card">
                    <h2>🏆 ALGEMENE STAND</h2>
                    <table class="retro-table">
                        <tr><th>Pos</th><th>Speler</th><th>W</th><th>V</th><th>PT</th><th>Legs (V-T)</th><th>Saldo</th></tr>
                        ${state.standings.map((s, i) => `
                            <tr style="${i===0 ? 'background:#ffffe6; font-weight:bold; font-size:1.1em;' : ''}">
                                <td>${i+1}</td><td style="text-align:left;">${s.naam}</td>
                                <td>${s.w}</td><td>${s.v}</td><td class="punten-cel">${s.pt}</td>
                                <td>${s.legsV} - ${s.legsT}</td><td>${s.saldo > 0 ? '+'+s.saldo : s.saldo}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            </div>
            <div class="grid-right">
                <div class="card">
                    <h2>📈 STATISTIEKEN</h2>
                    <h3 style="margin-top: 10px;">🎯 Check-out %</h3>
                    <table class="retro-table">
                        <tr><th>Speler</th><th>%</th><th>(Hits/Pogingen)</th></tr>
                        ${alleSpelers.map(s => {
                            const st = state.stats[s];
                            const perc = st.doubleAttempts > 0 ? Math.round((st.doubleHits / st.doubleAttempts) * 100) : 0;
                            return {naam: s, perc: perc, h: st.doubleHits, a: st.doubleAttempts};
                        }).sort((a,b) => b.perc - a.perc).slice(0,5).map(s => `
                            <tr><td>${s.naam}</td><td><strong>${s.perc}%</strong></td><td>${s.h}/${s.a}</td></tr>
                        `).join('')}
                    </table>
                    <h3 style="margin-top: 15px;">🔥 Hoogste Uitgooi</h3>
                    <table class="retro-table">
                        <tr><th>Speler</th><th>Score</th></tr>
                        ${getTopCheckouts().slice(0,5).map(co => `<tr><td>${co.naam}</td><td><strong>${co.score}</strong></td></tr>`).join('')}
                    </table>
                </div>
            </div>
        </div>
    `;
    appContainer.innerHTML = html;
}

function generateLiveBoardHTML(title, match) {
    if (!match) return `<div class="live-board"><h3 style="color:#999;">${title}</h3><p style="font-size: 2em; color:#ccc;">Geen match bezig</p></div>`;
    if (match.status === 'bullen') return `<div class="live-board"><h3>${title}</h3><div class="live-score">🐂 BULLEN 🐂</div><p>${match.p1} vs ${match.p2}</p></div>`;
    return `
        <div class="live-board">
            <h3>${title} <span class="live-legs">Best of 5</span></h3>
            <div style="font-size: 1.5em; font-family: 'Alfa Slab One';">${match.p1} <span style="color:var(--red-alert); margin: 0 10px;">${match.legs1} - ${match.legs2}</span> ${match.p2}</div>
            <div class="live-score">
                <div style="${match.turn === 1 ? 'color:var(--highlight-color); text-shadow: 2px 2px 0 #000;' : 'color:#999;'}">${match.score1}</div>
                <div style="font-size: 0.5em; color:#333;">VS</div>
                <div style="${match.turn === 2 ? 'color:var(--highlight-color); text-shadow: 2px 2px 0 #000;' : 'color:#999;'}">${match.score2}</div>
            </div>
        </div>
    `;
}

function getTopCheckouts() {
    let allCO = [];
    alleSpelers.forEach(s => {
        state.stats[s].checkouts.forEach(score => allCO.push({naam: s, score: score}));
    });
    return allCO.sort((a,b) => b.score - a.score);
}

// --- TABLET / BORD (501 ENGINE) ---
function renderTablet(boardId) {
    const actieveMatch = state.matches.find(m => m.board === boardId && m.status !== 'finished');

    if (!actieveMatch) {
        let html = `<div class="tablet-view"><h2 class="board-header">Kies een match voor ${boardId === 'board1' ? 'BORD 1' : 'BORD 2'}</h2><div class="match-selector">`;
        const waitingMatches = state.matches.filter(m => m.status === 'waiting');
        if(waitingMatches.length === 0) { html += `<h2>Geen wedstrijden meer!</h2></div></div>`; appContainer.innerHTML = html; return; }

        waitingMatches.forEach(m => {
            html += `<div class="match-option" onclick="startMatch('${m.id}', '${boardId}')">${m.p1} 🆚 ${m.p2}</div>`;
        });
        html += `</div></div>`;
        appContainer.innerHTML = html;
        return;
    }

    if (actieveMatch.status === 'bullen') {
        showModal(`
            <h2>🐂 WIE MAG BEGINNEN? 🐂</h2>
            <p style="font-size: 1.5em;">Wie zat het dichtst bij de Bull?</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-top:20px;">
                <button class="retro-button" onclick="setStarter('${actieveMatch.id}', 1)">${actieveMatch.p1}</button>
                <button class="retro-button" onclick="setStarter('${actieveMatch.id}', 2)">${actieveMatch.p2}</button>
            </div>
        `);
        return;
    }

    if (actieveMatch.status === 'playing') {
        hideModal();
        let html = `
            <div class="tablet-view">
                <div style="display:flex; justify-content: space-between; align-items:center;">
                    <h2 class="board-header">BORD ${boardId === 'board1' ? '1' : '2'} - FIRST TO 3</h2>
                    <button class="retro-button danger" style="padding: 5px 10px; font-size:1em;" onclick="abortMatch('${actieveMatch.id}')">Afbreken</button>
                </div>
                
                <div class="scoring-area">
                    <div class="player-pane ${actieveMatch.turn === 1 ? 'active-turn' : ''}">
                        <h3 class="p-name">${actieveMatch.p1}</h3>
                        <div class="p-legs">LEGS: ${actieveMatch.legs1}</div>
                        <div class="p-score">${actieveMatch.score1}</div>
                        <div class="p-stats">Pijlen gegooid: ${actieveMatch.dartsThrown1}</div>
                    </div>
                    
                    <div class="player-pane ${actieveMatch.turn === 2 ? 'active-turn' : ''}">
                        <h3 class="p-name">${actieveMatch.p2}</h3>
                        <div class="p-legs">LEGS: ${actieveMatch.legs2}</div>
                        <div class="p-score">${actieveMatch.score2}</div>
                        <div class="p-stats">Pijlen gegooid: ${actieveMatch.dartsThrown2}</div>
                    </div>

                    <div class="input-section">
                        <label style="font-size: 2em; font-family:'Alfa Slab One', serif; color:white;">GEGOOID:</label>
                        <input type="number" id="score-input" class="score-input-field" placeholder="0" min="0" max="180">
                        <button class="retro-button success" style="font-size: 2em;" onclick="submitScore('${actieveMatch.id}')">OK</button>
                    </div>
                </div>
            </div>
        `;
        appContainer.innerHTML = html;
        setTimeout(() => document.getElementById('score-input').focus(), 100);
        document.getElementById('score-input').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') submitScore(actieveMatch.id);
        });
    }
}

// --- 501 LOGICA ---
window.startMatch = async function(matchId, boardId) {
    const m = state.matches.find(x => x.id === matchId);
    m.board = boardId; m.status = 'bullen';
    await saveState(true);
}

window.abortMatch = async function(matchId) {
    if(confirm("Match afbreken? Dit reset alle scores van deze match!")) {
        const m = state.matches.find(x => x.id === matchId);
        m.status = 'waiting'; m.board = null; m.legs1 = 0; m.legs2 = 0; m.score1 = 501; m.score2 = 501; m.dartsThrown1 = 0; m.dartsThrown2 = 0;
        await saveState(true);
    }
}

window.setStarter = async function(matchId, playerNum) {
    const m = state.matches.find(x => x.id === matchId);
    m.status = 'playing'; m.startThrower = playerNum; m.turn = playerNum;
    await saveState(true);
}

window.submitScore = async function(matchId) {
    const input = document.getElementById('score-input');
    const throwScore = parseInt(input.value);
    
    if (isNaN(throwScore) || throwScore < 0 || throwScore > 180) {
        alert("Ongeldige score!"); input.value = ''; return;
    }

    const m = state.matches.find(x => x.id === matchId);
    const activeScoreStr = m.turn === 1 ? 'score1' : 'score2';
    const activeDartsStr = m.turn === 1 ? 'dartsThrown1' : 'dartsThrown2';
    const activePlayerName = m.turn === 1 ? m.p1 : m.p2;

    const oldScore = m[activeScoreStr];
    let newScore = oldScore - throwScore;
    m[activeDartsStr] += 3;

    // Bust
    if (newScore < 0 || newScore === 1) {
        wisselBeurt(m);
        render(); // Snel lokaal flitsen
        await saveState(false);
        setTimeout(() => alert("💥 BUST! No score."), 100);
        return;
    }

    // Win
    if (newScore === 0) {
        m[activeScoreStr] = 0;
        if(throwScore === 180) state.stats[activePlayerName].max180++;
        render(); 
        
        showModal(`
            <h2 style="color:var(--green-ok); font-size:3em; margin:0;">🎯 UITGEGOOID!</h2>
            <p style="font-size: 1.5em;">Hoeveel pijlen heb je <b>OP DE DUBBEL</b> gegooid voor deze check-out?</p>
            <input type="number" id="double-darts-input" min="1" max="3" value="1" style="font-size: 3em; width: 100px; text-align:center; border: 3px solid black; border-radius:5px;"><br><br>
            <button class="retro-button success" style="font-size: 1.5em;" onclick="processLegWin('${m.id}', ${throwScore})">Opslaan & Volgende Leg</button>
        `);
        return;
    }

    // Normale worp
    m[activeScoreStr] = newScore;
    if(throwScore === 180) state.stats[activePlayerName].max180++;
    wisselBeurt(m);
    await saveState(true);
}

window.processLegWin = async function(matchId, checkoutScore) {
    const m = state.matches.find(x => x.id === matchId);
    const doubleDarts = parseInt(document.getElementById('double-darts-input').value) || 1;
    const winnerNum = m.turn;
    const winnerName = winnerNum === 1 ? m.p1 : m.p2;

    state.stats[winnerName].legsWon++;
    state.stats[winnerName].checkouts.push(checkoutScore);
    state.stats[winnerName].doubleHits++;
    state.stats[winnerName].doubleAttempts += doubleDarts;

    if(winnerNum === 1) m.legs1++; else m.legs2++;

    if (m.legs1 === 3 || m.legs2 === 3) {
        m.status = 'finished';
        hideModal();
        alert(`🏆 MATCH WINNAAR: ${winnerName}!`);
        currentView = 'dashboard'; 
        await saveState(true);
        return;
    }

    m.score1 = 501; m.score2 = 501; m.dartsThrown1 = 0; m.dartsThrown2 = 0;
    m.startThrower = m.startThrower === 1 ? 2 : 1;
    m.turn = m.startThrower;

    hideModal();
    await saveState(true);
}

function wisselBeurt(m) { m.turn = m.turn === 1 ? 2 : 1; }
function showModal(html) { document.getElementById('modal-content').innerHTML = html; document.getElementById('action-modal').style.display = 'flex'; }
function hideModal() { document.getElementById('action-modal').style.display = 'none'; }

init();
