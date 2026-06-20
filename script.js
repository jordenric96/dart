// --- JOUW SUPABASE ---
const supabaseUrl = 'https://jpvgcgjnhvutqtrkbamc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdmdjZ2puaHZ1dHF0cmtiYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIxMzgsImV4cCI6MjA5NzI4ODEzOH0.edR9Ve6FOOre5DcmHDoAPSF0rIsU_DVX1KFy9pQACyI';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Stefaan", "Wim", "Tibe"];

let state = { matches: [], standings: [], stats: {}, records: null, lastOverlay: null };
let currentView = 'dashboard';
let padInputString = ""; 
let windowLastOverlayTime = 0;
let logboekIndex = 0;
let statsPage = 0;
let dashboardTimerMs = 0; 

const appContainer = document.getElementById('app-container');
const navButtons = document.querySelectorAll('.nav-btn');

if (!document.getElementById('finish-overlay')) {
    let ov = document.createElement('div');
    ov.id = 'finish-overlay';
    ov.innerHTML = `<div class="finish-title" id="fo-title">CHECKOUT</div><div class="finish-name" id="fo-name"></div><div class="finish-score" id="fo-score"></div>`;
    document.body.appendChild(ov);
}

// --- KNOPPEN TOEVOEGEN ---
const navContainer = document.querySelector('.nav-buttons');
if (navContainer && !document.getElementById('export-btn')) {
    let rekBtn = document.createElement('button');
    rekBtn.id = 'rekening-btn';
    rekBtn.className = 'nav-btn';
    rekBtn.innerText = '💶 REKENING';
    rekBtn.onclick = () => openRekeningModal();
    navContainer.appendChild(rekBtn);

    let exportBtn = document.createElement('button');
    exportBtn.id = 'export-btn';
    exportBtn.className = 'nav-btn';
    exportBtn.innerText = '📋 EXPORT';
    exportBtn.onclick = () => openExportModal();
    navContainer.appendChild(exportBtn);
}

function formatTime(ms) {
    if (!ms || ms < 0) return "00:00";
    let totalSeconds = Math.floor(ms / 1000);
    let m = Math.floor(totalSeconds / 60);
    let s = totalSeconds % 60;
    return `${m < 10 ? '0':''}${m}:${s < 10 ? '0':''}${s}`;
}
function formatTimeLong(ms) {
    if (!ms || ms < 0) return "00:00:00";
    let totalSeconds = Math.floor(ms / 1000);
    let h = Math.floor(totalSeconds / 3600);
    let m = Math.floor((totalSeconds % 3600) / 60);
    let s = totalSeconds % 60;
    return `${h > 0 ? (h + ':') : ''}${m < 10 ? '0':''}${m}:${s < 10 ? '0':''}${s}`;
}

// --- DYNAMISCHE RECORD EXTRACTOR DIE DATA HERSTELT ---
window.getAbsoluteRecords = function() {
    let r = {
        hs: { speler: '-', val: 0 },
        hf: { speler: '-', val: 0 },
        sl: { speler: '-', val: 999 },
        tma: { speler: '-', val: 0 },
        flt: { speler: '-', val: 99999999 },
        fmt: { speler: '-', val: 99999999 }
    };

    alleSpelers.forEach(s => {
        let st = state.stats[s];
        if (!st) return;
        
        let p_hs = st.highestScore || 0;
        if (st.highScores && st.highScores.length > 0) p_hs = Math.max(p_hs, ...st.highScores);
        if (p_hs > r.hs.val) r.hs = { speler: s, val: p_hs };

        let p_hf = st.checkouts && st.checkouts.length > 0 ? Math.max(...st.checkouts) : 0;
        if (p_hf > r.hf.val) r.hf = { speler: s, val: p_hf };

        if (st.shortestLeg && st.shortestLeg.darts < r.sl.val && st.shortestLeg.darts > 0) {
            r.sl = { speler: s, val: st.shortestLeg.darts };
        }

        let p_tma = st.matchAvgs && st.matchAvgs.length > 0 ? Math.max(...st.matchAvgs) : 0;
        if (p_tma > r.tma.val) r.tma = { speler: s, val: p_tma };
    });

    if (state.completedLegs && state.completedLegs.length > 0) {
        let validLegs = state.completedLegs.filter(l => l.time > 3000);
        if (validLegs.length > 0) {
            let bestL = validLegs.reduce((p, c) => (c.time < p.time ? c : p));
            r.flt = { speler: bestL.winner, val: bestL.time };
        }
    }
    
    if (state.completedMatches && state.completedMatches.length > 0) {
        let validMatches = state.completedMatches.filter(m => m.time > 5000);
        if (validMatches.length > 0) {
            let bestM = validMatches.reduce((p, c) => (c.time < p.time ? c : p));
            r.fmt = { speler: bestM.winner, val: bestM.time };
        }
    }
    return r;
}

async function init() {
    try {
        const { data, error } = await supabaseClient.from('toernooi_data').select('state').eq('id', 1).single();
        
        if (data && data.state && Object.keys(data.state).length > 0) {
            state = data.state;
            if (state.lastOverlay) windowLastOverlayTime = state.lastOverlay.time;
            
            if (!state.records || Array.isArray(state.records) || !state.records.highestCheckout || typeof state.records.highestCheckout !== 'object') {
                state.records = {
                    highestCheckout: { val: 0, speler: '-' },
                    shortestLeg: { val: 999, speler: '-' },
                    highestMatchAvg: { val: 0, speler: '-' },
                    highestScore: { val: 0, speler: '-' },
                    fastestLegTime: { val: 99999999, speler: '-' },
                    fastestMatchTime: { val: 99999999, speler: '-' }
                };
            }
            if (!state.records.highestScore || typeof state.records.highestScore !== 'object') state.records.highestScore = { val: 0, speler: '-' };
            if (!state.records.fastestLegTime || typeof state.records.fastestLegTime !== 'object') state.records.fastestLegTime = { val: 99999999, speler: '-' };
            if (!state.records.fastestMatchTime || typeof state.records.fastestMatchTime !== 'object') state.records.fastestMatchTime = { val: 99999999, speler: '-' };

            if (!state.completedLegs) state.completedLegs = [];
            if (!state.completedMatches) state.completedMatches = [];
            if (!state.tournamentStartTime) state.tournamentStartTime = null;

            alleSpelers.forEach(s => {
                if(!state.stats[s]) state.stats[s] = {};
                state.stats[s].shortestLeg = state.stats[s].shortestLeg || { darts: 999, avg: 0 };
                state.stats[s].matchAvgs = state.stats[s].matchAvgs || [];
                state.stats[s].tonPlus = state.stats[s].tonPlus || 0;
                state.stats[s].breaks = state.stats[s].breaks || 0;
                state.stats[s].first9Score = state.stats[s].first9Score || 0;
                state.stats[s].first9Darts = state.stats[s].first9Darts || 0;
                state.stats[s].bullsWon = state.stats[s].bullsWon || 0;
                if (!state.stats[s].highScores) state.stats[s].highScores = [];
                if (!state.stats[s].checkouts) state.stats[s].checkouts = [];
            });

            state.matches.forEach(m => {
                if (!m.fase) m.fase = 'poule';
                if (m.matchDarts1 === undefined) m.matchDarts1 = 0;
                if (m.matchScore1 === undefined) m.matchScore1 = 0;
                if (m.matchDarts2 === undefined) m.matchDarts2 = 0;
                if (m.matchScore2 === undefined) m.matchScore2 = 0;
                if (m.status === 'playing') {
                    if (!m.matchStartTime) m.matchStartTime = Date.now();
                    if (!m.legStartTime) m.legStartTime = Date.now();
                }
            });

            if (!state.matches.some(m => m.id === 'HF1')) {
                state.matches.push(maakMatchObj('HF1', '1e Plaats', '4e Plaats', 'HF'));
                state.matches.push(maakMatchObj('HF2', '2e Plaats', '3e Plaats', 'HF'));
                state.matches.push(maakMatchObj('FIN', 'Winnaar HF1', 'Winnaar HF2', 'FIN'));
            }
        } else {
            genereerRoundRobinSchema();
            initStatsKlassen();
            await saveState(true);
        }
        
        setInterval(() => {
            if(currentView === 'dashboard') {
                dashboardTimerMs += 100;
                
                document.querySelectorAll('.live-timer-match').forEach(el => {
                    let start = parseInt(el.getAttribute('data-start'));
                    if(start) el.innerText = formatTime(Date.now() - start);
                });
                document.querySelectorAll('.live-timer-leg').forEach(el => {
                    let start = parseInt(el.getAttribute('data-start'));
                    if(start) el.innerText = formatTime(Date.now() - start);
                });
                document.querySelectorAll('.live-timer-tourney').forEach(el => {
                    let start = parseInt(el.getAttribute('data-start'));
                    if(start) el.innerText = formatTimeLong(Date.now() - start);
                });

                if (dashboardTimerMs % 10000 === 0) {
                    logboekIndex = (logboekIndex + 1) % 3;
                    updateLogboekOnly();
                }
                
                if (dashboardTimerMs % 15000 === 0) {
                    statsPage = (statsPage + 1) % 3;
                    updateDashboardData();
                }

                let bar = document.getElementById('stats-timer-bar');
                if (bar) {
                    let perc = ((dashboardTimerMs % 15000) / 15000) * 100;
                    bar.style.width = perc + '%';
                }
            }
        }, 100);

        render();

        supabaseClient.channel('darts-realtime').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'toernooi_data' }, (payload) => {
              state = payload.new.state;
              berekenKlassement();
              checkOverlayTrigger();
              render(); 
        }).subscribe();
        
    } catch (e) { console.error("Fout bij laden:", e); }
}

async function saveState(forceRender = false) {
    berekenKlassement();
    if (forceRender) render();
    await supabaseClient.from('toernooi_data').upsert({ id: 1, state: state });
}

function checkOverlayTrigger() {
    if (state.lastOverlay && state.lastOverlay.time !== windowLastOverlayTime) {
        let isRecord = state.lastOverlay.title.includes('RECORD');
        if (isRecord && currentView !== 'dashboard') {
            // Tablets negeren full screen record meldingen
        } else {
            triggerOverlay(state.lastOverlay.title, state.lastOverlay.name, state.lastOverlay.subtitle);
        }
        windowLastOverlayTime = state.lastOverlay.time;
    }
}

function triggerOverlay(title, name, subtitle) {
    const ov = document.getElementById('finish-overlay');
    document.getElementById('fo-title').innerText = title;
    document.getElementById('fo-name').innerText = name;
    document.getElementById('fo-score').innerText = subtitle;
    ov.classList.add('show');
    setTimeout(() => ov.classList.remove('show'), 5000);
}

function updateNavButtons() {
    const b1Active = state.matches.some(m => m.board === 'board1' && m.status !== 'finished' && m.status !== 'waiting');
    const b2Active = state.matches.some(m => m.board === 'board2' && m.status !== 'finished' && m.status !== 'waiting');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        let view = btn.getAttribute('data-view');
        if (view === 'board1') {
            if (b1Active && localStorage.getItem('myBoard') !== 'board1') {
                btn.classList.add('locked-board-btn');
                btn.innerHTML = '🔒 BORD 1';
            } else {
                btn.classList.remove('locked-board-btn');
                btn.innerHTML = '🎯 BORD 1';
            }
        }
        if (view === 'board2') {
            if (b2Active && localStorage.getItem('myBoard') !== 'board2') {
                btn.classList.add('locked-board-btn');
                btn.innerHTML = '🔒 BORD 2';
            } else {
                btn.classList.remove('locked-board-btn');
                btn.innerHTML = '🎯 BORD 2';
            }
        }
    });
}

navButtons.forEach(btn => {
    btn.onclick = (e) => {
        let targetView = e.target.getAttribute('data-view');
        
        if (targetView === 'board1' || targetView === 'board2') {
            const isActive = state.matches.some(m => m.board === targetView && m.status !== 'finished' && m.status !== 'waiting');
            if (isActive && localStorage.getItem('myBoard') !== targetView) {
                if(prompt(`Dit bord is in gebruik! Typ '1403' om over te nemen (bijv. na een crash):`) !== "1403") {
                    return; 
                } else {
                    localStorage.setItem('myBoard', targetView);
                }
            } else if (!isActive) {
                localStorage.setItem('myBoard', targetView);
            }
        }

        navButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentView = targetView;
        
        const topNav = document.getElementById('top-nav') || document.querySelector('.top-nav');
        if (currentView === 'dashboard') {
            if(topNav) topNav.style.display = 'flex';
        } else {
            if(topNav) topNav.style.display = 'none';
        }
        
        padInputString = "";
        appContainer.innerHTML = ''; 
        render();
    };
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    if(prompt("Typ '1403' om alles te wissen:") === "1403") {
        genereerRoundRobinSchema();
        initStatsKlassen();
        await saveState(true);
        appContainer.innerHTML = '';
        render();
        alert("Systeem gereset!");
    }
});

function maakMatchObj(id, p1, p2, fase) {
    return {
        id: id, p1: p1, p2: p2, fase: fase, status: 'waiting', board: null,
        legs1: 0, legs2: 0, score1: 501, score2: 501, turn: null, startThrower: null,
        dartsLeg1: 0, dartsLeg2: 0, scoreLeg1: 0, scoreLeg2: 0,
        matchDarts1: 0, matchScore1: 0, matchDarts2: 0, matchScore2: 0,
        matchStartTime: null, legStartTime: null
    };
}

function genereerRoundRobinSchema() {
    state.matches = [];
    let players = [...alleSpelers, "Bye"]; 
    let matchId = 1;
    for (let round = 0; round < 7; round++) {
        for (let i = 0; i < 4; i++) {
            let p1 = players[i], p2 = players[7 - i];
            if (p1 !== "Bye" && p2 !== "Bye") state.matches.push(maakMatchObj(`M${matchId++}`, p1, p2, 'poule'));
        }
        players.splice(1, 0, players.pop());
    }
    state.matches.push(maakMatchObj('HF1', '1e Plaats', '4e Plaats', 'HF'));
    state.matches.push(maakMatchObj('HF2', '2e Plaats', '3e Plaats', 'HF'));
    state.matches.push(maakMatchObj('FIN', 'Winnaar HF1', 'Winnaar HF2', 'FIN'));
}

function initStatsKlassen() {
    state.stats = {};
    state.records = {
        highestCheckout: { val: 0, speler: '-' },
        shortestLeg: { val: 999, speler: '-' },
        highestMatchAvg: { val: 0, speler: '-' },
        highestScore: { val: 0, speler: '-' },
        fastestLegTime: { val: 99999999, speler: '-' },
        fastestMatchTime: { val: 99999999, speler: '-' }
    };
    state.completedLegs = [];
    state.completedMatches = [];
    state.tournamentStartTime = null;
    alleSpelers.forEach(s => {
        state.stats[s] = { 
            totalDarts: 0, totalScore: 0, legsPlayed: 0, checkouts: [], 
            bullsWon: 0, doubleAttempts: 0, doubleHits: 0,
            shortestLeg: { darts: 999, avg: 0 }, matchAvgs: [],
            tonPlus: 0, breaks: 0, first9Score: 0, first9Darts: 0, highScores: []
        };
    });
}

function berekenKlassement() {
    let standings = alleSpelers.map(speler => ({ naam: speler, pt: 0, w: 0, v: 0, legsV: 0, legsT: 0, saldo: 0 }));
    
    state.matches.filter(m => m.fase === 'poule' && (m.status === 'finished' || m.status === 'post_match')).forEach(m => {
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

    let pouleFinished = state.matches.filter(m => m.fase === 'poule').every(m => m.status === 'finished' || m.status === 'post_match');
    let hf1 = state.matches.find(m => m.id === 'HF1');
    let hf2 = state.matches.find(m => m.id === 'HF2');
    let fin = state.matches.find(m => m.id === 'FIN');

    if (pouleFinished && standings.length >= 4) {
        if (hf1 && hf1.status === 'waiting' && hf1.p1 === '1e Plaats') { hf1.p1 = standings[0].naam; hf1.p2 = standings[3].naam; }
        if (hf2 && hf2.status === 'waiting' && hf2.p1 === '2e Plaats') { hf2.p1 = standings[1].naam; hf2.p2 = standings[2].naam; }
    }

    if (hf1 && (hf1.status === 'finished' || hf1.status === 'post_match') && hf2 && (hf2.status === 'finished' || hf2.status === 'post_match')) {
        if (fin && fin.status === 'waiting' && fin.p1 === 'Winnaar HF1') {
            fin.p1 = hf1.legs1 > hf1.legs2 ? hf1.p1 : hf1.p2;
            fin.p2 = hf2.legs1 > hf2.legs2 ? hf2.p1 : hf2.p2;
        }
    }
}

function render() {
    if (currentView === 'dashboard') {
        if(!document.getElementById('dashboard-wrapper')) buildDashboardSkeleton();
        updateDashboardData();
    } else {
        if(!document.getElementById('tablet-wrapper')) buildTabletSkeleton(currentView);
        updateTabletData(currentView);
    }
    updateNavButtons(); 
}

function buildDashboardSkeleton() {
    let html = `
    <div id="dashboard-wrapper" class="dashboard-layout">
        <div class="dashboard-top">
            <div class="grid-col">
                <div class="live-board" id="tv-b1" style="flex: 1.2;"></div>
                <div class="live-board" id="tv-b2" style="flex: 1.2;"></div>
                <div class="card" style="flex: 1.5; justify-content: space-between;">
                    <h2 id="logboek-title">📋 SCHEMA (P. 1/3)</h2>
                    <div id="tv-logboek-content" style="display:flex; flex-direction:column; justify-content:space-evenly; height:100%;"></div>
                </div>
            </div>
            
            <div class="grid-col">
                <div class="card" style="flex: 2.1;">
                    <h2>🏆 ALGEMEEN KLASSEMENT</h2>
                    <table class="retro-table">
                        <thead><tr><th style="width:35%; text-align:left;">Naam</th><th>W</th><th>V</th><th>LV</th><th>LT</th><th>PT</th><th>Saldo</th></tr></thead>
                        <tbody id="tv-standings"></tbody>
                    </table>
                </div>
                <div class="card silver-card" style="flex: 1;">
                    <h2>🥈 HALVE FINALES</h2>
                    <div style="flex: 1; display:flex; flex-direction: column; justify-content: space-around;" id="tv-semi-finals"></div>
                </div>
                <div class="card gold-card" style="flex: 0.8;">
                    <h2>🏆 DE FINALE</h2>
                    <div style="flex: 1; display:flex; flex-direction: column; justify-content: space-around;" id="tv-finals"></div>
                </div>
            </div>
            
            <div class="grid-col" style="position:relative;">
                <div class="stats-progress-container"><div class="stats-progress-fill" id="stats-timer-bar"></div></div>
                <div class="stats-grid" id="tv-stats-grid">
                    ${[1,2,3,4,5,6].map(i => `<div class="stat-box" id="sb-${i}"></div>`).join('')}
                </div>
            </div>
        </div>
    </div>`;
    appContainer.innerHTML = html;
}

function generateTVBoardHTML(match) {
    if (!match) return `<div style="flex:1; display:flex; align-items:center; justify-content:center; font-size:2.5rem; color:#444; font-weight:bold; font-family:'Oswald', sans-serif;">BORD VRIJ</div>`;
    
    if (match.status === 'bullen') return `<div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;"><div class="live-match-title" style="font-size:2rem; font-weight:bold; margin-bottom:10px;">${match.p1} VS ${match.p2}</div><div style="color:var(--gold); font-size:1.5rem; font-weight:bold;">🐂 BULLEN VOOR START 🐂</div></div>`;
    
    if (match.status === 'post_match') {
        let mAvg1 = match.matchDarts1 > 0 ? ((match.matchScore1 / match.matchDarts1) * 3).toFixed(2) : "0.00";
        let mAvg2 = match.matchDarts2 > 0 ? ((match.matchScore2 / match.matchDarts2) * 3).toFixed(2) : "0.00";
        return `
            <h3 style="color:var(--gold); display:flex; justify-content:center; margin-top:0;">📊 MATCH STATS</h3>
            <div style="display:flex; justify-content:space-around; align-items:center; flex:1; text-transform:uppercase;">
                <div style="text-align:center;">
                    <h2 style="color:var(--gold); font-size:2.2rem; margin:0;">${match.p1}</h2>
                    <div style="font-size:1.2rem; color:#fff;">LEGS: ${match.legs1}</div>
                    <div style="font-size:1.2rem; color:#fff;">AVG: ${mAvg1}</div>
                    <div style="font-size:1rem; color:#aaa;">Pijlen: ${match.matchDarts1}</div>
                </div>
                <div style="text-align:center;">
                    <h2 style="color:var(--gold); font-size:2.2rem; margin:0;">${match.p2}</h2>
                    <div style="font-size:1.2rem; color:#fff;">LEGS: ${match.legs2}</div>
                    <div style="font-size:1.2rem; color:#fff;">AVG: ${mAvg2}</div>
                    <div style="font-size:1rem; color:#aaa;">Pijlen: ${match.matchDarts2}</div>
                </div>
            </div>`;
    }

    let avg1 = match.matchDarts1 > 0 ? ((match.matchScore1 / match.matchDarts1) * 3).toFixed(2) : "0.00";
    let avg2 = match.matchDarts2 > 0 ? ((match.matchScore2 / match.matchDarts2) * 3).toFixed(2) : "0.00";
    let matchFase = match.fase === 'poule' ? 'Best of 5' : 'Best of 7';

    let active1 = match.turn === 1 ? 'turn-active' : 'turn-inactive';
    let active2 = match.turn === 2 ? 'turn-active' : 'turn-inactive';

    let mom1 = Math.min(100, (match.dartsLeg1 / 24) * 100); 
    let mom2 = Math.min(100, (match.dartsLeg2 / 24) * 100); 

    let timerHTML = `<span style="font-size:0.8em; color:var(--gold);">M: <span class="live-timer-match" data-start="${match.matchStartTime}">00:00</span> | L: <span class="live-timer-leg" data-start="${match.legStartTime}">00:00</span></span>`;

    return `
        <h3 style="margin-top:0;">
            <span style="font-size:0.7em; background:#444; padding:4px 10px; border-radius:4px;">${matchFase} | Leg ${match.legs1 + match.legs2 + 1}</span>
            ${timerHTML}
        </h3>
        <div class="live-score-row">
            <div class="player-col ${active1}">
                <div class="p-name">${match.p1}</div>
                <div class="p-legs">Legs: ${match.legs1} | Pijlen: ${match.dartsLeg1}</div>
                <div class="p-score">${match.score1}</div>
                <div class="momentum-container"><div class="momentum-fill" style="width:${mom1}%"></div></div>
                <div class="p-avg">M-Avg: ${avg1}</div>
            </div>
            <div style="display:flex; align-items:center; font-size:1.5rem; color:#444;">VS</div>
            <div class="player-col ${active2}">
                <div class="p-name">${match.p2}</div>
                <div class="p-legs">Legs: ${match.legs2} | Pijlen: ${match.dartsLeg2}</div>
                <div class="p-score">${match.score2}</div>
                <div class="momentum-container"><div class="momentum-fill" style="width:${mom2}%"></div></div>
                <div class="p-avg">M-Avg: ${avg2}</div>
            </div>
        </div>`;
}

function updateLogboekOnly() {
    let titleEl = document.getElementById('logboek-title');
    let contentEl = document.getElementById('tv-logboek-content');
    if(!contentEl) return;

    titleEl.innerText = `📋 SCHEMA (P. ${logboekIndex + 1}/3)`;
    
    let pouleM = state.matches.filter(m => m.fase === 'poule');
    let startIdx = logboekIndex * 7;
    let currentM = pouleM.slice(startIdx, startIdx + 7);

    contentEl.innerHTML = currentM.map(m => {
        let p1Cls = "", p2Cls = "", label = "Wacht", itemCls = "";
        if (m.status === 'playing') { label = `B${m.board === 'board1' ? 1 : 2}`; itemCls = "bezig"; }
        else if (m.status === 'bullen') { label = "Bullen"; itemCls = "bullen"; }
        else if (m.status === 'finished' || m.status === 'post_match') { 
            label = `${m.legs1} - ${m.legs2}`; 
            itemCls = "klaar"; 
            if(m.legs1 > m.legs2) p1Cls = "winner-text";
            else if(m.legs2 > m.legs1) p2Cls = "winner-text";
        }

        return `<div class="poule-item ${itemCls}">
            <span style="flex:1; text-align:right;" class="${p1Cls}">${m.p1}</span>
            <span style="padding:0 8px; font-weight:normal; color:#555;">v</span>
            <span style="flex:1; text-align:left;" class="${p2Cls}">${m.p2}</span>
            <span style="width: 50px; text-align:right;">${label}</span>
        </div>`;
    }).join('');
}

function updateDashboardData() {
    const finMatch = state.matches.find(m => m.id === 'FIN');
    const isTourneyOver = finMatch && (finMatch.status === 'finished' || finMatch.status === 'post_match');

    if (isTourneyOver) {
        let winnerNaam = finMatch.legs1 > finMatch.legs2 ? finMatch.p1 : finMatch.p2;
        let b1El = document.getElementById('tv-b1');
        let b2El = document.getElementById('tv-b2');
        let absRec = getAbsoluteRecords();
        
        if (b1El) {
            b1El.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:15px; background: linear-gradient(135deg, #1a1510 0%, #0b0c10 100%); border: 3px solid var(--gold); border-radius: 12px; box-shadow: 0 0 25px var(--gold-glow);">
                    <h3 style="color:var(--gold); font-size:2.2rem; margin:0; text-transform:uppercase; text-shadow:0 0 10px var(--gold-glow); font-family:'Oswald', sans-serif;">🏆 PROFICIAT 🏆</h3>
                    <div style="color:#fff; font-size:4.5rem; font-weight:bold; font-family:'Oswald', sans-serif; text-transform:uppercase; margin:20px 0; text-shadow: 0 0 30px var(--gold); text-align:center; line-height:1.1;">${winnerNaam}</div>
                    <div style="color:var(--border); font-size:1.4rem; letter-spacing:2px; font-weight:bold; text-align:center;">KAMPIOEN VAN HET TOERNOOI</div>
                </div>
            `;
            b1El.classList.add('active');
        }
        if (b2El) {
            b2El.innerHTML = `
                <div style="flex:1; display:flex; flex-direction:column; padding:15px; background:var(--bg-dim); border: 2px solid #333; border-radius: 12px; justify-content: space-around;">
                    <h3 style="color:var(--gold); font-size:1.3rem; margin:0 0 5px 0; text-transform:uppercase; text-align:center; border-bottom:2px solid var(--border); padding-bottom:5px; font-family:'Oswald', sans-serif;">👑 TOERNOOI RECORDHOUDERS 👑</h3>
                    <table class="retro-table" style="font-size:clamp(0.85rem, 1.5vh, 1.1rem); width:100%;">
                        <tr><td style="text-align:left;color:var(--border);padding:4px 0;white-space:normal;">Hoogste Score</td><td style="text-align:right;font-weight:bold;color:#fff;">${absRec.hs.speler} (${absRec.hs.val})</td></tr>
                        <tr><td style="text-align:left;color:var(--border);padding:4px 0;white-space:normal;">Hoogste Finish</td><td style="text-align:right;font-weight:bold;color:#fff;">${absRec.hf.speler} (${absRec.hf.val})</td></tr>
                        <tr><td style="text-align:left;color:var(--border);padding:4px 0;white-space:normal;">Kortste Leg (Pijlen)</td><td style="text-align:right;font-weight:bold;color:#fff;">${absRec.sl.speler} (${absRec.sl.val === 999 ? '-' : absRec.sl.val})</td></tr>
                        <tr><td style="text-align:left;color:var(--border);padding:4px 0;white-space:normal;">Top Match Avg</td><td style="text-align:right;font-weight:bold;color:#fff;">${absRec.tma.speler} (${absRec.tma.val.toFixed(2)})</td></tr>
                        <tr><td style="text-align:left;color:var(--border);padding:4px 0;white-space:normal;">Snelste Leg (Tijd)</td><td style="text-align:right;font-weight:bold;color:#fff;">${absRec.flt.speler} (${absRec.flt.val === 99999999 ? '-' : formatTime(absRec.flt.val)})</td></tr>
                        <tr><td style="text-align:left;color:var(--border);padding:4px 0;white-space:normal;">Kortste Match (Tijd)</td><td style="text-align:right;font-weight:bold;color:#fff;">${absRec.fmt.speler} (${absRec.fmt.val === 99999999 ? '-' : formatTime(absRec.fmt.val)})</td></tr>
                    </table>
                </div>
            `;
            b2El.classList.remove('active');
        }
    } else {
        const activeB1 = state.matches.find(m => m.board === 'board1' && m.status !== 'finished' && m.status !== 'waiting');
        const activeB2 = state.matches.find(m => m.board === 'board2' && m.status !== 'finished' && m.status !== 'waiting');
        let b1El = document.getElementById('tv-b1');
        let b2El = document.getElementById('tv-b2');
        if(b1El) { b1El.innerHTML = generateTVBoardHTML(activeB1); activeB1?b1El.classList.add('active'):b1El.classList.remove('active'); }
        if(b2El) { b2El.innerHTML = generateTVBoardHTML(activeB2); activeB2?b2El.classList.add('active'):b2El.classList.remove('active'); }
    }

    updateNavButtons();

    let sHTML = state.standings.map((s, i) => `<tr class="${i===0?'leader-row':''}">
        <td style="text-align:left; font-weight:bold;">${s.naam}</td>
        <td>${s.w}</td><td>${s.v}</td><td>${s.legsV}</td><td>${s.legsT}</td>
        <td class="punten-cel">${s.pt}</td><td>${s.saldo > 0 ? '+'+s.saldo : s.saldo}</td>
    </tr>`).join('');
    if(document.getElementById('tv-standings')) document.getElementById('tv-standings').innerHTML = sHTML;

    let hf1 = state.matches.find(m => m.id === 'HF1');
    let hf2 = state.matches.find(m => m.id === 'HF2');
    let fin = state.matches.find(m => m.id === 'FIN');
    
    const koHtml = (t, m, colorClass) => m ? `<div class="knockout-row" style="${(m.status==='playing'||m.status==='bullen'||m.status==='post_match')?'color:var(--neon-green);font-weight:bold;':''}">
        <span class="knockout-title" style="color:var(--${colorClass});">${t}</span>
        <span style="flex:1; text-align:right;">${m.p1}</span>
        <span style="padding:0 10px; font-weight:bold; color:var(--${colorClass});">${(m.status==='finished'||m.status==='post_match')?`${m.legs1}-${m.legs2}`:'vs'}</span>
        <span style="flex:1; text-align:left;">${m.p2}</span>
    </div>` : '';
    
    if(document.getElementById('tv-semi-finals')) document.getElementById('tv-semi-finals').innerHTML = koHtml('HF 1', hf1, 'silver') + koHtml('HF 2', hf2, 'silver');
    if(document.getElementById('tv-finals')) document.getElementById('tv-finals').innerHTML = koHtml('FINALE', fin, 'gold');

    const top7 = (arr) => arr.sort((a,b) => b.val - a.val).slice(0,7); 
    const statBox = (t, d) => `<h3>${t}</h3><table class="retro-table">${d.map((x,i)=>`<tr><td style="width:15px;">${i+1}</td><td style="text-align:left;">${x.naam}</td><td style="font-weight:bold;text-align:right;">${x.txt !== undefined ? x.txt : x.val}</td></tr>`).join('')}</table>`;

    if (statsPage === 0) {
        let allCheckouts = [];
        alleSpelers.forEach(s => { if(state.stats[s] && state.stats[s].checkouts) state.stats[s].checkouts.forEach(c => allCheckouts.push({naam: s, val: c})); });
        let d_hgo = top7(allCheckouts);

        let d_tot = top7(alleSpelers.map(s => {
            let legs = state.stats[s]?.legsPlayed || 0;
            let darts = state.stats[s]?.totalDarts || 0;
            let avgLeg = legs > 0 ? (darts / legs).toFixed(2) : "0.00";
            return { naam: s, val: darts, txt: `${darts} <span style="font-weight:normal;color:#888;">(${avgLeg}/L)</span>` };
        }));

        let d_avg = top7(alleSpelers.map(s => {
            let v = state.stats[s]?.totalDarts > 0 ? ((state.stats[s].totalScore / state.stats[s].totalDarts)*3) : 0;
            return { naam: s, val: v, txt: v.toFixed(2) };
        }));

        let d_dbl = top7(alleSpelers.map(s => {
            let v = state.stats[s]?.doubleAttempts > 0 ? ((state.stats[s].doubleHits / state.stats[s].doubleAttempts)*100) : 0;
            return { naam: s, val: v, txt: `${v.toFixed(2)}%` };
        }));

        let d_hgf = top7(alleSpelers.map(s => ({ naam: s, val: (state.stats[s]?.checkouts && state.stats[s].checkouts.length > 0) ? Math.max(...state.stats[s].checkouts) : 0 })));
        
        let d_slg = alleSpelers.map(s => { 
            let sl = state.stats[s]?.shortestLeg || { darts: 999, avg: 0 }; 
            return { naam: s, val: sl.darts === 999 ? 0 : sl.darts, txt: sl.darts === 999 ? '0' : `${sl.darts} <span style="font-weight:normal;color:#888;">(${parseFloat(sl.avg).toFixed(2)})</span>` }; 
        }).filter(x => x.val > 0).sort((a,b) => a.val - b.val).slice(0,7);

        if(document.getElementById('sb-1')) document.getElementById('sb-1').innerHTML = statBox('3-Dart Avg', d_avg);
        if(document.getElementById('sb-2')) document.getElementById('sb-2').innerHTML = statBox('Double %', d_dbl);
        if(document.getElementById('sb-3')) document.getElementById('sb-3').innerHTML = statBox('H.Finish (Toernooi)', d_hgo);
        if(document.getElementById('sb-4')) document.getElementById('sb-4').innerHTML = statBox('H.Finish (Persoon)', d_hgf);
        if(document.getElementById('sb-5')) document.getElementById('sb-5').innerHTML = statBox('Totaal Pijlen (Avg/L)', d_tot);
        if(document.getElementById('sb-6')) document.getElementById('sb-6').innerHTML = statBox('Kortste Leg (Darts)', d_slg);

    } else if (statsPage === 1) {
        let allScores = [];
        alleSpelers.forEach(s => { if(state.stats[s] && state.stats[s].highScores) state.stats[s].highScores.forEach(c => allScores.push({naam: s, val: c})); });
        let d_hsc = top7(allScores);

        let d_mva = top7(alleSpelers.map(s => {
            let v = (state.stats[s]?.matchAvgs && state.stats[s].matchAvgs.length > 0) ? Math.max(...state.stats[s].matchAvgs) : 0;
            return { naam: s, val: v, txt: v.toFixed(2) };
        }));

        let d_f9a = top7(alleSpelers.map(s => {
            let v = state.stats[s]?.first9Darts > 0 ? ((state.stats[s].first9Score / state.stats[s].first9Darts)*3) : 0;
            return { naam: s, val: v, txt: v.toFixed(2) };
        }));

        let d_ton = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.tonPlus || 0 })));
        let d_brk = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.breaks || 0 })));
        
        let d_bul = top7(alleSpelers.map(s => {
            let bWon = state.stats[s]?.bullsWon || 0;
            let mStarted = state.matches.filter(m => (m.p1 === s || m.p2 === s) && ['playing', 'post_match', 'finished'].includes(m.status)).length;
            let perc = mStarted > 0 ? ((bWon / mStarted) * 100).toFixed(2) : "0.00";
            return { naam: s, val: bWon, txt: `${bWon} <span style="font-weight:normal;color:#888;">(${perc}%)</span>` };
        }));

        if(document.getElementById('sb-1')) document.getElementById('sb-1').innerHTML = statBox('Top Match Avg', d_mva);
        if(document.getElementById('sb-2')) document.getElementById('sb-2').innerHTML = statBox('First-9 Avg', d_f9a);
        if(document.getElementById('sb-3')) document.getElementById('sb-3').innerHTML = statBox('Ton-Plus (100+)', d_ton);
        if(document.getElementById('sb-4')) document.getElementById('sb-4').innerHTML = statBox('Bulls Gewonnen', d_bul);
        if(document.getElementById('sb-5')) document.getElementById('sb-5').innerHTML = statBox('Meeste Breaks', d_brk);
        if(document.getElementById('sb-6')) document.getElementById('sb-6').innerHTML = statBox('Hoogste Score', d_hsc);

    } else {
        let sortedLegsAsc = [...state.completedLegs].sort((a,b) => a.time - b.time).slice(0,7);
        let d_fastLeg = sortedLegsAsc.map(l => ({ naam: l.winner, val: l.time, txt: `${formatTime(l.time)} <span style="font-weight:normal;color:#888;font-size:0.8em;">(vs ${l.loser.substring(0,3)})</span>` }));

        let sortedLegsDesc = [...state.completedLegs].sort((a,b) => b.time - a.time).slice(0,7);
        let d_slowLeg = sortedLegsDesc.map(l => ({ naam: l.winner, val: l.time, txt: `${formatTime(l.time)} <span style="font-weight:normal;color:#888;font-size:0.8em;">(vs ${l.loser.substring(0,3)})</span>` }));

        let sortedMatchesAsc = [...state.completedMatches].sort((a,b) => a.time - b.time).slice(0,7);
        let d_fastMatch = sortedMatchesAsc.map(l => ({ naam: l.winner, val: l.time, txt: `${formatTime(l.time)} <span style="font-weight:normal;color:#888;font-size:0.8em;">(vs ${l.loser.substring(0,3)})</span>` }));

        let sortedMatchesDesc = [...state.completedMatches].sort((a,b) => b.time - a.time).slice(0,7);
        let d_slowMatch = sortedMatchesDesc.map(l => ({ naam: l.winner, val: l.time, txt: `${formatTime(l.time)} <span style="font-weight:normal;color:#888;font-size:0.8em;">(vs ${l.loser.substring(0,3)})</span>` }));

        let d_avgMatchDur = top7(alleSpelers.map(s => {
            let matches = state.completedMatches.filter(m => m.winner === s || m.loser === s);
            let total = matches.reduce((sum, m) => sum + m.time, 0);
            let avg = matches.length > 0 ? (total / matches.length) : 0;
            return { naam: s, val: avg, txt: avg > 0 ? formatTime(avg) : '-' };
        }).filter(x => x.val > 0));

        let currentTourneyTime = state.tournamentStartTime ? (Date.now() - state.tournamentStartTime) : 0;

        let tourneyHTML = `
            <h3>Toernooi Klok</h3>
            <div style="flex:1; display:flex; align-items:center; justify-content:center;">
                <div class="live-timer-tourney" data-start="${state.tournamentStartTime}" style="color: var(--gold); font-size: clamp(2.5rem, 5vw, 4rem); font-weight: bold; text-shadow: 0 0 15px var(--gold-glow); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-variant-numeric: tabular-nums; line-height: 1;">
                    ${formatTimeLong(currentTourneyTime)}
                </div>
            </div>
        `;

        if(document.getElementById('sb-1')) document.getElementById('sb-1').innerHTML = statBox('Snelste Leg (Tijd)', d_fastLeg);
        if(document.getElementById('sb-2')) document.getElementById('sb-2').innerHTML = statBox('Langste Leg (Tijd)', d_slowLeg);
        if(document.getElementById('sb-3')) document.getElementById('sb-3').innerHTML = statBox('Kortste Match', d_fastMatch);
        if(document.getElementById('sb-4')) document.getElementById('sb-4').innerHTML = statBox('Langste Match', d_slowMatch);
        if(document.getElementById('sb-5')) document.getElementById('sb-5').innerHTML = statBox('Gem. Match Duur', d_avgMatchDur);
        if(document.getElementById('sb-6')) document.getElementById('sb-6').innerHTML = tourneyHTML; 
    }
}

function buildTabletSkeleton(boardId) {
    appContainer.innerHTML = `<div id="tablet-wrapper" style="height:100%; width:100%; display:flex; flex-direction:column; min-height:0;"></div>`;
}

function updateTabletData(boardId) {
    const wrap = document.getElementById('tablet-wrapper');
    if(!wrap) return;

    const m = state.matches.find(x => x.board === boardId && x.status !== 'finished');

    if (!m) {
        let html = `
            <div class="top-nav" style="margin-bottom:2vh; border-radius:4px;">
                <div class="nav-title">KIES EEN WEDSTRIJD (${boardId.toUpperCase()})</div>
                <div style="display:flex; gap:1vw;">
                    <button class="nav-btn" onclick="openRekeningModal()" style="background:#2a2a35; border-color:#444;">💶 REKENING</button>
                    <button class="nav-btn active" onclick="sluitTablet()">🗙 TV</button>
                </div>
            </div>
            <div class="match-selector">`;
            
        state.matches.filter(x => x.status === 'waiting' && !x.p1.includes('Plaats') && !x.p1.includes('Winnaar')).forEach(x => {
            let label = x.fase === 'poule' ? 'POULE' : (x.fase === 'HF' ? 'HALVE FINALE' : 'FINALE');
            let isLocked = state.matches.some(busy => busy.status !== 'waiting' && busy.status !== 'finished' && busy.id !== x.id && (busy.p1===x.p1 || busy.p2===x.p1 || busy.p1===x.p2 || busy.p2===x.p2));
            if(isLocked) {
                html += `<div class="match-option locked"><span>🔒 Speler is al bezig</span><span style="font-size:0.5em; display:block;">${label}</span>${x.p1} 🆚 ${x.p2}</div>`;
            } else {
                html += `<div class="match-option" onclick="koppelMatchAanBord('${x.id}', '${boardId}')"><span style="font-size:0.5em; color:var(--gold); display:block;">${label}</span>${x.p1} 🆚 ${x.p2}</div>`;
            }
        });
        if(state.matches.filter(x => x.status === 'waiting' && !x.p1.includes('Plaats') && !x.p1.includes('Winnaar')).length === 0) { html += `<h2 style="text-align:center;">Geen wedstrijden beschikbaar...</h2>`; }
        wrap.innerHTML = html + `</div>`;
        return;
    }

    if (m.status === 'bullen') {
        wrap.innerHTML = `
            <h2 style="font-size: clamp(1.5rem, 5vw, 2.5rem); color:var(--gold); text-align:center; margin-top:5vh;">🐂 BULLSEYE METING 🐂</h2>
            <p style="font-size: clamp(1rem, 3vw, 1.4rem); text-align:center;">Wie smeet het dichtst bij de rode stip en mag openen?</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-top:3vh;">
                <button class="retro-button success" style="font-size: clamp(1.5rem, 5vw, 2.5rem); padding: 20px 40px;" onclick="bevestigBullenWinnaar('${m.id}', 1)">${m.p1}</button>
                <button class="retro-button success" style="font-size: clamp(1.5rem, 5vw, 2.5rem); padding: 20px 40px;" onclick="bevestigBullenWinnaar('${m.id}', 2)">${m.p2}</button>
            </div>
            <div style="text-align:center; margin-top:5vh;"><button class="retro-button danger" onclick="annuleerLopendeMatch('${m.id}')">Annuleer Match</button></div>`;
        return;
    }
    
    if (m.status === 'post_match') {
        let mAvg1 = m.matchDarts1 > 0 ? ((m.matchScore1 / m.matchDarts1) * 3).toFixed(2) : "0.00";
        let mAvg2 = m.matchDarts2 > 0 ? ((m.matchScore2 / m.matchDarts2) * 3).toFixed(2) : "0.00";
        
        wrap.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1vh; gap: 10px;">
                <span style="font-size: clamp(1rem, 4vw, 1.5rem); font-weight:bold; color:var(--gold); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">📊 MATCH STATS (${boardId.toUpperCase()})</span>
                <button class="retro-button danger" style="padding:4px clamp(5px, 2vw, 10px); font-size:clamp(0.7rem, 2.5vw, 1rem); flex-shrink:0;" onclick="sluitTabletEnFinishMatch('${m.id}')">Overslaan ⏭</button>
            </div>
            <div style="flex:1; display:flex; justify-content:center; align-items:center; background:var(--card-bg); border:3px solid var(--gold); border-radius:12px; overflow:hidden;">
                <div style="display:flex; justify-content:space-around; width:100%; color:#fff; text-transform:uppercase;">
                    <div style="text-align:center;">
                        <h2 style="color:var(--gold); font-size: clamp(2rem, 8vw, 4rem); margin:0;">${m.p1}</h2>
                        <div style="font-size: clamp(1.5rem, 6vw, 3rem);">LEGS: ${m.legs1}</div>
                        <div style="font-size: clamp(1rem, 4vw, 2rem); margin-top:2vh;">AVG: ${mAvg1}</div>
                        <div style="font-size: clamp(0.8rem, 3vw, 1.5rem); color:#aaa;">Pijlen: ${m.matchDarts1}</div>
                    </div>
                    <div style="font-size: clamp(1.5rem, 6vw, 3rem); color:#555; align-self:center;">VS</div>
                    <div style="text-align:center;">
                        <h2 style="color:var(--gold); font-size: clamp(2rem, 8vw, 4rem); margin:0;">${m.p2}</h2>
                        <div style="font-size: clamp(1.5rem, 6vw, 3rem);">LEGS: ${m.legs2}</div>
                        <div style="font-size: clamp(1rem, 4vw, 2rem); margin-top:2vh;">AVG: ${mAvg2}</div>
                        <div style="font-size: clamp(0.8rem, 3vw, 1.5rem); color:#aaa;">Pijlen: ${m.matchDarts2}</div>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    if (m.status === 'playing') {
        let avg1 = m.matchDarts1 > 0 ? ((m.matchScore1 / m.matchDarts1) * 3).toFixed(2) : "0.00";
        let avg2 = m.matchDarts2 > 0 ? ((m.matchScore2 / m.matchDarts2) * 3).toFixed(2) : "0.00";
        let titleStr = m.fase === 'poule' ? 'FIRST TO 3 LEGS (BO5)' : '🔥 FIRST TO 4 LEGS (BO7)';

        wrap.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1vh; gap: 10px;">
                <span style="font-size: clamp(1rem, 4vw, 1.5rem); font-weight:bold; color:var(--gold); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${boardId.toUpperCase()} - ${titleStr}</span>
                <button class="retro-button danger" style="padding:4px clamp(5px, 2vw, 10px); font-size:clamp(0.7rem, 2.5vw, 1rem); flex-shrink:0;" onclick="annuleerLopendeMatch('${m.id}')">Afbreken</button>
            </div>
            
            <div class="tablet-grid">
                <div class="panes-wrapper">
                    <div class="pane ${m.turn===1?'pane-active':'pane-inactive'}">
                        <div class="pane-info-wrapper">
                            <h3 class="pane-name">${m.p1}</h3>
                            <div class="pane-legs">LEGS: ${m.legs1} | PIJLEN: ${m.dartsLeg1}</div>
                            <div class="pane-stats">Match Avg: ${avg1}</div>
                        </div>
                        <div class="pane-score ${m.score1<=170?'checkout-ready':''}">${m.score1}</div>
                    </div>
                    
                    <div class="pane ${m.turn===2?'pane-active':'pane-inactive'}">
                        <div class="pane-info-wrapper">
                            <h3 class="pane-name">${m.p2}</h3>
                            <div class="pane-legs">LEGS: ${m.legs2} | PIJLEN: ${m.dartsLeg2}</div>
                            <div class="pane-stats">Match Avg: ${avg2}</div>
                        </div>
                        <div class="pane-score ${m.score2<=170?'checkout-ready':''}">${m.score2}</div>
                    </div>
                </div>

                <div class="numpad-container">
                    <div class="numpad-grid">
                        <button onclick="numpadDrukCijfer(1)">1</button><button onclick="numpadDrukCijfer(2)">2</button><button onclick="numpadDrukCijfer(3)">3</button><button class="pre" onclick="numpadDrukPref(100)">100</button>
                        <button onclick="numpadDrukCijfer(4)">4</button><button onclick="numpadDrukCijfer(5)">5</button><button onclick="numpadDrukCijfer(6)">6</button><button class="pre" onclick="numpadDrukPref(60)">60</button>
                        <button onclick="numpadDrukCijfer(7)">7</button><button onclick="numpadDrukCijfer(8)">8</button><button onclick="numpadDrukCijfer(9)">9</button><button class="pre" onclick="numpadDrukPref(40)">40</button>
                        <button class="clear" onclick="numpadWissen()">⌫</button><button onclick="numpadDrukCijfer(0)">0</button><button class="pre" onclick="numpadDrukPref(26)">26</button><button class="action" onclick="verwerkIngevuldeScore('${m.id}')">OK</button>
                    </div>
                    <div class="numpad-field" id="pad-screen">${padInputString || "0"}</div>
                </div>
            </div>`;
    }
}

window.numpadDrukCijfer = function(c) { if(padInputString.length >= 3) return; padInputString += c; document.getElementById('pad-screen').innerText = padInputString; };
window.numpadWissen = function() { padInputString = padInputString.slice(0, -1); document.getElementById('pad-screen').innerText = padInputString || "0"; };
window.numpadDrukPref = function(val) { padInputString = val.toString(); document.getElementById('pad-screen').innerText = padInputString; };

window.koppelMatchAanBord = async function(mId, boardId) {
    localStorage.setItem('myBoard', boardId);
    const m = state.matches.find(x => x.id === mId);
    m.board = boardId; m.status = 'bullen';
    appContainer.innerHTML = ''; 
    await saveState(true);
};

window.sluitTabletEnFinishMatch = async function(mId) {
    const actM = state.matches.find(x => x.id === mId);
    if (actM) {
        actM.status = 'finished';
        await saveState(true);
    }
    localStorage.removeItem('myBoard');
    sluitTablet();
};

window.annuleerLopendeMatch = async function(mId) {
    if(confirm("Partij definitief wissen? Stats vervallen.")) {
        const m = state.matches.find(x => x.id === mId);
        m.status = 'waiting'; m.board = null; m.legs1 = 0; m.legs2 = 0; m.score1 = 501; m.score2 = 501;
        m.dartsLeg1 = 0; m.dartsLeg2 = 0; m.scoreLeg1 = 0; m.scoreLeg2 = 0;
        m.matchDarts1 = 0; m.matchScore1 = 0; m.matchDarts2 = 0; m.matchScore2 = 0;
        localStorage.removeItem('myBoard');
        appContainer.innerHTML = '';
        await saveState(true);
    }
}

window.bevestigBullenWinnaar = async function(mId, pNum) {
    const m = state.matches.find(x => x.id === mId);
    const winNaam = pNum === 1 ? m.p1 : m.p2;
    state.stats[winNaam].bullsWon++;
    m.status = 'playing'; m.startThrower = pNum; m.turn = pNum;
    
    if (!state.tournamentStartTime) state.tournamentStartTime = Date.now();
    m.matchStartTime = Date.now();
    m.legStartTime = Date.now();
    
    appContainer.innerHTML = '';
    await saveState(true);
}

window.sluitTablet = function() { 
    const topNav = document.getElementById('top-nav') || document.querySelector('.top-nav');
    if(topNav) topNav.style.display = 'flex'; 
    currentView = 'dashboard'; 
    appContainer.innerHTML = ''; 
    render(); 
}

window.verwerkIngevuldeScore = async function(mId) {
    let score = parseInt(padInputString) || 0;
    padInputString = ""; 
    if (score < 0 || score > 180) { alert("Ongeldig (0-180)!"); return; }

    const m = state.matches.find(x => x.id === mId);
    const oldScore = m.turn === 1 ? m.score1 : m.score2;
    let newScore = oldScore - score;

    if (oldScore <= 170 && newScore <= 50) {
        let isHit = (newScore === 0);
        
        if (isHit) {
            showModal(`
                <h2>🎯 GEWELDIGE CHECKOUT!</h2>
                <p>Hoeveel pijlen gesmeten en hoeveel op een dubbel?</p>
                <div class="modal-grid-3" style="grid-template-columns: 1fr 1fr; gap: 10px;">
                    <button class="modal-btn" style="font-size:1.1rem; padding:12px;" onclick="bevestigCheckoutDarts('${m.id}', ${score}, 1, 1)">1e pijl raak (1 tot, 1 dubbel)</button>
                    <button class="modal-btn" style="font-size:1.1rem; padding:12px;" onclick="bevestigCheckoutDarts('${m.id}', ${score}, 2, 1)">2e pijl raak (2 tot, 1 dubbel)</button>
                    <button class="modal-btn" style="font-size:1.1rem; padding:12px;" onclick="bevestigCheckoutDarts('${m.id}', ${score}, 2, 2)">2e pijl raak (2 tot, 2 dubbel)</button>
                    <button class="modal-btn" style="font-size:1.1rem; padding:12px;" onclick="bevestigCheckoutDarts('${m.id}', ${score}, 3, 1)">3e pijl raak (3 tot, 1 dubbel)</button>
                    <button class="modal-btn" style="font-size:1.1rem; padding:12px;" onclick="bevestigCheckoutDarts('${m.id}', ${score}, 3, 2)">3e pijl raak (3 tot, 2 dubbel)</button>
                    <button class="modal-btn" style="font-size:1.1rem; padding:12px;" onclick="bevestigCheckoutDarts('${m.id}', ${score}, 3, 3)">3e pijl raak (3 tot, 3 dubbel)</button>
                </div>
            `);
        } else {
            showModal(`
                <h2>❌ DUBBEL TRACKING (${oldScore} over)</h2>
                <p>Hoeveel pijlen beurtelings naar een dubbel gemist?</p>
                <div class="modal-grid-3">
                    <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 0, false)">0 Darts</button>
                    <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 1, false)">1 Dart</button>
                    <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 2, false)">2 Darts</button>
                    <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 3, false)">3 Darts</button>
                </div>
            `);
        }
    } else {
        await voerScoreTransactieUit(m, score, 0, false);
    }
}

window.bevestigCheckoutDarts = async function(mId, score, totDarts, doubleDarts) {
    const m = state.matches.find(x => x.id === mId);
    const aP = m.turn === 1 ? m.p1 : m.p2;
    state.stats[aP].doubleAttempts += doubleDarts;
    state.stats[aP].doubleHits += 1;
    hideModal();
    await voerScoreTransactieUit(m, score, totDarts, true);
}

window.bevestigDartsEnRekenUit = async function(mId, score, doubleDarts, isHit) {
    const m = state.matches.find(x => x.id === mId);
    const aP = m.turn === 1 ? m.p1 : m.p2;
    state.stats[aP].doubleAttempts += doubleDarts;
    if(isHit) state.stats[aP].doubleHits += 1;
    hideModal();
    await voerScoreTransactieUit(m, score, isHit ? doubleDarts : 3, isHit);
}

async function voerScoreTransactieUit(m, score, specDarts, isCheckout) {
    const scStr = m.turn === 1 ? 'score1' : 'score2';
    const dtLegStr = m.turn === 1 ? 'dartsLeg1' : 'dartsLeg2';
    const scLegStr = m.turn === 1 ? 'scoreLeg1' : 'scoreLeg2';
    const aP = m.turn === 1 ? m.p1 : m.p2;
    const loser = aP === m.p1 ? m.p2 : m.p1;

    let calcScore = m[scStr] - score;
    let dartsThrown = isCheckout ? specDarts : 3;

    let overlayQueue = [];

    if (score >= 100) {
        state.stats[aP].highScores.push(score);
        state.stats[aP].tonPlus++;
    }

    if (score > state.records.highestScore.val) {
        state.records.highestScore = { val: score, speler: aP };
        overlayQueue.push({ title: "NIEUW RECORD!", name: aP, subtitle: score + " HOOGSTE SCORE" });
    }

    if (m[dtLegStr] < 9) {
        let maxC = Math.min(9 - m[dtLegStr], dartsThrown);
        state.stats[aP].first9Darts += maxC;
        state.stats[aP].first9Score += (score * (maxC/3)); 
    }

    if (calcScore < 0 || calcScore === 1) {
        state.stats[aP].totalDarts += 3;
        m[dtLegStr] += 3; m['matchDarts' + m.turn] += 3;
        
        if (overlayQueue.length > 0) {
            let best = overlayQueue[overlayQueue.length - 1];
            state.lastOverlay = { ...best, time: Date.now() };
        }

        m.turn = m.turn === 1 ? 2 : 1;
        await saveState(true);
        return;
    }

    if (calcScore === 0) {
        m[scStr] = 0;
        state.stats[aP].totalDarts += dartsThrown;
        state.stats[aP].totalScore += score;
        state.stats[aP].checkouts.push(score);
        
        m[dtLegStr] += dartsThrown; m[scLegStr] += score;
        m['matchDarts' + m.turn] += dartsThrown; m['matchScore' + m.turn] += score;

        if (m.turn !== m.startThrower) state.stats[aP].breaks++;
        if(m.turn === 1) m.legs1++; else m.legs2++;
        state.stats[m.p1].legsPlayed++; state.stats[m.p2].legsPlayed++;

        let legTime = Date.now() - (m.legStartTime || Date.now());
        state.completedLegs.push({ winner: aP, loser: loser, time: legTime, matchId: m.id });
        if (legTime < state.records.fastestLegTime.val && legTime > 3000) {
            state.records.fastestLegTime = { val: legTime, speler: aP };
            overlayQueue.push({ title: "RECORD SNELSTE LEG!", name: aP, subtitle: formatTime(legTime) + " TIJD" });
        }
        
        m.legStartTime = Date.now();

        overlayQueue.push({ title: "CHECKOUT!", name: aP, subtitle: score + " FINISH" });

        if (score > state.records.highestCheckout.val) {
            state.records.highestCheckout = { val: score, speler: aP };
            overlayQueue.push({ title: "RECORD FINISH!", name: aP, subtitle: score + " CHECKOUT" });
        }

        let legAvg = ((m[scLegStr] / m[dtLegStr]) * 3).toFixed(2);
        if (m[dtLegStr] < state.stats[aP].shortestLeg.darts) state.stats[aP].shortestLeg = { darts: m[dtLegStr], avg: legAvg };
        
        if (m[dtLegStr] < state.records.shortestLeg.val) {
            state.records.shortestLeg = { val: m[dtLegStr], speler: aP };
            overlayQueue.push({ title: "RECORD KORTSTE LEG!", name: aP, subtitle: m[dtLegStr] + " PIJLEN" });
        }

        let targets = m.fase === 'poule' ? 3 : 4;

        if(m.legs1 === targets || m.legs2 === targets) {
            m.status = 'post_match'; 
            
            let matchTime = Date.now() - (m.matchStartTime || Date.now());
            state.completedMatches.push({ winner: aP, loser: loser, time: matchTime, matchId: m.id });
            if (matchTime < state.records.fastestMatchTime.val && matchTime > 5000) {
                state.records.fastestMatchTime = { val: matchTime, speler: aP };
                overlayQueue.push({ title: "RECORD KORTSTE MATCH!", name: aP, subtitle: formatTime(matchTime) + " TIJD" });
            }

            let mAvg1 = parseFloat(((m.matchScore1 / m.matchDarts1)*3).toFixed(2));
            let mAvg2 = parseFloat(((m.matchScore2 / m.matchDarts2)*3).toFixed(2));
            state.stats[m.p1].matchAvgs.push(mAvg1);
            state.stats[m.p2].matchAvgs.push(mAvg2);

            if (m.turn === 1 && mAvg1 > state.records.highestMatchAvg.val) {
                 state.records.highestMatchAvg = { val: mAvg1, speler: m.p1 };
                 overlayQueue.push({ title: "RECORD MATCH AVG!", name: m.p1, subtitle: mAvg1.toFixed(2) + " AVG" });
            } else if (m.turn === 2 && mAvg2 > state.records.highestMatchAvg.val) {
                 state.records.highestMatchAvg = { val: mAvg2, speler: m.p2 };
                 overlayQueue.push({ title: "RECORD MATCH AVG!", name: m.p2, subtitle: mAvg2.toFixed(2) + " AVG" });
            }

            if (overlayQueue.length > 0) {
                let best = overlayQueue[overlayQueue.length - 1];
                state.lastOverlay = { ...best, time: Date.now() };
            }

            appContainer.innerHTML = '';
            await saveState(true);
            
            setTimeout(async () => {
                const actM = state.matches.find(x => x.id === m.id);
                if (actM && actM.status === 'post_match') {
                    actM.status = 'finished';
                    await saveState(true);
                    if (currentView === actM.board) {
                        localStorage.removeItem('myBoard');
                        sluitTablet();
                    }
                }
            }, 25000);
            
            return;
        }

        if (overlayQueue.length > 0) {
            let best = overlayQueue[overlayQueue.length - 1];
            state.lastOverlay = { ...best, time: Date.now() };
        }

        m.score1 = 501; m.score2 = 501;
        m.dartsLeg1 = 0; m.dartsLeg2 = 0; m.scoreLeg1 = 0; m.scoreLeg2 = 0;
        m.startThrower = m.startThrower === 1 ? 2 : 1; m.turn = m.startThrower;
        await saveState(true);
        return;
    }

    m[scStr] = calcScore; m[dtLegStr] += 3; m[scLegStr] += score;
    m['matchDarts' + m.turn] += 3; m['matchScore' + m.turn] += score;
    state.stats[aP].totalDarts += 3; state.stats[aP].totalScore += score;
    
    if (overlayQueue.length > 0) {
        let best = overlayQueue[overlayQueue.length - 1];
        state.lastOverlay = { ...best, time: Date.now() };
    }

    m.turn = m.turn === 1 ? 2 : 1;
    await saveState(true);
}

function showModal(h) { document.getElementById('modal-content').innerHTML = h; document.getElementById('action-modal').style.display = 'flex'; }
function hideModal() { document.getElementById('action-modal').style.display = 'none'; }

// --- REKENING MODAL ---
window.openRekeningModal = function() {
    const drankDeel = (101 / 7).toFixed(2);
    const data = [
        { naam: "Stefaan (Gezin)", f: 35.60, s: true, order: "Stefaan: Kl. pak mayo, 2 kl. brochetten. Wesley: Kl. pak balletjes erop, zigeunerstick, curryketchup. Patricia: 1 kl. pak balletjes erop." },
        { naam: "Joël", f: 9.40, s: true, order: "Klein pak met balletjes" },
        { naam: "Wim & Nancy", f: 17.10, s: true, order: "Wim: Kl. pakske mayo apart met bicky crispy. Nancy: Kl. paksken met potje tartaar en bitterballen." },
        { naam: "Yarni", f: 17.10, s: true, order: "Middel romboutje JOPPIE saus, kleine saté en potje andalouse" },
        { naam: "Vince", f: 15.90, s: true, order: "Julientje met mayo en een bicky burger" },
        { naam: "Tibe", f: 13.50, s: true, order: "Julientje met mayonaise en een boulet" },
        { naam: "Jorden", f: 15.90, s: true, order: "Julientje met mayo en een bicky cheese" }
    ];

    let html = `
        <h2 style="font-size: clamp(1.5rem, 4vw, 2.5rem); color:var(--gold); margin-top:0;">💶 DE REKENING</h2>
        <p style="color:#aaa; font-size:1rem; margin-bottom:15px;">Frituur + €101 drank gedeeld door de 7 spelers (€${drankDeel} p.p.)</p>
        <div style="overflow-x:auto;">
        <table class="retro-table" style="width:100%; font-size:1.1rem; text-align:right;">
            <thead>
                <tr>
                    <th style="text-align:left;">Naam / Gezin</th>
                    <th>Frituur</th>
                    <th>Drank</th>
                    <th style="color:var(--gold);">Totaal</th>
                </tr>
            </thead>
            <tbody>
    `;

    let totFrituur = 0;
    let totDrank = 0;
    
    data.forEach(d => {
        let drank = d.s ? 101/7 : 0;
        let rowTot = d.f + drank;
        totFrituur += d.f;
        totDrank += drank;
        
        html += `
            <tr style="border-bottom: 1px dashed #333;">
                <td style="text-align:left; padding: 10px 0;">
                    <div style="color:#fff; font-weight:bold;">${d.naam}</div>
                    <div style="color:#888; font-size:0.85rem; font-family:'Roboto Mono', monospace; white-space:normal; line-height:1.3; margin-top:5px;">${d.order}</div>
                </td>
                <td style="vertical-align:top; padding: 10px 0;">€ ${d.f.toFixed(2)}</td>
                <td style="vertical-align:top; padding: 10px 0;">€ ${drank.toFixed(2)}</td>
                <td style="color:var(--gold); font-weight:bold; vertical-align:top; padding: 10px 0;">€ ${rowTot.toFixed(2)}</td>
            </tr>
        `;
    });

    html += `
            <tr style="background: rgba(245,0,87,0.1); border-top: 2px solid var(--gold);">
                <td style="text-align:left; color:var(--gold); font-weight:bold; padding: 10px 0;">TOTAAL</td>
                <td style="font-weight:bold; padding: 10px 0;">€ ${totFrituur.toFixed(2)}</td>
                <td style="font-weight:bold; padding: 10px 0;">€ ${totDrank.toFixed(2)}</td>
                <td style="color:var(--gold); font-weight:bold; font-size:1.3rem; padding: 10px 0;">€ ${(totFrituur + totDrank).toFixed(2)}</td>
            </tr>
            </tbody>
        </table>
        </div>
        <div class="modal-grid-3" style="display:flex; justify-content:center; margin-top:2vh;">
            <button class="retro-button danger" onclick="hideModal()">Sluiten</button>
        </div>
    `;
    showModal(html);
}

window.openExportModal = function() {
    let absRec = getAbsoluteRecords();
    let text = "🏆 OG'S PRO DARTS 2026 - TOERNOOI STATS 🏆\n\n";
    
    text += "--- ALGEMEEN KLASSEMENT ---\n";
    state.standings.forEach((s, i) => {
        text += `${i+1}. ${s.naam} - ${s.pt} PT (Saldo: ${s.saldo > 0 ? '+'+s.saldo : s.saldo}) [${s.w}W - ${s.v}V]\n`;
    });

    text += "\n--- SPELER STATISTIEKEN ---\n";
    alleSpelers.forEach(s => {
        let st = state.stats[s];
        let avg = st.totalDarts > 0 ? ((st.totalScore / st.totalDarts) * 3).toFixed(2) : "0.00";
        let dbl = st.doubleAttempts > 0 ? ((st.doubleHits / st.doubleAttempts) * 100).toFixed(2) : "0.00";
        let hf = st.checkouts.length > 0 ? Math.max(...st.checkouts) : 0;
        let hs = st.highestScore || 0;
        if (st.highScores && st.highScores.length > 0) hs = Math.max(hs, ...st.highScores);
        let avgL = st.legsPlayed > 0 ? (st.totalDarts / st.legsPlayed).toFixed(2) : "0.00";
        let sl = st.shortestLeg && st.shortestLeg.darts !== 999 ? st.shortestLeg.darts : "-";
        let mva = st.matchAvgs.length > 0 ? Math.max(...st.matchAvgs).toFixed(2) : "0.00";
        let f9a = st.first9Darts > 0 ? ((st.first9Score / st.first9Darts) * 3).toFixed(2) : "0.00";
        
        let matches = state.completedMatches.filter(m => m.winner === s || m.loser === s);
        let totalTime = matches.reduce((sum, m) => sum + m.time, 0);
        let avgTime = matches.length > 0 ? formatTime(totalTime / matches.length) : "-";

        text += `\n👤 ${s.toUpperCase()}\n`;
        text += `- 3-Dart Avg: ${avg}\n`;
        text += `- Double %: ${dbl}%\n`;
        text += `- Hoogste Finish: ${hf}\n`;
        text += `- Hoogste Score: ${hs}\n`;
        text += `- Totaal Pijlen: ${st.totalDarts} (${avgL}/Leg)\n`;
        text += `- Kortste Leg: ${sl} pijlen\n`;
        text += `- Top Match Avg: ${mva}\n`;
        text += `- First-9 Avg: ${f9a}\n`;
        text += `- Ton-Plus (100+): ${st.tonPlus}\n`;
        text += `- Bulls Gewonnen: ${st.bullsWon}\n`;
        text += `- Breaks: ${st.breaks}\n`;
        text += `- Gem. Match Duur: ${avgTime}\n`;
    });

    text += "\n--- TOERNOOI RECORDS ---\n";
    let curTime = state.tournamentStartTime ? (Date.now() - state.tournamentStartTime) : 0;
    text += `- Actieve Toernooi Duur: ${formatTimeLong(curTime)}\n`;
    text += `- Hoogste Checkout: ${absRec.hf.speler} (${absRec.hf.val})\n`;
    text += `- Hoogste Score: ${absRec.hs.speler} (${absRec.hs.val})\n`;
    text += `- Top Match Avg: ${absRec.tma.speler} (${absRec.tma.val.toFixed(2)})\n`;
    if (absRec.flt.val !== 99999999) text += `- Snelste Leg (Tijd): ${absRec.flt.speler} (${formatTime(absRec.flt.val)})\n`;
    if (absRec.fmt.val !== 99999999) text += `- Kortste Match (Tijd): ${absRec.fmt.speler} (${formatTime(absRec.fmt.val)})\n`;

    showModal(`
        <h2 style="font-size: 2rem;">📋 TOERNOOI EXPORT</h2>
        <p style="font-size: 1rem; margin-bottom: 10px;">Kopieer onderstaande tekst om in WhatsApp of Messenger te plakken.</p>
        <textarea id="export-textarea" style="width:100%; height:45vh; background:#000; color:var(--gold); border:2px solid var(--border); border-radius:8px; padding:10px; font-family:monospace; font-size:1.2rem; resize:none;">${text}</textarea>
        <div class="modal-grid-3" style="display:flex; justify-content:center; margin-top:2vh;">
            <button class="retro-button success" onclick="copyExportText()">Kopiëren</button>
            <button class="retro-button danger" onclick="hideModal()">Sluiten</button>
        </div>
    `);
}

window.copyExportText = function() {
    let ta = document.getElementById('export-textarea');
    ta.select();
    ta.setSelectionRange(0, 99999);
    try {
        navigator.clipboard.writeText(ta.value).then(() => {
            alert('Stats succesvol gekopieerd!');
        }).catch(err => {
            document.execCommand('copy');
            alert('Stats gekopieerd!');
        });
    } catch (e) {
        document.execCommand('copy');
        alert('Stats gekopieerd!');
    }
}

init();
