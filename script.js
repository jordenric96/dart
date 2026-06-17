// --- JOUW SUPABASE ---
const supabaseUrl = 'https://jpvgcgjnhvutqtrkbamc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdmdjZ2puaHZ1dHF0cmtiYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIxMzgsImV4cCI6MjA5NzI4ODEzOH0.edR9Ve6FOOre5DcmHDoAPSF0rIsU_DVX1KFy9pQACyI';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Stefaan", "Wim", "Tibe"];

let state = {
    matches: [],     
    standings: [],   
    stats: {},
    tickerLog: ["🚀 Welkom bij OG's Pro Darts 2026!"]
};

let currentView = 'dashboard';
let padInputString = ""; 
let carouselIndex = 0; // Voor TV roterende stats

const appContainer = document.getElementById('app-container');
const navButtons = document.querySelectorAll('.nav-btn');

// --- DATABASE & REALTIME ---
async function init() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => { navigator.serviceWorker.register('./script.js').catch(() => {}); });
    }

    const { data, error } = await supabaseClient.from('toernooi_data').select('state').eq('id', 1).single();
    if (data && data.state && Object.keys(data.state).length > 0) {
        state = data.state;
    } else {
        genereerRoundRobinSchema();
        initStatsKlassen();
        await saveState(true);
    }
    
    // Start de TV Carrousel Timer
    setInterval(() => {
        if(currentView === 'dashboard') {
            carouselIndex = (carouselIndex + 1) % 3; 
            renderDashboard(); 
        }
    }, 12000); // Verspringt elke 12 seconden

    render();
    updateTickerUI();

    supabaseClient.channel('darts-realtime').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'toernooi_data' }, (payload) => {
          state = payload.new.state;
          berekenKlassement();
          render();
          updateTickerUI();
    }).subscribe();
}

async function saveState(forceRender = false) {
    berekenKlassement();
    if (forceRender) render();
    await supabaseClient.from('toernooi_data').upsert({ id: 1, state: state });
}

function voegTickerNieuwsToe(msg) {
    state.tickerLog.unshift(msg);
    if(state.tickerLog.length > 5) state.tickerLog.pop();
}

function updateTickerUI() {
    const tickerContainer = document.getElementById('ticker-content');
    if(tickerContainer) {
        tickerContainer.innerText = state.tickerLog.join("   |   ");
    }
}

// Navigatie
navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        navButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentView = e.target.getAttribute('data-view');
        
        const topNav = document.getElementById('top-nav');
        const ticker = document.getElementById('ticker-wrap');
        
        if (currentView === 'dashboard') {
            topNav.style.display = 'flex';
            ticker.style.display = 'flex';
        } else {
            topNav.style.display = 'none';
            ticker.style.display = 'none'; // Ruimte maken op tablet
        }
        padInputString = "";
        render();
    });
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    if(prompt("Typ '1403' om alles te wissen:") === "1403") {
        genereerRoundRobinSchema();
        initStatsKlassen();
        state.tickerLog = ["🔄 Systeem Gereset. Toernooi herstart!"];
        await saveState(true);
        alert("Database gereset!");
    }
});

// --- ROUND ROBIN ALGORITME ---
function genereerRoundRobinSchema() {
    state.matches = [];
    let players = [...alleSpelers, "Bye"]; // Dummy voor even aantal
    let matchId = 1;
    
    // 7 rondes
    for (let round = 0; round < 7; round++) {
        for (let i = 0; i < 4; i++) {
            let p1 = players[i];
            let p2 = players[7 - i];
            
            if (p1 !== "Bye" && p2 !== "Bye") {
                state.matches.push({
                    id: `M${matchId++}`,
                    p1: p1, p2: p2,
                    status: 'waiting', board: null,
                    legs1: 0, legs2: 0, score1: 501, score2: 501,
                    turn: null, startThrower: null,
                    dartsLeg1: 0, dartsLeg2: 0, scoreLeg1: 0, scoreLeg2: 0
                });
            }
        }
        // Roteer spelers (houd de 1e vast)
        players.splice(1, 0, players.pop());
    }
}

function initStatsKlassen() {
    state.stats = {};
    alleSpelers.forEach(s => {
        state.stats[s] = { 
            totalDarts: 0, totalScore: 0, legsPlayed: 0, checkouts: [], 
            bullsWon: 0, max180: 0, doubleAttempts: 0, doubleHits: 0,
            shortestLeg: { darts: 999, avg: 0 }, matchAvgs: [],
            tonPlus: 0, breaks: 0, first9Score: 0, first9Darts: 0, whitewashes: 0
        };
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

// --- RENDERING ROUTER ---
function render() {
    appContainer.innerHTML = '';
    if (currentView === 'dashboard') renderDashboard();
    else renderTabletView(currentView);
}

// --- 1. TV DASHBOARD (Met Carrousel) ---
function renderDashboard() {
    const activeB1 = state.matches.find(m => m.board === 'board1' && (m.status === 'playing' || m.status === 'bullen'));
    const activeB2 = state.matches.find(m => m.board === 'board2' && (m.status === 'playing' || m.status === 'bullen'));

    // BEREKENING SUBKLASSEMENTEN (Altijd max 7)
    const top7 = (arr) => arr.sort((a,b) => b.val - a.val).slice(0,7);

    // Set 1
    let avg = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s].totalDarts > 0 ? parseFloat(((state.stats[s].totalScore / state.stats[s].totalDarts) * 3).toFixed(1)) : 0 })));
    let dblPct = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s].doubleAttempts > 0 ? Math.round((state.stats[s].doubleHits / state.stats[s].doubleAttempts)*100) : 0, txt: `${state.stats[s].doubleHits}/${state.stats[s].doubleAttempts}` })));
    let hgFin = top7(alleSpelers.map(s => ({ naam: s, val: Math.max(0, ...state.stats[s].checkouts) })));
    
    // Set 2
    let sLegs = alleSpelers.map(s => ({ naam: s, val: state.stats[s].shortestLeg.darts === 999 ? 0 : state.stats[s].shortestLeg.darts, avg: state.stats[s].shortestLeg.avg })).filter(x => x.val > 0).sort((a,b) => a.val - b.val).slice(0,7);
    let mAvg = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s].matchAvgs.length > 0 ? Math.max(...state.stats[s].matchAvgs) : 0 })));
    let f9Avg = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s].first9Darts > 0 ? parseFloat(((state.stats[s].first9Score / state.stats[s].first9Darts)*3).toFixed(1)) : 0 })));

    // Set 3
    let tons = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s].tonPlus })));
    let breaks = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s].breaks })));
    let ww = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s].whitewashes })));

    // CARROUSEL RENDERER
    let carouselHTML = '';
    if (carouselIndex === 0) {
        carouselHTML = `
            <div class="card single fade-in">
                <h2>🎯 3-DART GEMIDDELDE</h2>
                <table class="retro-table">${avg.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val.toFixed(1)}</strong></td></tr>`).join('')}</table>
            </div>
            <div class="card single fade-in">
                <h2>❌ DUBBEL PERCENTAGE</h2>
                <table class="retro-table">${dblPct.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val}%</strong> <span style="font-size:0.7em; color:#888;">(${x.txt})</span></td></tr>`).join('')}</table>
            </div>
            <div class="card single fade-in">
                <h2>🔥 HOOGSTE FINISH</h2>
                <table class="retro-table">${hgFin.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val>0?x.val:'-'}</strong></td></tr>`).join('')}</table>
            </div>`;
    } else if (carouselIndex === 1) {
        carouselHTML = `
            <div class="card single fade-in">
                <h2>⚡ KORTSTE LEG</h2>
                <table class="retro-table"><tr><th>#</th><th>Naam</th><th>Pijlen</th><th>Avg</th></tr>
                ${sLegs.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val}</strong></td><td style="color:#888;">${x.avg}</td></tr>`).join('')}
                ${sLegs.length===0?'<tr><td colspan="4">Nog geen legs gegooid</td></tr>':''}
                </table>
            </div>
            <div class="card single fade-in">
                <h2>📈 HOOGSTE MATCH AVG</h2>
                <table class="retro-table">${mAvg.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val>0?x.val.toFixed(1):'-'}</strong></td></tr>`).join('')}</table>
            </div>
            <div class="card single fade-in">
                <h2>🎯 FIRST 9-DARTS AVG</h2>
                <table class="retro-table">${f9Avg.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val.toFixed(1)}</strong></td></tr>`).join('')}</table>
            </div>`;
    } else {
        carouselHTML = `
            <div class="card single fade-in">
                <h2>💯 TON-PLUSSERS (100+)</h2>
                <table class="retro-table">${tons.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val}</strong></td></tr>`).join('')}</table>
            </div>
            <div class="card single fade-in">
                <h2>🔨 MEESTE BREAKS</h2>
                <table class="retro-table">${breaks.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val}</strong></td></tr>`).join('')}</table>
            </div>
            <div class="card single fade-in">
                <h2>🧼 WHITEWASHES (3-0)</h2>
                <table class="retro-table">${ww.map((x,i)=>`<tr><td>${i+1}</td><td style="text-align:left;">${x.naam}</td><td><strong>${x.val}</strong></td></tr>`).join('')}</table>
            </div>`;
    }

    let html = `<div class="dashboard-grid">
        <!-- Kolom 1: Live Wedstrijden -->
        <div class="grid-col">
            ${generateLiveMatchCardHTML('🎯 BORD 1', activeB1)}
            ${generateLiveMatchCardHTML('🎯 BORD 2', activeB2)}
            <div class="card" style="flex:1;">
                <h2>📋 SCHEMA & LOG</h2>
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

        <!-- Kolom 2: Hoofdklassement (Vast) -->
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

        <!-- Kolom 3: Carrousel Subklassementen -->
        <div class="grid-col" id="carousel-col">
            ${carouselHTML}
        </div>
    </div>`;
    appContainer.innerHTML = html;
}

function generateLiveMatchCardHTML(title, match) {
    if (!match) return `<div class="live-board"><h3>${title}</h3><p style="font-size:1.5rem; color:#444; margin:1.5vh 0;">Bord Vrij</p></div>`;
    if (match.status === 'bullen') return `<div class="live-board active"><h3>${title}</h3><div class="live-match-title">${match.p1} vs ${match.p2}</div><div style="color:var(--gold); font-size:1.5rem; font-weight:bold;">🐂 BULLEN VOOR START 🐂</div></div>`;
    
    let avg1 = match.dartsLeg1 > 0 ? ((match.scoreLeg1 / match.dartsLeg1) * 3).toFixed(1) : "0.0";
    let avg2 = match.dartsLeg2 > 0 ? ((match.scoreLeg2 / match.dartsLeg2) * 3).toFixed(1) : "0.0";

    return `<div class="live-board active">
        <h3>${title} <span class="live-legs" style="font-size:0.5em; background:#444; padding:2px 8px; border-radius:4px;">Leg ${match.legs1 + match.legs2 + 1}</span></h3>
        <div class="live-match-title">${match.p1} (${match.legs1}) 🆚 (${match.legs2}) ${match.p2}</div>
        <div class="live-score-row">
            <div class="live-score-val ${match.turn===1?'turn':'off'}">
                <div>${match.score1}</div>
                <div style="font-size:1rem; font-family:sans-serif; color:#aaa; font-weight:normal;">Avg: ${avg1}</div>
            </div>
            <div style="font-size:1.5rem; color:#444;">VS</div>
            <div class="live-score-val ${match.turn===2?'turn':'off'}">
                <div>${match.score2}</div>
                <div style="font-size:1rem; font-family:sans-serif; color:#aaa; font-weight:normal;">Avg: ${avg2}</div>
            </div>
        </div>
    </div>`;
}

// --- 2. TABLET APPLICATIE (Met Bord Beveiliging) ---
function renderTabletView(boardId) {
    const actieveMatch = state.matches.find(m => m.board === boardId && m.status !== 'finished');

    if (!actieveMatch) {
        let html = `<div class="tablet-view">
            <div class="top-nav" style="margin-bottom:2vh; border-radius:4px;"><div class="nav-title">KIES EEN WEDSTRIJD (${boardId.toUpperCase()})</div><button class="nav-btn active" onclick="sluitTablet()">🗙 Sluit</button></div>
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
            <h2>🐂 BULLSEYE METING 🐂</h2>
            <p>Wie smeet het dichtst bij de rode stip en mag beginnen?</p>
            <div class="modal-grid-3" style="display:flex; justify-content:center;">
                <button class="modal-btn" onclick="bevestigBullenWinnaar('${actieveMatch.id}', 1)">${actieveMatch.p1}</button>
                <button class="modal-btn" onclick="bevestigBullenWinnaar('${actieveMatch.id}', 2)">${actieveMatch.p2}</button>
            </div>
            <button class="retro-button danger" style="margin-top:20px;" onclick="annuleerLopendeMatch('${actieveMatch.id}')">Annuleer Match</button>
        `);
        return;
    }

    if (actieveMatch.status === 'playing') {
        hideModal();
        let legAvg1 = actieveMatch.dartsLeg1 > 0 ? ((actieveMatch.scoreLeg1 / actieveMatch.dartsLeg1) * 3).toFixed(1) : "0.0";
        let legAvg2 = actieveMatch.dartsLeg2 > 0 ? ((actieveMatch.scoreLeg2 / actieveMatch.dartsLeg2) * 3).toFixed(1) : "0.0";

        let html = `<div class="tablet-view">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1vh;">
                <span style="font-size:1.8rem; font-weight:bold; color:var(--gold); font-family:'Oswald', sans-serif;">${boardId.toUpperCase()} - BEST OF 5</span>
                <button class="retro-button danger" onclick="annuleerLopendeMatch('${actieveMatch.id}')">Afbreken</button>
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

                <!-- STATISCH NUMPAD -->
                <div class="numpad-container">
                    <div class="numpad-field" id="pad-screen">${padInputString || "0"}</div>
                    <button class="pre" onclick="numpadDrukPref(100)">100</button>
                    <button class="pre" onclick="numpadDrukPref(60)">60</button>
                    <button class="pre" onclick="numpadDrukPref(40)">40</button>
                    <button class="pre" onclick="numpadDrukPref(26)">26</button>

                    <button onclick="numpadDrukCijfer(1)">1</button><button onclick="numpadDrukCijfer(2)">2</button><button onclick="numpadDrukCijfer(3)">3</button>
                    <button class="clear" onclick="numpadWissen()">⌫</button>

                    <button onclick="numpadDrukCijfer(4)">4</button><button onclick="numpadDrukCijfer(5)">5</button><button onclick="numpadDrukCijfer(6)">6</button>
                    <button class="action" style="grid-row: span 2;" onclick="verwerkIngevuldeScore('${actieveMatch.id}')">ENTER</button>

                    <button onclick="numpadDrukCijfer(7)">7</button><button onclick="numpadDrukCijfer(8)">8</button><button onclick="numpadDrukCijfer(9)">9</button>
                    <button style="grid-column: span 3;" onclick="numpadDrukCijfer(0)">0</button>
                </div>
            </div>
        </div>`;
        appContainer.innerHTML = html;
    }
}

// --- NUMPAD ---
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

// --- BEVEILIGING & SCORE ENGINE ---
window.koppelMatchAanBord = async function(mId, boardId) {
    const mToStart = state.matches.find(x => x.id === mId);
    
    // BEVEILIGING: Check of speler niet toevallig al op het andere bord staat
    const isPlaying = state.matches.some(m => 
        m.status !== 'waiting' && m.status !== 'finished' && m.id !== mId &&
        (m.p1 === mToStart.p1 || m.p2 === mToStart.p1 || m.p1 === mToStart.p2 || m.p2 === mToStart.p2)
    );
    if(isPlaying) {
        alert("⚠️ Eén van deze spelers is al bezig op het andere bord!");
        return;
    }

    mToStart.board = boardId; mToStart.status = 'bullen';
    await saveState(true);
};

window.annuleerLopendeMatch = async function(mId) {
    if(confirm("Partij definitief annuleren?")) {
        const m = state.matches.find(x => x.id === mId);
        m.status = 'waiting'; m.board = null; m.legs1 = 0; m.legs2 = 0; m.score1 = 501; m.score2 = 501;
        m.dartsLeg1 = 0; m.dartsLeg2 = 0; m.scoreLeg1 = 0; m.scoreLeg2 = 0;
        await saveState(true);
    }
}

window.bevestigBullenWinnaar = async function(mId, pNum) {
    const m = state.matches.find(x => x.id === mId);
    const winNaam = pNum === 1 ? m.p1 : m.p2;
    state.stats[winNaam].bullsWon++;
    m.status = 'playing'; m.startThrower = pNum; m.turn = pNum;
    voegTickerNieuwsToe(`🎯 ${m.p1} en ${m.p2} zijn begonnen. ${winNaam} won de bull!`);
    await saveState(true);
}

window.sluitTablet = function() {
    document.getElementById('top-nav').style.display = 'flex';
    document.getElementById('ticker-wrap').style.display = 'flex';
    currentView = 'dashboard';
    render();
}

window.verwerkIngevuldeScore = async function(mId) {
    let score = parseInt(padInputString) || 0;
    padInputString = ""; 

    if (score < 0 || score > 180) { alert("Ongeldige score (0-180)!"); return; }

    const m = state.matches.find(x => x.id === mId);
    const scStr = m.turn === 1 ? 'score1' : 'score2';
    const activePlayer = m.turn === 1 ? m.p1 : m.p2;
    const oldScore = m[scStr];
    let newScore = oldScore - score;

    // DUBBEL TRACKING (Vraag om darts op dubbel)
    if (oldScore <= 170) {
        let isHit = (newScore === 0);
        showModal(`
            <h2>❌ DUBBEL POGINGEN (${oldScore} over)</h2>
            <p>Hoeveel pijlen gooide <b>${activePlayer}</b> zojuist richting de dubbel?</p>
            <div class="modal-grid-3">
                ${!isHit ? `<button class="modal-btn" onclick="bevestigDarts('${m.id}', ${score}, 0, false)">0 Darts</button>` : ''}
                <button class="modal-btn" onclick="bevestigDarts('${m.id}', ${score}, 1, ${isHit})">1 Dart</button>
                <button class="modal-btn" onclick="bevestigDarts('${m.id}', ${score}, 2, ${isHit})">2 Darts</button>
                <button class="modal-btn" onclick="bevestigDarts('${m.id}', ${score}, 3, ${isHit})">3 Darts</button>
            </div>
        `);
    } else {
        await verwerkWorp(m, score, 0, false);
    }
}

window.bevestigDarts = async function(mId, score, doubleDarts, isHit) {
    const m = state.matches.find(x => x.id === mId);
    const activePlayer = m.turn === 1 ? m.p1 : m.p2;
    
    state.stats[activePlayer].doubleAttempts += doubleDarts;
    if(isHit) state.stats[activePlayer].doubleHits += 1;

    hideModal();
    // Als hit: gebruikte pijlen = specifieke darts. Als mis: 3.
    let pijlWorp = isHit ? doubleDarts : 3; 
    await verwerkWorp(m, score, pijlWorp, isHit);
}

async function verwerkWorp(m, score, pijlWorpBerekend, isCheckout) {
    const scStr = m.turn === 1 ? 'score1' : 'score2';
    const dtLegStr = m.turn === 1 ? 'dartsLeg1' : 'dartsLeg2';
    const scLegStr = m.turn === 1 ? 'scoreLeg1' : 'scoreLeg2';
    const activePlayer = m.turn === 1 ? m.p1 : m.p2;

    let berekendeScore = m[scStr] - score;
    let pijlenDezeBeurt = (isCheckout) ? pijlWorpBerekend : 3;

    // First 9 Darts Check
    if (m[dtLegStr] < 9) {
        let dartsLeft = 9 - m[dtLegStr];
        let dartsToCount = Math.min(dartsLeft, pijlenDezeBeurt);
        state.stats[activePlayer].first9Darts += dartsToCount;
        // Ruwe schatting scoretoevoeging voor first 9
        state.stats[activePlayer].first9Score += (score * (dartsToCount/3)); 
    }

    // BUST
    if (berekendeScore < 0 || berekendeScore === 1) {
        state.stats[activePlayer].totalDarts += 3;
        m[dtLegStr] += 3;
        wisselBeurt(m);
        await saveState(true);
        setTimeout(() => alert("💥 BUST!"), 50);
        return;
    }

    // LEG GEWONNEN
    if (berekendeScore === 0) {
        m[scStr] = 0;
        state.stats[activePlayer].totalDarts += pijlenDezeBeurt;
        state.stats[activePlayer].totalScore += score;
        state.stats[activePlayer].checkouts.push(score);
        
        m[dtLegStr] += pijlenDezeBeurt;
        m[scLegStr] += score;

        if(score === 180) { state.stats[activePlayer].max180++; voegTickerNieuwsToe(`🔥 BOOM! 180 voor ${activePlayer}!`); }
        if(score >= 100) state.stats[activePlayer].tonPlus++;

        // Shortest Leg Update
        let legAvg = ((m[scLegStr] / m[dtLegStr]) * 3).toFixed(1);
        if (m[dtLegStr] < state.stats[activePlayer].shortestLeg.darts) {
            state.stats[activePlayer].shortestLeg = { darts: m[dtLegStr], avg: legAvg };
        }

        // Break Update
        if (m.turn !== m.startThrower) {
            state.stats[activePlayer].breaks++;
            voegTickerNieuwsToe(`🔨 ${activePlayer} plaatst een break tegen ${m.turn===1?m.p2:m.p1}!`);
        } else {
            voegTickerNieuwsToe(`🎯 ${activePlayer} pakt de leg in ${m[dtLegStr]} pijlen (${score} finish).`);
        }

        if(m.turn === 1) m.legs1++; else m.legs2++;
        state.stats[m.p1].legsPlayed++; state.stats[m.p2].legsPlayed++;

        // MATCH GEWONNEN
        if(m.legs1 === 3 || m.legs2 === 3) {
            m.status = 'finished';
            
            // Match Avg berekenen
            let mAvg1 = ((state.stats[m.p1].totalScore / state.stats[m.p1].totalDarts)*3).toFixed(1);
            let mAvg2 = ((state.stats[m.p2].totalScore / state.stats[m.p2].totalDarts)*3).toFixed(1);
            state.stats[m.p1].matchAvgs.push(parseFloat(mAvg1));
            state.stats[m.p2].matchAvgs.push(parseFloat(mAvg2));

            // Whitewash Check
            if (m.legs1 === 0 || m.legs2 === 0) {
                state.stats[activePlayer].whitewashes++;
                voegTickerNieuwsToe(`🧼 WHITEWASH! ${activePlayer} vernietigt de tegenstander met 3-0!`);
            } else {
                voegTickerNieuwsToe(`🏆 MATCHWINST: ${activePlayer} wint met ${m.legs1}-${m.legs2}.`);
            }

            await saveState(true);
            alert(`🏆 MATCH GEWONNEN DOOR ${activePlayer.toUpperCase()}!`);
            sluitTablet();
            return;
        }

        m.score1 = 501; m.score2 = 501;
        m.dartsLeg1 = 0; m.dartsLeg2 = 0; m.scoreLeg1 = 0; m.scoreLeg2 = 0;
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
    if(score >= 100) state.stats[activePlayer].tonPlus++;
    if(score === 180) { state.stats[activePlayer].max180++; voegTickerNieuwsToe(`🔥 180! Briljante score van ${activePlayer}!`); }

    wisselBeurt(m);
    await saveState(true);
}

function wisselBeurt(m) { m.turn = m.turn === 1 ? 2 : 1; }
function showModal(html) { document.getElementById('modal-content').innerHTML = html; document.getElementById('action-modal').style.display = 'flex'; }
function hideModal() { document.getElementById('action-modal').style.display = 'none'; }

// START THE ENGINE
init();
