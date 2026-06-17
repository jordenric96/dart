// --- JOUW SUPABASE GEGEVENS (VUL DIT IN!) ---
const supabaseUrl = 'JOUW_SUPABASE_URL_HIER';
const supabaseKey = 'JOUW_SUPABASE_API_KEY_HIER';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
// --------------------------------------------

// 7 Spelers (Round Robin = 21 matchen)
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
    // 1. Haal op uit DB
    const { data, error } = await supabaseClient.from('toernooi_data').select('state').eq('id', 1).single();
    
    if (data && data.state && Object.keys(data.state).length > 0) {
        state = data.state;
    } else {
        genereerSpeelschema();
        initStats();
        await saveState(true); 
    }
    render();

    // 2. Realtime Sync (Luistert naar andere iPads)
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
    if (forceRender) render(); 
    await supabaseClient.from('toernooi_data').update({ state: state }).eq('id', 1);
}

// Navigatie
navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        navButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentView = e.target.getAttribute('data-view');
        
        // Verberg navigatie op tablets om schermruimte te besparen
        if(currentView !== 'dashboard') {
            document.getElementById('top-nav').style.display = 'none';
        } else {
            document.getElementById('top-nav').style.display = 'flex';
        }
        render();
    });
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    let code = prompt("Voer code in om DB te wissen (1403):");
    if(code === "1403") {
        genereerSpeelschema();
        initStats();
        await saveState(true);
        alert("Systeem Gereset!");
    }
});

// --- TOERNOOI LOGICA ---
function genereerSpeelschema() {
    state.matches = [];
    let matchId = 1;
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
            state.stats[s] = { totalDarts: 0, totalScore: 0, legsPlayed: 0, checkouts: [], bullsWon: 0, max180: 0 };
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

// --- DASHBOARD (LAPTOP/TV WEERGAVE) ---
function renderDashboard() {
    const activeB1 = state.matches.find(m => m.board === 'board1' && (m.status === 'playing' || m.status === 'bullen'));
    const activeB2 = state.matches.find(m => m.board === 'board2' && (m.status === 'playing' || m.status === 'bullen'));

    // Bereken uitgebreide stats
    let gemiddeldes = alleSpelers.map(s => {
        const st = state.stats[s];
        const avg = st.totalDarts > 0 ? ((st.totalScore / st.totalDarts) * 3).toFixed(1) : "0.0";
        return { naam: s, avg: parseFloat(avg) };
    }).sort((a,b) => b.avg - a.avg);

    let bulls = alleSpelers.map(s => ({naam: s, bulls: state.stats[s].bullsWon})).sort((a,b) => b.bulls - a.bulls);
    
    let dartsPerLeg = alleSpelers.map(s => {
        const st = state.stats[s];
        const dpl = st.legsPlayed > 0 ? (st.totalDarts / st.legsPlayed).toFixed(1) : "0.0";
        return { naam: s, dpl: parseFloat(dpl), total: st.totalDarts };
    }).sort((a,b) => a.dpl - b.dpl); // Laagste is best!

    let html = `
        <div class="dashboard-grid">
            
            <!-- KOLOM 1: Live Borden & Wedstrijden -->
            <div class="grid-col">
                ${generateLiveBoardHTML('BORD 1', activeB1)}
                ${generateLiveBoardHTML('BORD 2', activeB2)}
                
                <div class="card" style="flex: 1;">
                    <h2>📋 WEDSTRIJDEN</h2>
                    <div class="match-list-container">
                        ${state.matches.map(m => {
                            let label = ""; let cls = "";
                            if(m.status === 'playing') { label = `BORD ${m.board==='board1'?'1':'2'} (Bezig)`; cls = "bezig"; }
                            else if(m.status === 'bullen') { label = `BORD ${m.board==='board1'?'1':'2'} (Bullen)`; cls = "bullen"; }
                            else if(m.status === 'finished') { label = `Klaar (${m.legs1}-${m.legs2})`; cls = "klaar"; }
                            else { label = "Wacht"; }
                            return `<div class="match-item ${cls}"><span>${m.p1} vs ${m.p2}</span><span>${label}</span></div>`;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- KOLOM 2: Algemeen Klassement -->
            <div class="grid-col">
                <div class="card" style="height: 100%;">
                    <h2>🏆 ALGEMENE STAND</h2>
                    <table class="retro-table" style="height: 90%;">
                        <tr><th>Pos</th><th>Speler</th><th>W</th><th>V</th><th>PT</th><th>Saldo</th></tr>
                        ${state.standings.map((s, i) => `
                            <tr style="${i===0 ? 'background:#ffffe6; font-weight:bold; font-size:1.1em;' : ''}">
                                <td>${i+1}</td><td style="text-align:left;">${s.naam}</td>
                                <td>${s.w}</td><td>${s.v}</td><td class="punten-cel">${s.pt}</td>
                                <td>${s.saldo > 0 ? '+'+s.saldo : s.saldo}</td>
                            </tr>
                        `).join('')}
                    </table>
                </div>
            </div>

            <!-- KOLOM 3: Statistieken -->
            <div class="grid-col">
                <div class="card" style="height: 100%; justify-content: space-around;">
                    <h2>📈 STATISTIEKEN</h2>
                    
                    <div>
                        <h3>🎯 Gemiddelde Score</h3>
                        <table class="retro-table">
                            <tr style="background:#cfc;"><td>Hoogste: ${gemiddeldes[0].naam}</td><td><strong>${gemiddeldes[0].avg}</strong></td></tr>
                            <tr style="background:#fcc;"><td>Laagste: ${gemiddeldes[gemiddeldes.length-1].naam}</td><td><strong>${gemiddeldes[gemiddeldes.length-1].avg}</strong></td></tr>
                            ${gemiddeldes.slice(1,4).map(g => `<tr><td>${g.naam}</td><td>${g.avg}</td></tr>`).join('')}
                        </table>
                    </div>

                    <div>
                        <h3>🔥 Hoogste Finishes</h3>
                        <table class="retro-table">
                            <tr><th>Speler</th><th>Uitgooi</th></tr>
                            ${getTopCheckouts().slice(0,3).map(co => `<tr><td>${co.naam}</td><td><strong>${co.score}</strong></td></tr>`).join('')}
                        </table>
                    </div>

                    <div>
                        <h3>⏱️ Pijlen Per Leg (Totaal)</h3>
                        <table class="retro-table">
                            <tr><th>Speler</th><th>Gem. Pijlen</th><th>Totaal</th></tr>
                            ${dartsPerLeg.slice(0,3).map(d => `<tr><td>${d.naam}</td><td><strong>${d.dpl}</strong></td><td>${d.total}</td></tr>`).join('')}
                        </table>
                    </div>

                    <div>
                        <h3>🐂 Meeste Bulls Gewonnen</h3>
                        <table class="retro-table">
                            <tr><th>Speler</th><th>Aantal Bulls</th></tr>
                            ${bulls.slice(0,3).map(b => `<tr><td>${b.naam}</td><td><strong>${b.bulls}</strong></td></tr>`).join('')}
                        </table>
                    </div>

                </div>
            </div>

        </div>
    `;
    appContainer.innerHTML = html;
}

function generateLiveBoardHTML(title, match) {
    if (!match) return `<div class="live-board"><h3>${title}</h3><p style="font-size: 2em; color:#ccc; margin:0;">Vrij</p></div>`;
    if (match.status === 'bullen') return `<div class="live-board"><h3>${title}</h3><div class="live-score" style="font-size: 2.5em;">🐂 BULLEN 🐂</div><p style="margin:0;">${match.p1} vs ${match.p2}</p></div>`;
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
        if(waitingMatches.length === 0) { html += `<h2>Geen wedstrijden meer! Toernooi is klaar.</h2></div></div>`; appContainer.innerHTML = html; return; }

        waitingMatches.forEach(m => {
            html += `<div class="match-option" onclick="startMatch('${m.id}', '${boardId}')">${m.p1} 🆚 ${m.p2}</div>`;
        });
        html += `</div></div>`;
        appContainer.innerHTML = html;
        return;
    }

    if (actieveMatch.status === 'bullen') {
        showModal(`
            <h2 style="font-size:3em;">🐂 WIE MAG BEGINNEN? 🐂</h2>
            <p style="font-size: 2em;">Wie zat het dichtst bij de Bull?</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-top:20px;">
                <button class="retro-button" style="font-size:2em;" onclick="setStarter('${actieveMatch.id}', 1)">${actieveMatch.p1}</button>
                <button class="retro-button" style="font-size:2em;" onclick="setStarter('${actieveMatch.id}', 2)">${actieveMatch.p2}</button>
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
                    <button class="retro-button danger" style="padding: 10px 20px; font-size:1.5em;" onclick="abortMatch('${actieveMatch.id}')">Match Afbreken</button>
                </div>
                
                <div class="scoring-area">
                    <div class="player-pane ${actieveMatch.turn === 1 ? 'active-turn' : ''}">
                        <h3 class="p-name">${actieveMatch.p1}</h3>
                        <div class="p-legs">LEGS: ${actieveMatch.legs1}</div>
                        <div class="p-score">${actieveMatch.score1}</div>
                    </div>
                    
                    <div class="player-pane ${actieveMatch.turn === 2 ? 'active-turn' : ''}">
                        <h3 class="p-name">${actieveMatch.p2}</h3>
                        <div class="p-legs">LEGS: ${actieveMatch.legs2}</div>
                        <div class="p-score">${actieveMatch.score2}</div>
                    </div>

                    <div class="input-section">
                        <label style="font-size: 3em; font-family:'Alfa Slab One', serif; color:white;">SCORE:</label>
                        <input type="number" id="score-input" class="score-input-field" placeholder="0" min="0" max="180">
                        <button class="retro-button success" style="font-size: 3em; padding: 10px 40px;" onclick="submitScore('${actieveMatch.id}')">OK</button>
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
    const winnerName = playerNum === 1 ? m.p1 : m.p2;
    
    // Voeg bull stats toe (1x per match bepalen)
    if (!m.startThrower) { state.stats[winnerName].bullsWon++; }

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
    const activePlayerName = m.turn === 1 ? m.p1 : m.p2;

    const oldScore = m[activeScoreStr];
    let newScore = oldScore - throwScore;

    // BUST
    if (newScore < 0 || newScore === 1) {
        state.stats[activePlayerName].totalDarts += 3;
        // Total score stays same on bust
        wisselBeurt(m);
        render(); 
        await saveState(false);
        setTimeout(() => alert("💥 BUST! No score."), 100);
        return;
    }

    // WIN LEG
    if (newScore === 0) {
        if(throwScore === 180) state.stats[activePlayerName].max180++;
        showModal(`
            <h2 style="color:var(--green-ok); font-size:3em; margin:0;">🎯 UITGEGOOID!</h2>
            <p style="font-size: 1.5em;">Hoeveel pijlen heb je in deze <b>LAATSTE BEURT</b> gegooid?</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-top:20px;">
                <button class="retro-button" style="font-size:2em;" onclick="processLegWin('${m.id}', ${throwScore}, 1)">1 Pijl</button>
                <button class="retro-button" style="font-size:2em;" onclick="processLegWin('${m.id}', ${throwScore}, 2)">2 Pijlen</button>
                <button class="retro-button" style="font-size:2em;" onclick="processLegWin('${m.id}', ${throwScore}, 3)">3 Pijlen</button>
            </div>
        `);
        return;
    }

    // Normale worp
    m[activeScoreStr] = newScore;
    state.stats[activePlayerName].totalDarts += 3;
    state.stats[activePlayerName].totalScore += throwScore;

    if(throwScore === 180) state.stats[activePlayerName].max180++;
    wisselBeurt(m);
    await saveState(true);
}

window.processLegWin = async function(matchId, checkoutScore, dartsThrown) {
    const m = state.matches.find(x => x.id === matchId);
    const winnerNum = m.turn;
    const winnerName = winnerNum === 1 ? m.p1 : m.p2;

    // Update Stats voor de winnaar
    state.stats[winnerName].checkouts.push(checkoutScore);
    state.stats[winnerName].totalDarts += dartsThrown;
    state.stats[winnerName].totalScore += checkoutScore;
    
    // Beide spelers hebben een leg voltooid
    state.stats[m.p1].legsPlayed++;
    state.stats[m.p2].legsPlayed++;

    if(winnerNum === 1) m.legs1++; else m.legs2++;

    if (m.legs1 === 3 || m.legs2 === 3) {
        m.status = 'finished';
        hideModal();
        alert(`🏆 MATCH WINNAAR: ${winnerName}!`);
        
        // Laat navigatie weer zien
        document.getElementById('top-nav').style.display = 'flex';
        currentView = 'dashboard'; 
        await saveState(true);
        return;
    }

    // Reset voor nieuwe leg
    m.score1 = 501; m.score2 = 501;
    m.startThrower = m.startThrower === 1 ? 2 : 1;
    m.turn = m.startThrower;

    hideModal();
    await saveState(true);
}

function wisselBeurt(m) { m.turn = m.turn === 1 ? 2 : 1; }
function showModal(html) { document.getElementById('modal-content').innerHTML = html; document.getElementById('action-modal').style.display = 'flex'; }
function hideModal() { document.getElementById('action-modal').style.display = 'none'; }

init();
