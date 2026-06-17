// --- JOUW SUPABASE ---
const supabaseUrl = 'https://jpvgcgjnhvutqtrkbamc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwdmdjZ2puaHZ1dHF0cmtiYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MTIxMzgsImV4cCI6MjA5NzI4ODEzOH0.edR9Ve6FOOre5DcmHDoAPSF0rIsU_DVX1KFy9pQACyI';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Stefaan", "Wim", "Tibe"];

let state = { matches: [], standings: [], stats: {}, lastCheckout: null };
let currentView = 'dashboard';
let padInputString = ""; 
let windowLastCheckoutTime = 0;
let logboekIndex = 0;

const appContainer = document.getElementById('app-container');
const navButtons = document.querySelectorAll('.nav-btn');

if (!document.getElementById('finish-overlay')) {
    let ov = document.createElement('div');
    ov.id = 'finish-overlay';
    ov.innerHTML = `<div class="finish-title">PDC CHECKOUT</div><div class="finish-name" id="fo-name"></div><div class="finish-score" id="fo-score"></div>`;
    document.body.appendChild(ov);
}

// --- DATABASE & REALTIME ---
async function init() {
    try {
        const { data, error } = await supabaseClient.from('toernooi_data').select('state').eq('id', 1).single();
        
        if (data && data.state && Object.keys(data.state).length > 0) {
            state = data.state;
            
            alleSpelers.forEach(s => {
                if(!state.stats[s]) state.stats[s] = {};
                state.stats[s].shortestLeg = state.stats[s].shortestLeg || { darts: 999, avg: 0 };
                state.stats[s].matchAvgs = state.stats[s].matchAvgs || [];
                state.stats[s].tonPlus = state.stats[s].tonPlus || 0;
                state.stats[s].breaks = state.stats[s].breaks || 0;
                state.stats[s].first9Score = state.stats[s].first9Score || 0;
                state.stats[s].first9Darts = state.stats[s].first9Darts || 0;
                state.stats[s].whitewashes = state.stats[s].whitewashes || 0;
                state.stats[s].max180 = state.stats[s].max180 || 0;
                if (!state.stats[s].checkouts) state.stats[s].checkouts = [];
            });

            state.matches.forEach(m => {
                if (!m.fase) m.fase = 'poule';
                if (m.matchDarts1 === undefined) m.matchDarts1 = 0;
                if (m.matchScore1 === undefined) m.matchScore1 = 0;
                if (m.matchDarts2 === undefined) m.matchDarts2 = 0;
                if (m.matchScore2 === undefined) m.matchScore2 = 0;
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
                logboekIndex = (logboekIndex + 1) % 3;
                updateLogboekOnly();
            }
        }, 10000);

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
    if (state.lastCheckout && (Date.now() - state.lastCheckout.time < 6000)) {
        if (windowLastCheckoutTime !== state.lastCheckout.time) {
            triggerFinishOverlay(state.lastCheckout.name, state.lastCheckout.score);
            windowLastCheckoutTime = state.lastCheckout.time;
        }
    }
}

function triggerFinishOverlay(name, score) {
    const ov = document.getElementById('finish-overlay');
    document.getElementById('fo-name').innerText = name;
    document.getElementById('fo-score').innerText = score + " CHECKOUT!";
    ov.classList.add('show');
    setTimeout(() => ov.classList.remove('show'), 5000);
}

navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        navButtons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentView = e.target.getAttribute('data-view');
        
        const topNav = document.getElementById('top-nav');
        if (currentView === 'dashboard') topNav.style.display = 'flex';
        else topNav.style.display = 'none';
        
        padInputString = "";
        appContainer.innerHTML = ''; 
        render();
    });
});

document.getElementById('reset-btn').addEventListener('click', async () => {
    if(prompt("Typ '1403' om alles te wissen:") === "1403") {
        genereerRoundRobinSchema();
        initStatsKlassen();
        await saveState(true);
        appContainer.innerHTML = '';
        render();
        alert("Database gereset!");
    }
});

function maakMatchObj(id, p1, p2, fase) {
    return {
        id: id, p1: p1, p2: p2, fase: fase, status: 'waiting', board: null,
        legs1: 0, legs2: 0, score1: 501, score2: 501, turn: null, startThrower: null,
        dartsLeg1: 0, dartsLeg2: 0, scoreLeg1: 0, scoreLeg2: 0,
        matchDarts1: 0, matchScore1: 0, matchDarts2: 0, matchScore2: 0
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
    
    state.matches.filter(m => m.fase === 'poule' && m.status === 'finished').forEach(m => {
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

    let pouleFinished = state.matches.filter(m => m.fase === 'poule').every(m => m.status === 'finished');
    let hf1 = state.matches.find(m => m.id === 'HF1');
    let hf2 = state.matches.find(m => m.id === 'HF2');
    let fin = state.matches.find(m => m.id === 'FIN');

    if (pouleFinished && standings.length >= 4) {
        if (hf1 && hf1.status === 'waiting' && hf1.p1 === '1e Plaats') { hf1.p1 = standings[0].naam; hf1.p2 = standings[3].naam; }
        if (hf2 && hf2.status === 'waiting' && hf2.p1 === '2e Plaats') { hf2.p1 = standings[1].naam; hf2.p2 = standings[2].naam; }
    }

    if (hf1 && hf1.status === 'finished' && hf2 && hf2.status === 'finished') {
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
}

function buildDashboardSkeleton() {
    let html = `
    <div id="dashboard-wrapper" class="dashboard-layout">
        <div class="dashboard-top">
            <!-- Kolom 1: Borden & Roterend Schema -->
            <div class="grid-col">
                <div class="live-board" id="tv-b1" style="flex: 1.2;"></div>
                <div class="live-board" id="tv-b2" style="flex: 1.2;"></div>
                <div class="card" style="flex: 1.5; justify-content: space-between;">
                    <h2 id="logboek-title">📋 SCHEMA (P. 1/3)</h2>
                    <div id="tv-logboek-content" style="display:flex; flex-direction:column; justify-content:space-evenly; height:100%;"></div>
                </div>
            </div>
            
            <!-- Kolom 2: Klassement & Opgesplitste Finales -->
            <div class="grid-col">
                <div class="card" style="flex: 2.1;">
                    <h2>🏆 ALGEMEEN KLASSEMENT</h2>
                    <table class="retro-table">
                        <!-- Nummers weg, 35% breedte voor de Naam -->
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
            
            <!-- Kolom 3: 3x4 Stats Grid (12 Vakken) -->
            <div class="grid-col">
                <div class="stats-grid" id="tv-stats-grid">
                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(i => `<div class="stat-box" id="sb-${i}"></div>`).join('')}
                </div>
            </div>
        </div>
    </div>`;
    appContainer.innerHTML = html;
}

function generateTVBoardHTML(title, match) {
    if (!match) return `<h3>${title}</h3><div style="flex:1; display:flex; align-items:center; justify-content:center; font-size:1.5rem; color:#444;">Bord Vrij</div>`;
    if (match.status === 'bullen') return `<h3>${title}</h3><div class="live-match-title">${match.p1} vs ${match.p2}</div><div style="flex:1; display:flex; align-items:center; justify-content:center; color:var(--gold); font-size:1.4rem;">🐂 BULLEN VOOR START 🐂</div>`;
    
    let avg1 = match.matchDarts1 > 0 ? ((match.matchScore1 / match.matchDarts1) * 3).toFixed(1) : "0.0";
    let avg2 = match.matchDarts2 > 0 ? ((match.matchScore2 / match.matchDarts2) * 3).toFixed(1) : "0.0";
    let matchFase = match.fase === 'poule' ? 'Best of 5' : 'Best of 7';

    let active1 = match.turn === 1 ? 'turn-active' : 'turn-inactive';
    let active2 = match.turn === 2 ? 'turn-active' : 'turn-inactive';

    let mom1 = Math.min(100, (match.dartsLeg1 / 24) * 100); 
    let mom2 = Math.min(100, (match.dartsLeg2 / 24) * 100); 

    return `
        <h3>${title} <span style="font-size:0.5em; background:#444; padding:2px 8px; border-radius:4px; margin-left:10px;">${matchFase} | Leg ${match.legs1 + match.legs2 + 1}</span></h3>
        <div class="live-score-row">
            <div class="player-col ${active1}">
                <div class="p-name">${match.p1}</div>
                <div class="p-legs">Legs: ${match.legs1}</div>
                <div class="p-score">${match.score1}</div>
                <div class="momentum-container"><div class="momentum-fill" style="width:${mom1}%"></div></div>
                <div class="p-avg">M-Avg: ${avg1}</div>
            </div>
            <div style="display:flex; align-items:center; font-size:1.5rem; color:#444;">VS</div>
            <div class="player-col ${active2}">
                <div class="p-name">${match.p2}</div>
                <div class="p-legs">Legs: ${match.legs2}</div>
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
        else if (m.status === 'finished') { 
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
    const activeB1 = state.matches.find(m => m.board === 'board1' && m.status !== 'finished' && m.status !== 'waiting');
    const activeB2 = state.matches.find(m => m.board === 'board2' && m.status !== 'finished' && m.status !== 'waiting');
    
    let b1El = document.getElementById('tv-b1');
    let b2El = document.getElementById('tv-b2');
    if(b1El) { b1El.innerHTML = generateTVBoardHTML('🎯 BORD 1', activeB1); activeB1?b1El.classList.add('active'):b1El.classList.remove('active'); }
    if(b2El) { b2El.innerHTML = generateTVBoardHTML('🎯 BORD 2', activeB2); activeB2?b2El.classList.add('active'):b2El.classList.remove('active'); }

    updateLogboekOnly();

    // Standings met Nummers weg
    let sHTML = state.standings.map((s, i) => `<tr class="${i===0?'leader-row':''}">
        <td style="text-align:left; font-weight:bold;">${s.naam}</td>
        <td>${s.w}</td><td>${s.v}</td><td>${s.legsV}</td><td>${s.legsT}</td>
        <td class="punten-cel">${s.pt}</td><td>${s.saldo > 0 ? '+'+s.saldo : s.saldo}</td>
    </tr>`).join('');
    if(document.getElementById('tv-standings')) document.getElementById('tv-standings').innerHTML = sHTML;

    // Opgesplitste Knockouts (Zilver & Goud)
    let hf1 = state.matches.find(m => m.id === 'HF1');
    let hf2 = state.matches.find(m => m.id === 'HF2');
    let fin = state.matches.find(m => m.id === 'FIN');
    
    const koHtml = (t, m, colorClass) => m ? `<div class="knockout-row" style="${(m.status==='playing'||m.status==='bullen')?'color:var(--neon-green);font-weight:bold;':''}">
        <span class="knockout-title" style="color:var(--${colorClass});">${t}</span>
        <span style="flex:1; text-align:right;">${m.p1}</span>
        <span style="padding:0 10px; font-weight:bold; color:var(--${colorClass});">${m.status==='finished'?`${m.legs1}-${m.legs2}`:'vs'}</span>
        <span style="flex:1; text-align:left;">${m.p2}</span>
    </div>` : '';
    
    if(document.getElementById('tv-semi-finals')) document.getElementById('tv-semi-finals').innerHTML = koHtml('HF 1', hf1, 'silver') + koHtml('HF 2', hf2, 'silver');
    if(document.getElementById('tv-finals')) document.getElementById('tv-finals').innerHTML = koHtml('FINALE', fin, 'gold');

    // 12 Stats Grid (Alle 7 spelers per box)
    const top7 = (arr) => arr.sort((a,b) => b.val - a.val).slice(0,7); 
    const statBox = (t, d) => `<h3>${t}</h3><table class="retro-table">${d.map((x,i)=>`<tr><td style="width:15px;">${i+1}</td><td style="text-align:left;">${x.naam}</td><td style="font-weight:bold;text-align:right;">${x.txt||x.val}</td></tr>`).join('')}</table>`;

    let allCheckouts = [];
    alleSpelers.forEach(s => {
        if(state.stats[s] && state.stats[s].checkouts) state.stats[s].checkouts.forEach(c => allCheckouts.push({naam: s, val: c}));
    });
    let d_hgo = top7(allCheckouts);

    let d_tot = top7(alleSpelers.map(s => {
        let legs = state.stats[s]?.legsPlayed || 0;
        let darts = state.stats[s]?.totalDarts || 0;
        let avgLeg = legs > 0 ? (darts / legs).toFixed(1) : 0;
        return { naam: s, val: darts, txt: `${darts} <span style="font-weight:normal;color:#888;">(${avgLeg}/L)</span>` };
    }));

    let d_avg = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.totalDarts > 0 ? parseFloat(((state.stats[s].totalScore / state.stats[s].totalDarts)*3).toFixed(1)) : 0 })));
    let d_dbl = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.doubleAttempts > 0 ? Math.round((state.stats[s].doubleHits / state.stats[s].doubleAttempts)*100) : 0, txt: `${state.stats[s]?.doubleAttempts>0?Math.round((state.stats[s].doubleHits / state.stats[s].doubleAttempts)*100):0}%` })));
    let d_hgf = top7(alleSpelers.map(s => ({ naam: s, val: (state.stats[s]?.checkouts && state.stats[s].checkouts.length > 0) ? Math.max(...state.stats[s].checkouts) : 0 })));
    let d_slg = alleSpelers.map(s => { let sl = state.stats[s]?.shortestLeg || { darts: 999 }; return { naam: s, val: sl.darts === 999 ? 0 : sl.darts }; }).filter(x => x.val > 0).sort((a,b) => a.val - b.val).slice(0,7);
    let d_mva = top7(alleSpelers.map(s => ({ naam: s, val: (state.stats[s]?.matchAvgs && state.stats[s].matchAvgs.length > 0) ? Math.max(...state.stats[s].matchAvgs) : 0 })));
    let d_f9a = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.first9Darts > 0 ? parseFloat(((state.stats[s].first9Score / state.stats[s].first9Darts)*3).toFixed(1)) : 0 })));
    let d_ton = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.tonPlus || 0 })));
    let d_180 = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.max180 || 0 })));
    let d_brk = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.breaks || 0 })));
    let d_wws = top7(alleSpelers.map(s => ({ naam: s, val: state.stats[s]?.whitewashes || 0 })));

    if(document.getElementById('sb-1')) document.getElementById('sb-1').innerHTML = statBox('3-Dart Avg', d_avg);
    if(document.getElementById('sb-2')) document.getElementById('sb-2').innerHTML = statBox('Double %', d_dbl);
    if(document.getElementById('sb-3')) document.getElementById('sb-3').innerHTML = statBox('H.Finish (Toernooi)', d_hgo);
    if(document.getElementById('sb-4')) document.getElementById('sb-4').innerHTML = statBox('H.Finish (Persoon)', d_hgf);
    if(document.getElementById('sb-5')) document.getElementById('sb-5').innerHTML = statBox('Totaal Pijlen (Avg/L)', d_tot);
    if(document.getElementById('sb-6')) document.getElementById('sb-6').innerHTML = statBox('Kortste Leg', d_slg);
    if(document.getElementById('sb-7')) document.getElementById('sb-7').innerHTML = statBox('Top Match Avg', d_mva);
    if(document.getElementById('sb-8')) document.getElementById('sb-8').innerHTML = statBox('First-9 Avg', d_f9a);
    if(document.getElementById('sb-9')) document.getElementById('sb-9').innerHTML = statBox('Ton-Plus (100+)', d_ton);
    if(document.getElementById('sb-10')) document.getElementById('sb-10').innerHTML = statBox('Max 180s', d_180);
    if(document.getElementById('sb-11')) document.getElementById('sb-11').innerHTML = statBox('Meeste Breaks', d_brk);
    if(document.getElementById('sb-12')) document.getElementById('sb-12').innerHTML = statBox('Whitewashes', d_wws);
}

function buildTabletSkeleton(boardId) {
    appContainer.innerHTML = `<div id="tablet-wrapper" style="height:100%; width:100%; display:flex; flex-direction:column;"></div>`;
}

function updateTabletData(boardId) {
    const wrap = document.getElementById('tablet-wrapper');
    if(!wrap) return;

    const m = state.matches.find(x => x.board === boardId && x.status !== 'finished');

    if (!m) {
        let html = `
            <div class="top-nav" style="margin-bottom:2vh; border-radius:4px;"><div class="nav-title">KIES EEN WEDSTRIJD (${boardId.toUpperCase()})</div><button class="nav-btn active" onclick="sluitTablet()">🗙 TV</button></div>
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
            <h2 style="font-size:2.5rem; color:var(--gold); text-align:center; margin-top:5vh;">🐂 BULLSEYE METING 🐂</h2>
            <p style="font-size:1.4rem; text-align:center;">Wie smeet het dichtst bij de rode stip en mag openen?</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-top:3vh;">
                <button class="retro-button success" style="font-size:2.5rem; padding: 20px 40px;" onclick="bevestigBullenWinnaar('${m.id}', 1)">${m.p1}</button>
                <button class="retro-button success" style="font-size:2.5rem; padding: 20px 40px;" onclick="bevestigBullenWinnaar('${m.id}', 2)">${m.p2}</button>
            </div>
            <div style="text-align:center; margin-top:5vh;"><button class="retro-button danger" onclick="annuleerLopendeMatch('${m.id}')">Annuleer Match</button></div>`;
        return;
    }

    if (m.status === 'playing') {
        let avg1 = m.matchDarts1 > 0 ? ((m.matchScore1 / m.matchDarts1) * 3).toFixed(1) : "0.0";
        let avg2 = m.matchDarts2 > 0 ? ((m.matchScore2 / m.matchDarts2) * 3).toFixed(1) : "0.0";
        let titleStr = m.fase === 'poule' ? 'FIRST TO 3 LEGS (BO5)' : '🔥 FIRST TO 4 LEGS (BO7)';

        wrap.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1vh;">
                <span style="font-size:1.5rem; font-weight:bold; color:var(--gold);">${boardId.toUpperCase()} - ${titleStr}</span>
                <button class="retro-button danger" style="padding:4px 10px; font-size:1rem;" onclick="annuleerLopendeMatch('${m.id}')">Afbreken</button>
            </div>
            
            <div class="tablet-grid">
                <div class="pane ${m.turn===1?'active':''}">
                    <h3 class="pane-name">${m.p1}</h3>
                    <div class="pane-legs">LEGS: ${m.legs1}</div>
                    <div class="pane-score ${m.score1<=170?'checkout-ready':''}">${m.score1}</div>
                    <div class="pane-stats">Match Avg: ${avg1}</div>
                </div>
                
                <div class="pane ${m.turn===2?'active':''}">
                    <h3 class="pane-name">${m.p2}</h3>
                    <div class="pane-legs">LEGS: ${m.legs2}</div>
                    <div class="pane-score ${m.score2<=170?'checkout-ready':''}">${m.score2}</div>
                    <div class="pane-stats">Match Avg: ${avg2}</div>
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
    const m = state.matches.find(x => x.id === mId);
    m.board = boardId; m.status = 'bullen';
    appContainer.innerHTML = ''; 
    await saveState(true);
};

window.annuleerLopendeMatch = async function(mId) {
    if(confirm("Partij definitief wissen? Stats vervallen.")) {
        const m = state.matches.find(x => x.id === mId);
        m.status = 'waiting'; m.board = null; m.legs1 = 0; m.legs2 = 0; m.score1 = 501; m.score2 = 501;
        m.dartsLeg1 = 0; m.dartsLeg2 = 0; m.scoreLeg1 = 0; m.scoreLeg2 = 0;
        m.matchDarts1 = 0; m.matchScore1 = 0; m.matchDarts2 = 0; m.matchScore2 = 0;
        appContainer.innerHTML = '';
        await saveState(true);
    }
}

window.bevestigBullenWinnaar = async function(mId, pNum) {
    const m = state.matches.find(x => x.id === mId);
    const winNaam = pNum === 1 ? m.p1 : m.p2;
    state.stats[winNaam].bullsWon++;
    m.status = 'playing'; m.startThrower = pNum; m.turn = pNum;
    appContainer.innerHTML = '';
    await saveState(true);
}

window.sluitTablet = function() { document.getElementById('top-nav').style.display = 'flex'; currentView = 'dashboard'; appContainer.innerHTML = ''; render(); }

window.verwerkIngevuldeScore = async function(mId) {
    let score = parseInt(padInputString) || 0;
    padInputString = ""; 
    if (score < 0 || score > 180) { alert("Ongeldig (0-180)!"); return; }

    const m = state.matches.find(x => x.id === mId);
    const oldScore = m.turn === 1 ? m.score1 : m.score2;
    let newScore = oldScore - score;

    if (oldScore <= 170) {
        let isHit = (newScore === 0);
        showModal(`
            <h2>❌ DUBBEL TRACKING (${oldScore} over)</h2>
            <p>Hoeveel pijlen richting dubbel?</p>
            <div class="modal-grid-3">
                ${!isHit ? `<button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 0, false)">0 Darts</button>` : ''}
                <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 1, ${isHit})">1 Dart</button>
                <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 2, ${isHit})">2 Darts</button>
                <button class="modal-btn" onclick="bevestigDartsEnRekenUit('${m.id}', ${score}, 3, ${isHit})">3 Darts</button>
            </div>
        `);
    } else {
        await voerScoreTransactieUit(m, score, 0, false);
    }
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

    let calcScore = m[scStr] - score;
    let dartsThrown = isCheckout ? specDarts : 3;

    if (m[dtLegStr] < 9) {
        let maxC = Math.min(9 - m[dtLegStr], dartsThrown);
        state.stats[aP].first9Darts += maxC;
        state.stats[aP].first9Score += (score * (maxC/3)); 
    }

    if (calcScore < 0 || calcScore === 1) {
        state.stats[aP].totalDarts += 3;
        m[dtLegStr] += 3; m['matchDarts' + m.turn] += 3;
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

        if(score === 180) state.stats[aP].max180++;
        if(score >= 100) state.stats[aP].tonPlus++;

        let legAvg = ((m[scLegStr] / m[dtLegStr]) * 3).toFixed(1);
        if (m[dtLegStr] < state.stats[aP].shortestLeg.darts) state.stats[aP].shortestLeg = { darts: m[dtLegStr], avg: legAvg };
        if (m.turn !== m.startThrower) state.stats[aP].breaks++;

        if(m.turn === 1) m.legs1++; else m.legs2++;
        state.stats[m.p1].legsPlayed++; state.stats[m.p2].legsPlayed++;

        state.lastCheckout = { name: aP, score: score, time: Date.now() };

        let targets = m.fase === 'poule' ? 3 : 4;

        if(m.legs1 === targets || m.legs2 === targets) {
            m.status = 'finished';
            state.stats[m.p1].matchAvgs.push(parseFloat(((state.stats[m.p1].totalScore / state.stats[m.p1].totalDarts)*3).toFixed(1)));
            state.stats[m.p2].matchAvgs.push(parseFloat(((state.stats[m.p2].totalScore / state.stats[m.p2].totalDarts)*3).toFixed(1)));
            if (m.legs1 === 0 || m.legs2 === 0) state.stats[aP].whitewashes++;
            appContainer.innerHTML = '';
            await saveState(true);
            sluitTablet();
            return;
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
    if(score >= 100) state.stats[aP].tonPlus++;
    if(score === 180) state.stats[aP].max180++;

    m.turn = m.turn === 1 ? 2 : 1;
    await saveState(true);
}

function showModal(h) { document.getElementById('modal-content').innerHTML = h; document.getElementById('action-modal').style.display = 'flex'; }
function hideModal() { document.getElementById('action-modal').style.display = 'none'; }

init();
