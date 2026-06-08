// --- JOUW DATA VOOR DE REKENING ---
const financiën = {
    collectAndGoTotaal: 0.00, // Vul hier later de prijs in
    rekeningNummer: "BE00 0000 0000 0000 (Op naam van ...)", 
    bestellingen: {
        "Jorden": { item: "Groot pak + Bicky", prijs: 0.00 },
        "Yarni": { item: "Klein pak + Viandel", prijs: 0.00 },
        "Joël": { item: "Friet speciaal", prijs: 0.00 },
        "Vince": { item: "Friet stoofvlees", prijs: 0.00 },
        "Jessy": { item: "Groot pak + Curryworst", prijs: 0.00 },
        "Stefaan": { item: "Friet + satékruiden", prijs: 0.00 },
        "Wim": { item: "Frietje mayo", prijs: 0.00 },
        "Tibe": { item: "Familiepak", prijs: 0.00 }
    }
};
// --------------------------------------------------------

const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Jessy", "Stefaan", "Wim", "Tibe"];

let state = {
    fase: 'setup', 
    poules: { A: [], B: [] },
    matches: [],
    standings: { A: [], B: [] },
    knockouts: null, 
    lotingDeelnemers: [], 
    huidigeTrekking: null,
    statsCO: [],
    stats180: []
};

// DOM Elementen
const appContainer = document.getElementById('app-container');
const infoBoard = document.getElementById('info-board');
const mainHeader = document.getElementById('main-header');
const resetBtn = document.getElementById('reset-btn');

const frietBtn = document.getElementById('friet-btn');
const frietModal = document.getElementById('friet-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const rekeningInhoud = document.getElementById('rekening-inhoud');
const rekeningNummerDisplay = document.getElementById('rekening-nummer-display');

function init() {
    const savedState = localStorage.getItem('dartToernooiState');
    if (savedState) state = JSON.parse(savedState);
    render();
    setupFrietModal();
}

function saveState() {
    localStorage.setItem('dartToernooiState', JSON.stringify(state));
    render();
}

resetBtn.addEventListener('click', () => {
    if(confirm("Weet je zeker dat je ALLES wilt wissen? Dit kan niet ongedaan gemaakt worden!")) {
        localStorage.removeItem('dartToernooiState');
        state = { fase: 'setup', poules: { A: [], B: [] }, matches: [], standings: { A: [], B: [] }, knockouts: null, lotingDeelnemers: [], huidigeTrekking: null, statsCO: [], stats180: [] };
        render();
    }
});

function render() {
    appContainer.innerHTML = '';
    
    if (state.fase === 'setup') {
        if(infoBoard) infoBoard.style.display = 'flex';
        if(mainHeader) mainHeader.style.display = 'block';
        renderSetup();
    } else if (state.fase === 'loting') {
        if(infoBoard) infoBoard.style.display = 'none';
        if(mainHeader) mainHeader.style.display = 'block';
        renderLoting();
    } else {
        if(infoBoard) infoBoard.style.display = 'none';
        if(mainHeader) mainHeader.style.display = 'none'; 
        renderDashboard();
    }
}

function renderSetup() {
    let html = `<div class="card" style="max-width: 600px; margin: 0 auto;"><h2>Wie is er aanwezig?</h2><div class="player-checkboxes">`;
    alleSpelers.forEach(speler => {
        html += `<label><input type="checkbox" class="speler-check" value="${speler}" checked> ${speler}</label>`;
    });
    html += `</div><button id="start-loting-btn" class="retro-button">🎯 Start De Loting!</button></div>`;
    appContainer.innerHTML = html;

    document.getElementById('start-loting-btn').addEventListener('click', () => {
        const aanwezigen = Array.from(document.querySelectorAll('.speler-check:checked')).map(cb => cb.value);
        if (aanwezigen.length < 4) { alert("Minimaal 4 spelers nodig!"); return; }
        voerLotingUit(aanwezigen);
    });
}

function voerLotingUit(spelers) {
    for (let i = spelers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spelers[i], spelers[j]] = [spelers[j], spelers[i]];
    }
    state.lotingDeelnemers = spelers;
    state.poules = { A: [], B: [] };
    state.huidigeTrekking = null;
    state.matches = []; 
    state.fase = 'loting';
    saveState();
}

function renderLoting() {
    let html = `<div class="card" style="margin: 0 auto; max-width: 600px;"><h2>🏆 DE POT 🏆</h2>`;

    if (state.huidigeTrekking) {
        // Wat we zien als een speler + poule volledig getrokken is
        html += `<div class="draw-reveal-big">
                    <h3 style="margin:0; color: #555;">Speler:</h3>
                    <h1>${state.huidigeTrekking.naam}</h1>
                    <h3 style="margin:10px 0 0 0; color: #555;">Poule:</h3>
                    <h2 style="font-size: 2em; margin: 0; background-color: var(--border-color); color: #fff; display: inline-block; padding: 5px 15px; border-radius: 5px;">${state.huidigeTrekking.poule}</h2>
                 </div>`;
    } else {
        // Startscherm van de loting
        html += `<div class="draw-reveal-big" id="suspense-box" style="display:none;">
                    <h3 style="margin:0; color: #555;">Speler:</h3>
                    <h1 id="spinning-name">???</h1>
                    <div id="poule-reveal-area" style="display:none;">
                        <h3 style="margin:10px 0 0 0; color: #555;">Poule:</h3>
                        <h2 id="spinning-poule" style="font-size: 2em; margin: 0; background-color: var(--border-color); color: #fff; display: inline-block; padding: 5px 15px; border-radius: 5px;">?</h2>
                    </div>
                 </div>
                 <p id="loting-intro">De namen zitten in de koker!</p>`;
    }

    if (state.lotingDeelnemers.length > 0) {
        html += `<button id="trek-btn" class="retro-button" style="font-size: 1.3em; padding: 10px 20px;">🎲 Trek Speler (${state.lotingDeelnemers.length})</button>`;
    } else {
        html += `<div class="alert" style="padding: 10px; margin: 10px 0; border: 2px solid var(--border-color);"><h3>✅ Poules bekend!</h3></div><button id="naar-poules-btn" class="retro-button">Let's Play Darts! ➡️</button>`;
    }

    html += `<div style="display:flex; justify-content:space-around; margin-top: 15px; width: 100%;">
                <div class="poule-list"><h3>Poule A</h3><ul>${state.poules.A.map(s => `<li>${s}</li>`).join('')}</ul></div>
                <div class="poule-list"><h3>Poule B</h3><ul>${state.poules.B.map(s => `<li>${s}</li>`).join('')}</ul></div>
             </div></div>`;

    appContainer.innerHTML = html;

    if (state.lotingDeelnemers.length > 0) {
        document.getElementById('trek-btn').addEventListener('click', function() {
            this.style.display = 'none';
            if(document.getElementById('loting-intro')) document.getElementById('loting-intro').style.display = 'none';
            
            let suspenseBox = document.getElementById('suspense-box');
            if(suspenseBox) {
                suspenseBox.style.display = 'block';
                document.getElementById('poule-reveal-area').style.display = 'none'; // Verberg poule deel eerst
            }
            
            let spinName = document.getElementById('spinning-name');
            let spinPoule = document.getElementById('spinning-poule');
            
            // FASE 1: SPELER TREKKEN (Draait 1.5 seconden)
            let cyclesName = 0;
            let intervalName = setInterval(() => {
                spinName.innerText = state.lotingDeelnemers[Math.floor(Math.random() * state.lotingDeelnemers.length)];
                cyclesName++;
                
                if(cyclesName > 15) {
                    clearInterval(intervalName);
                    // Haal de getrokken speler officieel uit de pot
                    const speler = state.lotingDeelnemers.shift(); 
                    spinName.innerText = speler; // Laat hem staan

                    // FASE 2: KORTE PAUZE, DAN POULE TREKKEN
                    setTimeout(() => {
                        document.getElementById('poule-reveal-area').style.display = 'block';
                        
                        // Kijk welke poules nog plaats hebben (max 4 per poule)
                        let validPoules = [];
                        if (state.poules.A.length < 4) validPoules.push('A');
                        if (state.poules.B.length < 4) validPoules.push('B');

                        let cyclesPoule = 0;
                        let intervalPoule = setInterval(() => {
                            // Wissel snel tussen A en B voor het effect
                            spinPoule.innerText = (Math.random() > 0.5) ? 'A' : 'B'; 
                            cyclesPoule++;
                            
                            if (cyclesPoule > 15) {
                                clearInterval(intervalPoule);
                                // Kies ECHT een poule uit de beschikbare opties
                                const poule = validPoules[Math.floor(Math.random() * validPoules.length)];
                                spinPoule.innerText = poule;
                                
                                // FASE 3: OPSLAAN EN RESULTAAT LATEN ZIEN
                                state.poules[poule].push(speler);
                                state.huidigeTrekking = { naam: speler, poule: poule };
                                
                                setTimeout(() => { saveState(); }, 1200); // 1.2s wachten voor de pagina ververst
                            }
                        }, 80); // Poule draait ietsjes sneller

                    }, 800); // Wacht 0.8s tussen speler en poule animatie
                }
            }, 100);
        });
    } else {
        document.getElementById('naar-poules-btn').addEventListener('click', () => {
            if (state.matches.length === 0) genereerWedstrijden();
            state.fase = 'poules';
            saveState();
        });
    }
}

function genereerWedstrijden() {
    state.matches = [];
    ['A', 'B'].forEach(poule => {
        let spelers = state.poules[poule];
        for (let i = 0; i < spelers.length; i++) {
            for (let j = i + 1; j < spelers.length; j++) {
                state.matches.push({
                    id: Math.random().toString(36).substr(2, 9),
                    poule: poule, speler1: spelers[i], speler2: spelers[j],
                    score1: null, score2: null, co1: '', co2: '', max1: '', max2: '', locked: false
                });
            }
        }
    });
    berekenStandenEnStats();
}

function renderDashboard() {
    let html = `<div class="dashboard-grid">`;
    html += `<div>${generatePouleHTML('A')}</div>`;
    html += `<div>${generatePouleHTML('B')}</div>`;
    
    html += `<div>`;
    if (state.fase === 'knockouts' && state.knockouts) {
        html += generateKnockoutsHTML();
    } else if (state.matches.every(m => m.locked)) {
        html += `<div class="card" style="margin-bottom: 10px;"><button id="naar-knockouts-btn" class="retro-button">🏆 Start Halve Finales!</button></div>`;
    }
    html += generateStatsHTML();
    html += `</div></div>`;

    appContainer.innerHTML = html;
    attachEvents();
}

function generatePouleHTML(poule) {
    let html = `<div class="card">
        <h2 style="font-size: 1.2em;">Poule ${poule} Stand</h2>
        <table class="retro-table">
            <tr><th>Naam</th><th>#</th><th>W</th><th>G</th><th>V</th><th>PT</th><th>Legs</th></tr>
            ${state.standings[poule].map(s => `
                <tr><td style="text-align: left;"><strong>${s.naam}</strong></td>
                <td>${s.gespeeld}</td><td>${s.winst}</td><td>${s.gelijk}</td><td>${s.verlies}</td><td class="punten-cel">${s.punten}</td><td>${s.legsVoor}-${s.legsTegen}</td></tr>
            `).join('')}
        </table>
        <h3 style="margin-top: 5px; font-size: 1.1em;">Wedstrijden</h3>`;
        
    html += state.matches.filter(m => m.poule === poule).map(m => `
        <div class="match-container">
            <div class="match-row">
                <span class="match-player speler1">${m.speler1}</span>
                <div class="match-inputs">
                    ${m.locked ? 
                        `<span class="locked-score">${m.score1}-${m.score2}</span><button class="icon-btn unlock-btn" data-id="${m.id}" data-array="matches">🔒</button>` 
                    : 
                        `<input type="number" min="0" max="4" class="score-input data-input" data-id="${m.id}" data-field="score1" data-array="matches" value="${m.score1 !== null ? m.score1 : ''}">
                         -
                         <input type="number" min="0" max="4" class="score-input data-input" data-id="${m.id}" data-field="score2" data-array="matches" value="${m.score2 !== null ? m.score2 : ''}">
                         ${(m.score1 !== null && m.score2 !== null) ? `<button class="icon-btn lock-btn" data-id="${m.id}" data-array="matches">✅</button>` : ''}`
                    }
                </div>
                <span class="match-player speler2">${m.speler2}</span>
            </div>
            <div class="match-extras">
                <div class="extra-box">CO: <input type="text" class="extra-input co-input data-input" data-id="${m.id}" data-field="co1" data-array="matches" value="${m.co1}" ${m.locked ? 'disabled' : ''}> 180: <input type="number" min="0" class="extra-input max-input data-input" data-id="${m.id}" data-field="max1" data-array="matches" value="${m.max1}" ${m.locked ? 'disabled' : ''}></div>
                <strong>|</strong>
                <div class="extra-box">CO: <input type="text" class="extra-input co-input data-input" data-id="${m.id}" data-field="co2" data-array="matches" value="${m.co2}" ${m.locked ? 'disabled' : ''}> 180: <input type="number" min="0" class="extra-input max-input data-input" data-id="${m.id}" data-field="max2" data-array="matches" value="${m.max2}" ${m.locked ? 'disabled' : ''}></div>
            </div>
        </div>
    `).join('');
    return html + `</div>`;
}

function generateKnockoutsHTML() {
    let html = `<div class="card" style="border-color: var(--highlight-color); margin-bottom: 10px;">
        <h2 style="font-size: 1.2em;">🔥 KNOCK-OUTS 🔥</h2>`;
    
    state.knockouts.forEach((m, index) => {
        if (index === 2) html += `<hr style="border:1px dashed #ccc; margin:5px 0;"><h3 style="font-size: 1.1em;">🏆 FINALE 🏆</h3>`;
        html += `
        <div class="match-container">
            <div class="match-row">
                <span class="match-player speler1">${m.speler1}</span>
                <div class="match-inputs">
                    ${m.locked ? `<span class="locked-score">${m.score1}-${m.score2}</span><button class="icon-btn unlock-btn" data-id="${m.id}" data-array="knockouts">🔒</button>` : `<input type="number" min="0" max="7" class="score-input data-input" data-id="${m.id}" data-field="score1" data-array="knockouts" value="${m.score1 !== null ? m.score1 : ''}">-<input type="number" min="0" max="7" class="score-input data-input" data-id="${m.id}" data-field="score2" data-array="knockouts" value="${m.score2 !== null ? m.score2 : ''}">${(m.score1 !== null && m.score2 !== null) ? `<button class="icon-btn lock-btn" data-id="${m.id}" data-array="knockouts">✅</button>` : ''}`}
                </div>
                <span class="match-player speler2">${m.speler2}</span>
            </div>
            <div class="match-extras">
                <div class="extra-box">CO: <input type="text" class="extra-input co-input data-input" data-id="${m.id}" data-field="co1" data-array="knockouts" value="${m.co1}" ${m.locked ? 'disabled' : ''}> 180: <input type="number" min="0" class="extra-input max-input data-input" data-id="${m.id}" data-field="max1" data-array="knockouts" value="${m.max1}" ${m.locked ? 'disabled' : ''}></div>
                <strong>|</strong>
                <div class="extra-box">CO: <input type="text" class="extra-input co-input data-input" data-id="${m.id}" data-field="co2" data-array="knockouts" value="${m.co2}" ${m.locked ? 'disabled' : ''}> 180: <input type="number" min="0" class="extra-input max-input data-input" data-id="${m.id}" data-field="max2" data-array="knockouts" value="${m.max2}" ${m.locked ? 'disabled' : ''}></div>
            </div>
        </div>`;
    });
    return html + `</div>`;
}

function generateStatsHTML() {
    let html = `<div class="card"><h2 style="font-size: 1.2em;">📊 Stats</h2>`;
    html += `<h3 style="margin-top:5px; font-size: 1em;">🔥 Checkouts</h3><table class="retro-table stat-table"><tr><th>Speler</th><th>Uitgooi</th></tr>`;
    if (state.statsCO.length === 0) html += `<tr><td colspan="2">-</td></tr>`;
    else state.statsCO.slice(0, 5).forEach(co => html += `<tr><td>${co.naam}</td><td><strong>${co.score}</strong></td></tr>`);
    html += `</table>`;

    html += `<h3 style="margin-top:10px; font-size: 1em;">🍺 180/171's</h3><table class="retro-table stat-table"><tr><th>Speler</th><th>Aantal</th></tr>`;
    if (state.stats180.length === 0) html += `<tr><td colspan="2">-</td></tr>`;
    else state.stats180.slice(0, 5).forEach(m => html += `<tr><td>${m.naam}</td><td><strong>${m.count}</strong></td></tr>`);
    html += `</table></div>`;

    return html;
}

function attachEvents() {
    document.querySelectorAll('.data-input').forEach(input => { input.addEventListener('change', (e) => handleDataChange(e.target)); });
    document.querySelectorAll('.lock-btn').forEach(btn => { btn.addEventListener('click', (e) => toggleLock(e.target, true)); });
    document.querySelectorAll('.unlock-btn').forEach(btn => { btn.addEventListener('click', (e) => toggleLock(e.target, false)); });
    
    let koBtn = document.getElementById('naar-knockouts-btn');
    if (koBtn) koBtn.addEventListener('click', () => { initKnockouts(); state.fase = 'knockouts'; saveState(); });
}

function handleDataChange(input) {
    const id = input.getAttribute('data-id'); const field = input.getAttribute('data-field'); const arrayName = input.getAttribute('data-array');
    const targetArray = state[arrayName]; const match = targetArray.find(m => m.id === id);
    if (field.includes('score')) match[field] = input.value === '' ? null : parseInt(input.value); else match[field] = input.value;
    saveState();
}

function toggleLock(btn, lockStatus) {
    const id = btn.getAttribute('data-id'); const arrayName = btn.getAttribute('data-array'); const targetArray = state[arrayName];
    if (!lockStatus) { let code = prompt("Voer de code in:"); if (code !== "Nala" && code !== "nala") { alert("❌ Fout!"); return; } }
    const match = targetArray.find(m => m.id === id); match.locked = lockStatus;
    berekenStandenEnStats(); if (arrayName === 'knockouts') updateFinaleSchema();
    saveState();
}

function berekenStandenEnStats() {
    ['A', 'B'].forEach(poule => {
        let stats = {}; state.poules[poule].forEach(speler => { stats[speler] = { naam: speler, gespeeld: 0, winst: 0, gelijk: 0, verlies: 0, punten: 0, legsVoor: 0, legsTegen: 0, saldo: 0 }; });
        state.matches.filter(m => m.poule === poule && m.locked).forEach(m => {
            let s1 = stats[m.speler1]; let s2 = stats[m.speler2];
            s1.gespeeld++; s2.gespeeld++; s1.legsVoor += m.score1; s1.legsTegen += m.score2; s2.legsVoor += m.score2; s2.legsTegen += m.score1;
            if (m.score1 > m.score2) { s1.winst++; s1.punten += 2; s2.verlies++; } else if (m.score1 < m.score2) { s2.winst++; s2.punten += 2; s1.verlies++; } else { s1.gelijk++; s2.gelijk++; s1.punten += 1; s2.punten += 1; }
        });
        let arrayStand = Object.values(stats);
        arrayStand.forEach(s => s.saldo = s.legsVoor - s.legsTegen);
        arrayStand.sort((a, b) => { if (b.punten !== a.punten) return b.punten - a.punten; if (b.saldo !== a.saldo) return b.saldo - a.saldo; return b.legsVoor - a.legsVoor; });
        state.standings[poule] = arrayStand;
    });

    let tempCO = []; let temp180 = {};
    let alleGelockteMatches = state.matches.filter(m => m.locked);
    if (state.knockouts) alleGelockteMatches = alleGelockteMatches.concat(state.knockouts.filter(m => m.locked));

    alleGelockteMatches.forEach(m => {
        if (m.max1) { temp180[m.speler1] = (temp180[m.speler1] || 0) + parseInt(m.max1); } if (m.max2) { temp180[m.speler2] = (temp180[m.speler2] || 0) + parseInt(m.max2); }
        if (m.co1) m.co1.split(',').forEach(co => { let val = parseInt(co.trim()); if(!isNaN(val)) tempCO.push({naam: m.speler1, score: val}); });
        if (m.co2) m.co2.split(',').forEach(co => { let val = parseInt(co.trim()); if(!isNaN(val)) tempCO.push({naam: m.speler2, score: val}); });
    });
    state.statsCO = tempCO.sort((a, b) => b.score - a.score);
    state.stats180 = Object.keys(temp180).map(k => ({naam: k, count: temp180[k]})).filter(x => x.count > 0).sort((a, b) => b.count - a.count);
}

function initKnockouts() {
    state.knockouts = [
        { id: 'hf1', speler1: state.standings.A[0].naam, speler2: (state.standings.B[1]?.naam || "Bye"), score1: null, score2: null, co1: '', co2: '', max1: '', max2: '', locked: false },
        { id: 'hf2', speler1: state.standings.B[0].naam, speler2: (state.standings.A[1]?.naam || "Bye"), score1: null, score2: null, co1: '', co2: '', max1: '', max2: '', locked: false },
        { id: 'fin', speler1: 'Winnaar HF 1', speler2: 'Winnaar HF 2', score1: null, score2: null, co1: '', co2: '', max1: '', max2: '', locked: false }
    ];
}

function updateFinaleSchema() {
    let hf1 = state.knockouts[0]; let hf2 = state.knockouts[1]; let fin = state.knockouts[2];
    if (hf1.locked) fin.speler1 = hf1.score1 > hf1.score2 ? hf1.speler1 : hf1.speler2; else fin.speler1 = 'Winnaar HF 1';
    if (hf2.locked) fin.speler2 = hf2.score1 > hf2.score2 ? hf2.speler1 : hf2.speler2; else fin.speler2 = 'Winnaar HF 2';
}

// --- FRIET & REKENING LOGICA ---
function setupFrietModal() {
    const frietBtn = document.getElementById('friet-btn');
    const frietModal = document.getElementById('friet-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const rekeningInhoud = document.getElementById('rekening-inhoud');
    const rekeningNummerDisplay = document.getElementById('rekening-nummer-display');

    if (frietBtn) {
        frietBtn.addEventListener('click', () => {
            genereerRekening(rekeningNummerDisplay, rekeningInhoud);
            frietModal.style.display = 'flex';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            frietModal.style.display = 'none';
        });
    }

    if (frietModal) {
        frietModal.addEventListener('click', (e) => {
            if(e.target === frietModal) frietModal.style.display = 'none';
        });
    }
}

function genereerRekening(rekeningNummerDisplay, rekeningInhoud) {
    rekeningNummerDisplay.innerText = financiën.rekeningNummer;
    
    let actieveSpelers = [];
    if (state.poules.A.length > 0 || state.poules.B.length > 0) {
        actieveSpelers = state.poules.A.concat(state.poules.B);
    } else if (state.lotingDeelnemers.length > 0) {
        actieveSpelers = state.lotingDeelnemers;
    } else {
        actieveSpelers = alleSpelers; 
    }

    const aantalSpelers = actieveSpelers.length;
    const collectGoPerPersoon = aantalSpelers > 0 ? (financiën.collectAndGoTotaal / aantalSpelers) : 0;

    let html = `
        <p><strong>🛒 Collect & Go Totaal:</strong> €${financiën.collectAndGoTotaal.toFixed(2)}</p>
        <p><strong>👥 Gedeeld door ${aantalSpelers} spelers:</strong> €${collectGoPerPersoon.toFixed(2)} p.p.</p>
        
        <table class="receipt-table">
            <tr>
                <th>Speler</th>
                <th>Frituur Bestelling</th>
                <th>Te Betalen</th>
            </tr>
    `;

    actieveSpelers.forEach(speler => {
        let bestelling = financiën.bestellingen[speler] || { item: "Geen bestelling", prijs: 0.00 };
        let totaalPersoon = collectGoPerPersoon + bestelling.prijs;
        
        html += `
            <tr>
                <td><strong>${speler}</strong></td>
                <td style="font-size: 0.9em; color: #555;">${bestelling.item}<br>(€${bestelling.prijs.toFixed(2)})</td>
                <td class="total-row">€${totaalPersoon.toFixed(2)}</td>
            </tr>
        `;
    });

    html += `</table>`;
    rekeningInhoud.innerHTML = html;
}

init();
