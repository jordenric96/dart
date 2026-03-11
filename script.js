// Standaard spelerslijst
const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Jessy", "Stefaan", "Wim", "Tibe", "Kristof"];

// State van de app
let state = {
    fase: 'setup', 
    poules: { A: [], B: [] },
    matches: [],
    standings: { A: [], B: [] },
    knockouts: null, 
    lotingDeelnemers: [], 
    huidigeTrekking: null 
};

// DOM Elementen
const appContainer = document.getElementById('app-container');
const infoBoard = document.getElementById('info-board');
const resetBtn = document.getElementById('reset-btn');

// --- INITIALISATIE ---
function init() {
    const savedState = localStorage.getItem('dartToernooiState');
    if (savedState) state = JSON.parse(savedState);
    render();
}

function saveState() {
    localStorage.setItem('dartToernooiState', JSON.stringify(state));
    render();
}

resetBtn.addEventListener('click', () => {
    if(confirm("Weet je zeker dat je ALLES wilt wissen? Dit kan niet ongedaan gemaakt worden!")) {
        localStorage.removeItem('dartToernooiState');
        state = { fase: 'setup', poules: { A: [], B: [] }, matches: [], standings: { A: [], B: [] }, knockouts: null, lotingDeelnemers: [], huidigeTrekking: null };
        render();
    }
});

// --- RENDER FUNCTIES ---
function render() {
    appContainer.innerHTML = '';
    
    // Verberg info-board na setup
    infoBoard.style.display = state.fase === 'setup' ? 'flex' : 'none';
    
    if (state.fase === 'setup') renderSetup();
    else if (state.fase === 'loting') renderLoting();
    else if (state.fase === 'poules') {
        appContainer.innerHTML = generatePoulesHTML(true);
        attachPouleEvents(true);
    }
    else if (state.fase === 'knockouts') {
        renderKnockouts();
        // Toon geschiedenis van de poules onder de knockouts!
        let geschiedenis = document.createElement('div');
        geschiedenis.innerHTML = `<h2 style="margin-top:50px;">📜 TOERNOOI GESCHIEDENIS</h2>` + generatePoulesHTML(false);
        appContainer.appendChild(geschiedenis);
        attachPouleEvents(false);
    }
}

// 1. SETUP FASE
function renderSetup() {
    let html = `
        <div class="card">
            <h2>Wie is er aanwezig?</h2>
            <p>Vink de spelers aan die meedoen.</p>
            <div class="player-checkboxes">
    `;
    
    alleSpelers.forEach(speler => {
        let checked = ["Jorden", "Yarni", "Joël", "Vince", "Jessy", "Stefaan", "Wim"].includes(speler) ? "checked" : "";
        html += `<label><input type="checkbox" class="speler-check" value="${speler}" ${checked}> ${speler}</label>`;
    });

    html += `
            </div>
            <button id="start-loting-btn" class="retro-button">🎯 Start De Loting!</button>
        </div>
    `;
    appContainer.innerHTML = html;

    document.getElementById('start-loting-btn').addEventListener('click', () => {
        const aanwezigen = Array.from(document.querySelectorAll('.speler-check:checked')).map(cb => cb.value);
        if (aanwezigen.length < 4) { alert("Minimaal 4 spelers nodig!"); return; }
        voerLotingUit(aanwezigen);
    });
}

// 2. CHAMPIONS LEAGUE LOTING
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
    let html = `<div class="card" style="width: 100%; max-width: 600px;">
                    <h2 style="font-size: 2em;">🏆 DE POT 🏆</h2>`;

    if (state.huidigeTrekking) {
        html += `<div class="draw-reveal-big">
                    <h3 style="margin:0; color: #555;">Getrokken Speler:</h3>
                    <h1>${state.huidigeTrekking.naam}</h1>
                    <h2>➡️ POULE ${state.huidigeTrekking.poule}</h2>
                 </div>`;
    } else {
        html += `<div class="draw-reveal-big" id="suspense-box" style="display:none;">
                    <h1 id="spinning-name">???</h1>
                 </div>`;
         html += `<p id="loting-intro" style="font-size: 1.3em;">De namen zitten in de koker!</p>`;
    }

    if (state.lotingDeelnemers.length > 0) {
        html += `<button id="trek-btn" class="retro-button pulse-btn">🎲 Trek Speler <span style="font-size: 0.6em;">(${state.lotingDeelnemers.length} over)</span></button>`;
    } else {
        html += `<div class="alert" style="padding: 10px; margin: 20px 0; border-radius: 10px; border: 3px solid var(--border-color);">
                    <h3>✅ Alle poules zijn bekend!</h3>
                 </div>
                 <button id="naar-poules-btn" class="retro-button">Let's Play Darts! ➡️</button>`;
    }

    html += `<div style="display:flex; justify-content:space-between; margin-top: 30px; width: 100%;">
                <div class="poule-list"><h3>Poule A</h3><ul>${state.poules.A.map(s => `<li>${s}</li>`).join('')}</ul></div>
                <div class="poule-list"><h3>Poule B</h3><ul>${state.poules.B.map(s => `<li>${s}</li>`).join('')}</ul></div>
             </div></div>`;

    appContainer.innerHTML = html;

    if (state.lotingDeelnemers.length > 0) {
        document.getElementById('trek-btn').addEventListener('click', function() {
            // Suspense Animatie!
            this.style.display = 'none';
            if(document.getElementById('loting-intro')) document.getElementById('loting-intro').style.display = 'none';
            
            let suspenseBox = document.getElementById('suspense-box');
            if(!suspenseBox) {
                 suspenseBox = document.createElement('div');
                 suspenseBox.className = 'draw-reveal-big';
                 suspenseBox.innerHTML = '<h1 id="spinning-name">???</h1>';
                 this.parentNode.insertBefore(suspenseBox, this);
            }
            suspenseBox.style.display = 'block';
            let spinName = document.getElementById('spinning-name');
            
            let cycles = 0;
            let interval = setInterval(() => {
                spinName.innerText = state.lotingDeelnemers[Math.floor(Math.random() * state.lotingDeelnemers.length)];
                cycles++;
                if(cycles > 15) { // Na 1.5 seconde stopt het draaien
                    clearInterval(interval);
                    const speler = state.lotingDeelnemers.shift();
                    const poule = (state.poules.A.length <= state.poules.B.length) ? 'A' : 'B';
                    state.poules[poule].push(speler);
                    state.huidigeTrekking = { naam: speler, poule: poule };
                    saveState(); // Herlaad de pagina met de echte naam
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

// 3. GENEREREN EN TONEN VAN POULES
function genereerWedstrijden() {
    state.matches = [];
    ['A', 'B'].forEach(poule => {
        let spelers = state.poules[poule];
        for (let i = 0; i < spelers.length; i++) {
            for (let j = i + 1; j < spelers.length; j++) {
                state.matches.push({
                    id: Math.random().toString(36).substr(2, 9),
                    poule: poule, speler1: spelers[i], speler2: spelers[j],
                    score1: null, score2: null, locked: false
                });
            }
        }
    });
    berekenStanden();
}

// Functie gesplitst zodat we hem ook als 'geschiedenis' kunnen gebruiken
function generatePoulesHTML(isActief) {
    let html = '';
    ['A', 'B'].forEach(poule => {
        html += `<div class="card">
            <h2>Poule ${poule} - Stand</h2>
            <table class="retro-table">
                <tr><th>Naam</th><th>#</th><th>W</th><th>G</th><th>V</th><th>PT</th><th>Legs</th></tr>
                ${state.standings[poule].map(s => `
                    <tr><td style="text-align: left;"><strong>${s.naam}</strong></td>
                    <td>${s.gespeeld}</td><td>${s.winst}</td><td>${s.gelijk}</td><td>${s.verlies}</td><td class="punten-cel">${s.punten}</td><td>${s.legsVoor}-${s.legsTegen}</td></tr>
                `).join('')}
            </table>
            <h3>Wedstrijden</h3>
            ${state.matches.filter(m => m.poule === poule).map(m => `
                <div class="match-row">
                    <span class="match-player speler1">${m.speler1}</span>
                    <div class="match-inputs">
                        ${m.locked ? 
                            `<span class="locked-score">${m.score1} - ${m.score2}</span>
                             ${isActief ? `<button class="icon-btn unlock-btn" data-id="${m.id}">🔒</button>` : ''}` 
                        : 
                            `<input type="number" min="0" max="4" class="score-input p-score" data-id="${m.id}" data-speler="1" value="${m.score1 !== null ? m.score1 : ''}">
                             -
                             <input type="number" min="0" max="4" class="score-input p-score" data-id="${m.id}" data-speler="2" value="${m.score2 !== null ? m.score2 : ''}">
                             ${(m.score1 !== null && m.score2 !== null) ? `<button class="icon-btn lock-btn" data-id="${m.id}">✅</button>` : ''}`
                        }
                    </div>
                    <span class="match-player speler2">${m.speler2}</span>
                </div>
            `).join('')}
        </div>`;
    });

    if (isActief && state.matches.every(m => m.locked)) {
        html += `<div class="card"><button id="naar-knockouts-btn" class="retro-button pulse-btn">🏆 Sluit Poules & Start Halve Finales!</button></div>`;
    }
    return html;
}

function attachPouleEvents(isActief) {
    if(!isActief) return; // Geen events als het geschiedenis is
    document.querySelectorAll('.p-score').forEach(input => {
        input.addEventListener('change', (e) => handleScoreChange(e.target, state.matches));
    });
    document.querySelectorAll('.lock-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleLock(e.target.getAttribute('data-id'), true, state.matches));
    });
    document.querySelectorAll('.unlock-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleLock(e.target.getAttribute('data-id'), false, state.matches));
    });
    
    let btn = document.getElementById('naar-knockouts-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            initKnockouts();
            state.fase = 'knockouts';
            saveState();
        });
    }
}

// 4. SCORE & SLOTJES LOGICA
function handleScoreChange(input, matchArray) {
    const matchId = input.getAttribute('data-id');
    const spelerNummer = input.getAttribute('data-speler');
    const match = matchArray.find(m => m.id === matchId);
    
    match['score' + spelerNummer] = input.value === '' ? null : parseInt(input.value);
    saveState(); // Update de "✅" knop
}

function toggleLock(id, lockStatus, matchArray) {
    if (!lockStatus) {
        let code = prompt("Voer de code in om deze uitslag te wijzigen:");
        if (code !== "Nala" && code !== "nala") {
            alert("❌ Foutieve code!"); return;
        }
    }
    const match = matchArray.find(m => m.id === id);
    match.locked = lockStatus;
    
    if (matchArray === state.matches) berekenStanden();
    else if (matchArray === state.knockouts) updateFinaleSchema();
    
    saveState();
}

function berekenStanden() {
    ['A', 'B'].forEach(poule => {
        let stats = {};
        state.poules[poule].forEach(speler => {
            stats[speler] = { naam: speler, gespeeld: 0, winst: 0, gelijk: 0, verlies: 0, punten: 0, legsVoor: 0, legsTegen: 0, saldo: 0 };
        });

        // Enkel gelockte matches tellen mee voor de echte stand!
        state.matches.filter(m => m.poule === poule && m.locked).forEach(m => {
            let s1 = stats[m.speler1]; let s2 = stats[m.speler2];
            s1.gespeeld++; s2.gespeeld++;
            s1.legsVoor += m.score1; s1.legsTegen += m.score2;
            s2.legsVoor += m.score2; s2.legsTegen += m.score1;

            if (m.score1 > m.score2) { s1.winst++; s1.punten += 2; s2.verlies++; }
            else if (m.score1 < m.score2) { s2.winst++; s2.punten += 2; s1.verlies++; }
            else { s1.gelijk++; s2.gelijk++; s1.punten += 1; s2.punten += 1; }
        });

        let arrayStand = Object.values(stats);
        arrayStand.forEach(s => s.saldo = s.legsVoor - s.legsTegen);
        arrayStand.sort((a, b) => {
            if (b.punten !== a.punten) return b.punten - a.punten;
            if (b.saldo !== a.saldo) return b.saldo - a.saldo;
            return b.legsVoor - a.legsVoor;
        });
        state.standings[poule] = arrayStand;
    });
}

// 5. KNOCK-OUT LOGICA
function initKnockouts() {
    state.knockouts = [
        { id: 'hf1', speler1: state.standings.A[0].naam, speler2: (state.standings.B[1]?.naam || "Bye"), score1: null, score2: null, locked: false },
        { id: 'hf2', speler1: state.standings.B[0].naam, speler2: (state.standings.A[1]?.naam || "Bye"), score1: null, score2: null, locked: false },
        { id: 'fin', speler1: 'Winnaar HF 1', speler2: 'Winnaar HF 2', score1: null, score2: null, locked: false }
    ];
}

function updateFinaleSchema() {
    let hf1 = state.knockouts[0];
    let hf2 = state.knockouts[1];
    let fin = state.knockouts[2];

    if (hf1.locked) fin.speler1 = hf1.score1 > hf1.score2 ? hf1.speler1 : hf1.speler2;
    else fin.speler1 = 'Winnaar HF 1';

    if (hf2.locked) fin.speler2 = hf2.score1 > hf2.score2 ? hf2.speler1 : hf2.speler2;
    else fin.speler2 = 'Winnaar HF 2';
}

function renderKnockouts() {
    let html = `
        <div class="card">
            <h2>🔥 HALVE FINALES 🔥</h2>
            ${renderKnockoutMatch(state.knockouts[0])}
            <hr style="border:1px dashed #ccc; margin:15px 0;">
            ${renderKnockoutMatch(state.knockouts[1])}
        </div>
        <div class="card" style="border-color: var(--highlight-color); box-shadow: 6px 6px 0px 0px var(--highlight-color);">
            <h2 style="font-size: 2.5em;">🏆 DE GROTE FINALE 🏆</h2>
            ${renderKnockoutMatch(state.knockouts[2])}
        </div>
    `;
    
    let container = document.createElement('div');
    container.innerHTML = html;
    appContainer.appendChild(container);

    document.querySelectorAll('.k-score').forEach(input => {
        input.addEventListener('change', (e) => handleScoreChange(e.target, state.knockouts));
    });
    document.querySelectorAll('.lock-k-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleLock(e.target.getAttribute('data-id'), true, state.knockouts));
    });
    document.querySelectorAll('.unlock-k-btn').forEach(btn => {
        btn.addEventListener('click', (e) => toggleLock(e.target.getAttribute('data-id'), false, state.knockouts));
    });
}

function renderKnockoutMatch(m) {
    return `
        <div class="match-row" style="font-size: 1.4em;">
            <span class="match-player speler1"><strong>${m.speler1}</strong></span>
            <div class="match-inputs">
                ${m.locked ? 
                    `<span class="locked-score">${m.score1} - ${m.score2}</span>
                     <button class="icon-btn unlock-k-btn" data-id="${m.id}">🔒</button>` 
                : 
                    `<input type="number" min="0" max="7" class="score-input k-score" data-id="${m.id}" data-speler="1" value="${m.score1 !== null ? m.score1 : ''}">
                     -
                     <input type="number" min="0" max="7" class="score-input k-score" data-id="${m.id}" data-speler="2" value="${m.score2 !== null ? m.score2 : ''}">
                     ${(m.score1 !== null && m.score2 !== null) ? `<button class="icon-btn lock-k-btn" data-id="${m.id}">✅</button>` : ''}`
                }
            </div>
            <span class="match-player speler2"><strong>${m.speler2}</strong></span>
        </div>
    `;
}

init();
