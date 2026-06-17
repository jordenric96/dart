// --- COORDRECHTEN EN CONNECTIE SUPABASE ---
const supabaseUrl = 'https://jpvgcgjnhvutqtrkbamc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdmdjZ2puaHZ1dHF0cmtiYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIxMzgsImV4cCI6MjA5NzI4ODEzOH0.edR9Ve6FOOre5DcmHDoAPSF0rIsU_DVX1KFy9pQACyI';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Stefaan", "Wim", "Tibe"];

let state = {
    matches: [],     
    standings: [],   
    stats: {}        
};

let currentView = 'dashboard';
let padInputString = ""; 
const appContainer = document.getElementById('app-container');
const navButtons = document.querySelectorAll('.nav-btn');

// --- DATABASE INITIATIE & REALTIME SYNC ---
async function init() {
    // Service Worker registreren voor PWA werking
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./script.js', {type: 'module'}).catch(() => {});
        });
    }

    const { data, error } = await supabaseClient.from('toernooi_data').select('state').eq('id', 1).single();
    if (data && data.state && Object.keys(data.state).length > 0) {
        state = data.state;
    } else {
        genereerRoundRobinSchema();
        initStatsKlassen();
        await saveState(true);
    }
    render();

    // Luister live naar mutaties op tablets
    supabaseClient
      .channel('darts-realtime-channel')
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
    await supabaseClient.from('toernooi_data').upsert({ id: 1, state: state });
}

// Navigatie routing
navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        navButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentView = e.target.getAttribute('data-view');
        document.getElementById('top-nav').style.display = (currentView === 'dashboard') ? 'flex' : 'none';
        padInputString = "";
        render();
    });
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    if(prompt("Typ '1403' om de database volledig te wissen:") === "1403") {
        genereerRoundRobinSchema();
        initStatsKlassen();
        await saveState(true);
        alert("Database gereset naar startpositie!");
    }
});

function genereerRoundRobinSchema() {
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
                dartsLeg1: 0, dartsLeg2: 0,
                scoreLeg1: 0, scoreLeg2: 0,
                doubleAttempts1: 0, doubleAttempts2: 0,
                doubleHits1: 0, doubleHits2: 0
            });
        }
    }
}

function initStatsKlassen() {
    state.stats = {};
    alleSpelers.forEach(s => {
        state.stats[s] = { totalDarts: 0, totalScore: 0, legsPlayed: 0, checkouts: [], bullsWon: 0, max180: 0, doubleAttempts: 0, doubleHits: 0 };
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

// --- RENDERING MANAGEMENT ---
function render() {
    appContainer.innerHTML = '';
    if (currentView === 'dashboard') renderDashboard();
    else renderTabletView(currentView);
}

// --- 1. LIVE TV DASHBOARD (Volledig gevulde TV-blokken - Top 7) ---
function renderDashboard() {
    const activeB1 = state.matches.find(m => m.board === 'board1' && (m.status === 'playing' || m.status === 'bullen'));
    const activeB2 = state.matches.find(m => m.board === 'board2' && (m.status === 'playing' || m.status === 'bullen'));

    // Subklassementen berekenen (Altijd top 7 tonen)
    let gemiddeldes = alleSpelers.map(s => {
        const st = state.stats[s];
        const avg = st.totalDarts > 0 ? ((st.totalScore / st.totalDarts) * 3).toFixed(1) : "0.0";
        return { naam: s, val: parseFloat(avg) };
    }).sort((a,b) => b.val - a.val);

    let checkouts = [];
    alleSpelers.forEach(s => {
        let maxCO = (state.stats[s].checkouts && state.stats[s].checkouts.length > 0) ? Math.max(...state.stats[s].checkouts) : 0;
        checkouts.push({ naam: s, val: maxCO });
    });
    checkouts.sort((a,b) => b.val - a.val);

    let bulls = alleSpelers.map(s => ({ naam: s, val: state.stats[s].bullsWon || 0 })).sort((a,b) => b.val - a.val);
    let totalDarts = alleSpelers.map(s => ({ naam: s, val: state.stats[s].totalDarts || 0 })).sort((a,b) => b.val - a.val);
    
    let doublePct = alleSpelers.map(s => {
        const st = state.stats[s];
        const pct = st.doubleAttempts > 0 ? Math.round((st.doubleHits / st.doubleAttempts) * 100) : 0;
        return { naam: s, val: pct, label: `${pct}% (${st.doubleHits}/${st.doubleAttempts})` };
    }).sort((a,b) => b.val - a.val);

    let html = `<div class="dashboard-grid">
        <div class="grid-col">
            ${generateLiveMatchCardHTML('🎯 BORD 1', activeB1)}
            ${generateLiveBoardHTML('🎯 BORD 2', activeB2)}
            <div class="card" style="flex:1;">
                <h2>📋 WEDSTRIJDEN LOG</h2>
                <div class="match-list-container">
                    ${state.matches.map(m => {
                        let label = "Wacht", cls = "";
                        if(m.status === 'playing') { label = `Bord ${m.board==='board1'?'1':'2'} (Live)`; cls = "bezig"; }
                        if(m.status === 'bullen') { label = "Bullen"; cls = "bullen"; }
                        if(m.status === 'finished') { label = `Klaar (${m.legs1}-${m.legs2})`; cls = "klaar"; }
                        return `<div class="match-item ${cls}"><span>${m.p1} vs ${m.p2}</span><span>${label}</span></div>`;
                    }).join('')}
                </div>
            </div>
        </div>

        <div class="grid-col">
            <div class="card" style="height:100%;">
                <h2>🏆 ALGEMEEN KLASSEMENT (TOP 7)</h2>
                <table class="retro-table">
                    <tr><th>#</th><th>Naam</th><th>W</th><th>V</th><th>PT</th><th>Saldo</th></tr>
                    ${state.standings.map((s, i) => `
                        <tr class="${i===0?'leader-row':''}">
                            <td>${i+1}</td><td style="text-align:left;"><b>${s.naam}</b></td>
                            <td>${s.w}</td><td>${s.v}</td><td class="punten-cel">${s.pt}</td><td>${s.saldo > 0 ? '+'+s.saldo : s.saldo}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
        </div>

        <div class="grid-col">
            <div class="card single">
                <h2>🎯 3-DART GEMIDDELDE (TOP 7)</h2>
                <table class="retro-table">
                    ${gemiddeldes.map((g,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${g.naam}</td><td><strong>${g.val.toFixed(1)}</strong></td></tr>`).join('')}
                </table>
            </div>
            <div class="card single">
                <h2>❌ DUBBEL PERCENTAGE (TOP 7)</h2>
                <table class="retro-table">
                    ${doublePct.map((d,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${d.naam}</td><td><strong>${d.label}</strong></td></tr>`).join('')}
                </table>
            </div>
            <div class="card single">
                <h2>🔥 HOOGSTE FINISH (TOP 7)</h2>
                <table class="retro-table">
                    ${checkouts.map((c,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${c.naam}</td><td><strong>${c.val > 0 ? c.val : '-'}</strong></td></tr>`).join('')}
                </table>
            </div>
        </div>
    </div>`;
    appContainer.innerHTML = html;
}

function generateLiveMatchCardHTML(title, match) {
    if (!match) return `<div class="live-board"><h3>${title}</h3><p style="font-size:1.5rem; color:#444; margin:1vh 0;">Bord Vrij</p></div>`;
    if (match.status === 'bullen') return `<div class="live-board active"><h3>${title}</h3><div class="live-match-title">${match.p1} vs ${match.p2}</div><div style="color:var(--gold); font-size:1.4rem;">🐂 BULLEN VOOR START 🐂</div></div>`;
    
    // Bereken lopende leg gemiddeldes voor TV dashboard
    let avg1 = match.dartsLeg1 > 0 ? ((match.scoreLeg1 / match.dartsLeg1) * 3).toFixed(1) : "0.0";
    let avg2 = match.dartsLeg2 > 0 ? ((match.scoreLeg2 / match.dartsLeg2) * 3).toFixed(1) : "0.0";

    return `<div class="live-board active">
        <h3>${title} <span class="live-legs">Leg ${match.legs1 + match.legs2 + 1}</span></h3>
        <div class="live-match-title">${match.p1} (${match.legs1}) 🆚 (${match.legs2}) ${match.p2}</div>
        <div class="live-score-row">
            <div class="live-score-val ${match.turn===1?'turn':''}">
                <div>${match.score1}</div>
                <div style="font-size:0.8rem; font-family:sans-serif; color:#888;">Avg: ${avg1} | Darts: ${match.dartsLeg1}</div>
            </div>
            <div style="font-size:1.5rem; color:#444;">VS</div>
            <div class="live-score-val ${match.turn===2?'turn':''}">
                <div>${match.score2}</div>
                <div style="font-size:0.8rem; font-family:sans-serif; color:#888;">Avg: ${avg2} | Darts: ${match.dartsLeg2}</div>
            </div>
        </div>
    </div>`;
}
function generateLiveBoardHTML(t, m) { return generateLiveMatchCardHTML(t, m); }

// --- 2. TABLET APPLICATIE SCHERM ---
function renderTabletView(boardId) {
    const actieveMatch = state.matches.find(m => m.board === boardId && m.status !== 'finished');

    if (!actieveMatch) {
        let html = `<div class="tablet-view">
            <div class="top-nav" style="margin-bottom:2vh; border-radius:4px;"><div class="nav-title">KIES EEN WEDSTRIJD (${boardId.toUpperCase()})</div><button class="nav-btn" onclick="sluitTablet()">🗙 TV</button></div>
            <div class="match-selector">`;
        state.matches.filter(m => m.status === 'waiting').forEach(m => {
            html += `<div class="match-option" onclick="koppelMatchAanBord('${m.id}', '${boardId}')">${m.p1} 🆚 ${m.p2}</div>`;
        });
        html += `</div></div>`;
        appContainer.innerHTML = html;
        return;
    }

    if (actieveMatch.status === 'bullen') {
        showModal(`
            <h2 style="font-size:2.5rem; color:var(--gold);">🐂 BULLSEYE METING 🐂</h2>
            <p style="font-size:1.4rem;">Wie smeet het dichtst bij de rode stip en mag de partij openen?</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-top:3vh;">
                <button class="retro-button success" style="font-size:2rem;" onclick="bevestigBullenWinnaar('${actieveMatch.id}', 1)">${actieveMatch.p1}</button>
                <button class="retro-button success" style="font-size:2rem;" onclick="bevestigBullenWinnaar('${actieveMatch.id}', 2)">${actieveMatch.p2}</button>
            </div>
        `);
        return;
    }

    if (actieveMatch.status === 'playing') {
        hideModal();
        
        // Bereken lopende leg gemiddeldes voor op de tablet
        let legAvg1 = actieveMatch.dartsLeg1 > 0 ? ((actieveMatch.scoreLeg1 / actieveMatch.dartsLeg1) * 3).toFixed(1) : "0.0";
        let legAvg2 = actieveMatch.dartsLeg2 > 0 ? ((actieveMatch.scoreLeg2 / actieveMatch.dartsLeg2) * 3).toFixed(1) : "0.0";

        let html = `<div class="tablet-view">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1vh;">
                <span style="font-size:1.5rem; font-weight:bold; color:var(--gold);">${boardId.toUpperCase()} - FIRST TO 3 LEGS</span>
                <button class="retro-button danger" style="padding:4px 10px; font-size:1rem;" onclick="annuleerLopendeMatch('${actieveMatch.id}')">Afbreken</button>
            </div>
            
            <div class="tablet-grid">
                <div class="pane ${actieveMatch.turn===1?'active':''}">
                    <h3 class="pane-name">${actieveMatch.p1}</h3>
                    <div class="pane-legs">LEGS: ${actieveMatch.legs1}</div>
                    <div class="pane-score ${actieveMatch.score1<=170?'checkout-ready':''}">${actieveMatch.score1}</div>
                    <div class="pane-stats">Pijlen: ${actieveMatch.dartsLeg1} | Avg: ${legAvg1}</div>
                </div>
                
                <div class="pane ${actieveMatch.turn===2?'active':''}">
                    <h3 class="pane-name">${actieveMatch.p2}</h3>
                    <div class="pane-legs">LEGS: ${actieveMatch.legs2}</div>
                    <div class="pane-score ${actieveMatch.score2<=170?'checkout-ready':''}">${actieveMatch.score2}</div>
                    <div class="pane-stats">Pijlen: ${actieveMatch.dartsLeg2} | Avg: ${legAvg2}</div>
                </div>

                <div class="numpad-container">
                    <div class="numpad-field" id="pad-screen">0</div>
                    <button class="pre" onclick="numpadDrukPref(100)">100</button>
                    <button class="pre" onclick="numpadDrukPref(60)">60</button>
                    <button class="pre" onclick="numpadDrukPref(40)">40</button>
                    <button class="pre" onclick="numpadDrukPref(26)">26</button>

                    <button onclick="numpadDrukCijfer(1)">1</button><button onclick="numpadDrukCijfer(2)">2</button><button onclick="numpadDrukCijfer(3)">3</button>
                    <button class="clear" onclick="numpadWissen()">⌫</button>

                    <button onclick="numpadDrukCijfer(4)">4</button><button onclick="numpadDrukCijfer(5)">5</button><button onclick="numpadDrukCijfer(6)">6</button>
                    <button class="action" style="grid-row: span 2;" onclick="verwerkIngevuldeScore('${actieveMatch.id}')">OK</button>

                    <button onclick="numpadDrukCijfer(7)">7</button><button onclick="numpadDrukCijfer(8)">8</button><button onclick="numpadDrukCijfer(9)">9</button>
                    <button style="grid-column: span 3;" onclick="numpadDrukCijfer(0)">0</button>
                </div>
            </div>
        </div>`;
        appContainer.innerHTML = html;
        document.getElementById('pad-screen').innerText = padInputString || "0";
    }
}

// --- NUMPAD CONTROLS ---
window.numpadDrukCijfer = function(c) {
    if(padInputString.length >= 3) return;
    padInputString += c;
    document.getElementById('pad-screen').innerText = padInputString;
};
window.numpadWissen = function() {
    padInputString = padInputString.slice(0, -1);
    document.getElementById('pad-screen').innerText = padInputString || "0";
};
window.numpadDrukPref = function(val) {
    padInputString = val.toString();
    document.getElementById('pad-screen').innerText = padInputString;
};

// --- DART ENGINE SCORELOGICA ---
window.koppelMatchAanBord = async function(mId, boardId) {
    const m = state.matches.find(x => x.id === mId);
    m.board = boardId; m.status = 'bullen';
    await saveState(true);
};

window.annuleerLopendeMatch = async function(mId) {
    if(confirm("Partij definitief wissen? Alle stats van deze match vervallen.")) {
        const m = state.matches.find(x => x.id === mId);
        m.status = 'waiting'; m.board = null; m.legs1 = 0; m.legs2 = 0; m.score1 = 501; m.score2 = 501;
        m.dartsLeg1 = 0; m.dartsLeg2 = 0; m.scoreLeg1 = 0; m.scoreLeg2 = 0;
        await saveState(true);
    }
}

window.bevestigBullenWinnaar = async function(mId, pNum) {
    const m = state.matches.find(x => x.id === mId);
    const winNaam = pNum === 1 ? m.p1 : m.p2;
    state.stats[winNaam].bullsWon = (state.stats[winNaam].bullsWon || 0) + 1;
    m.status = 'playing'; m.startThrower = pNum; m.turn = pNum;
    await saveState(true);
}

window.sluitTablet = function() {
    document.getElementById('top-nav').style.display = 'flex';
    currentView = 'dashboard';
    render();
}

window.verwerkIngevuldeScore = async function(mId) {
    let score = parseInt(padInputString) || 0;
    padInputString = ""; // Reset string direct

    if (score < 0 || score > 180) { alert("Ongeldige dartscore (0-180)!"); return; }

    const m = state.matches.find(x => x.id === mId);
    const scStr = m.turn === 1 ? 'score1' : 'score2';
    const activePlayer = m.turn === 1 ? m.p1 : m.p2;
    const oldScore = m[scStr];
    let newScore = oldScore - score;

    // --- CRITERIALE DUBBEL REGISTRATIE ---
    // Als een speler op een uitgooi stond (<=170), MOET er doorgegeven worden hoeveel darts er naar de dubbel gingen
    if (oldScore <= 170) {
        let maxDarts = (newScore === 0) ? 3 : 3;
        let minDarts = (newScore === 0) ? 1 : 0;
        
        let promptText = `Hoeveel pijlen gooide ${activePlayer} in deze beurt RICHTING DE DUBBEL?`;
        if(newScore === 0) promptText += ` (Winnaar: 1, 2 of 3 pijlen)`;
        else promptText += ` (Missers: 0, 1, 2 of 3 pijlen)`;

        showModal(`
            <h2>❌ DUBBEL TRACKING (${oldScore} over)</h2>
            <p>${promptText}</p>
            <div class="modal-grid-3">
                ${newScore !== 0 ? `<button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 0)">0 Darts</button>` : ''}
                <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 1)">1 Dart</button>
                <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 2)">2 Darts</button>
                <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 3)">3 Darts</button>
            </div>
        `);
    } else {
        // Regulier verloop boven de finish-grens
        await voerScoreTransactieUit(m, score, 0, false);
    }
}

window.bevestigDartsEnRekenUit = async function(mId, score, doubleDarts) {
    const m = state.matches.find(x => x.id === mId);
    const scStr = m.turn === 1 ? 'score1' : 'score2';
    const activePlayer = m.turn === 1 ? m.p1 : m.p2;
    
    let isHit = (m[scStr] - score === 0);
    
    state.stats[activePlayer].doubleAttempts += doubleDarts;
    if(isHit) state.stats[activePlayer].doubleHits += 1;

    hideModal();
    await voerScoreTransactieUit(m, score, 3, isHit);
}

async function voerScoreTransactieUit(m, score, specifiekePijlen, isCheckout) {
    const scStr = m.turn === 1 ? 'score1' : 'score2';
    const dtLegStr = m.turn === 1 ? 'dartsLeg1' : 'dartsLeg2';
    const scLegStr = m.turn === 1 ? 'scoreLeg1' : 'scoreLeg2';
    const activePlayer = m.turn === 1 ? m.p1 : m.p2;

    let pijlWorp = (isCheckout && score === m[scStr]) ? specifiekePijlen : 3;
    let berekendeScore = m[scStr] - score;

    // BUST AFHANDELING
    if (berekendeScore < 0 || berekendeScore === 1) {
        state.stats[activePlayer].totalDarts += 3; // Pijlen tellen door
        m[dtLegStr] += 3;
        wisselBeurt(m);
        await saveState(true);
        alert(`💥 BUST voor ${activePlayer}! Stand blijft ${m[scStr]}.`);
        return;
    }

    // LEG GEWONNEN
    if (berekendeScore === 0) {
        m[scStr] = 0;
        state.stats[activePlayer].totalDarts += pijlWorp;
        state.stats[activePlayer].totalScore += score;
        state.stats[activePlayer].checkouts.push(score);

        if(score === 180) state.stats[activePlayer].max180++;

        // Leg winst toekennen
        if(m.turn === 1) m.legs1++; else m.legs2++;
        
        state.stats[m.p1].legsPlayed++;
        state.stats[m.p2].legsPlayed++;

        // MATCH FINISHED (Best of 5 = 3 legs gewonen)
        if(m.legs1 === 3 || m.legs2 === 3) {
            m.status = 'finished';
            await saveState(true);
            alert(`🏆 MATCH GEWONNEN DOOR ${activePlayer.toUpperCase()}!`);
            sluitTablet();
            return;
        }

        // Leg resetten naar 501
        m.score1 = 501; m.score2 = 501;
        m.dartsLeg1 = 0; m.dartsLeg2 = 0;
        m.scoreLeg1 = 0; m.scoreLeg2 = 0;
        m.startThrower = m.startThrower === 1 ? 2 : 1;
        m.turn = m.startThrower;
        
        await saveState(true);
        return;
    }

    // NORMALE WORP
    m[scStr] = berekendeScore;
    m[dtLegStr] += 3;
    m[scLegStr] += score;

    state.stats[activePlayer].totalDarts += 3;
    state.stats[activePlayer].totalScore += score;
    if(score === 180) state.stats[activePlayer].max180++;

    wisselBeurt(m);
    await saveState(true);
}

function wisselBeurt(m) { m.turn = m.turn === 1 ? 2 : 1; }
function showModal(html) { document.getElementById('modal-content').innerHTML = html; document.getElementById('action-modal').style.display = 'flex'; }
function hideModal() { document.getElementById('action-modal').style.display = 'none'; }

// Run de applicatie
init();
