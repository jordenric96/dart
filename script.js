// Standaard spelerslijst
const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Jessy", "Stefaan", "Wim", "Tibe", "Kristof"];

// State van de app
let state = {
    fase: 'setup', 
    poules: { A: [], B: [] },
    matches: [],
    standings: { A: [], B: [] }
};

// DOM Elementen
const appContainer = document.getElementById('app-container');
const resetBtn = document.getElementById('reset-btn');

// --- INITIALISATIE ---
function init() {
    const savedState = localStorage.getItem('dartToernooiState');
    if (savedState) {
        state = JSON.parse(savedState);
    }
    render();
}

function saveState() {
    localStorage.setItem('dartToernooiState', JSON.stringify(state));
    render();
}

resetBtn.addEventListener('click', () => {
    if(confirm("Weet je zeker dat je ALLES wilt wissen? Dit kan niet ongedaan gemaakt worden!")) {
        localStorage.removeItem('dartToernooiState');
        state = { fase: 'setup', poules: { A: [], B: [] }, matches: [], standings: { A: [], B: [] } };
        render();
    }
});

// --- RENDER FUNCTIES ---
function render() {
    appContainer.innerHTML = '';
    
    if (state.fase === 'setup') renderSetup();
    else if (state.fase === 'loting') renderLoting();
    else if (state.fase === 'poules') renderPoules();
    else if (state.fase === 'knockouts') renderKnockouts();
}

// 1. SETUP FASE
function renderSetup() {
    let html = `
        <div class="card">
            <h2>Wie is er aanwezig?</h2>
            <p>Vink de spelers aan die meedoen. De computer verdeelt ze straks eerlijk over 2 poules.</p>
            <div class="player-checkboxes">
    `;
    
    alleSpelers.forEach(speler => {
        let checked = ["Jorden", "Yarni", "Joël", "Vince", "Jessy", "Stefaan", "Wim"].includes(speler) ? "checked" : "";
        html += `<label><input type="checkbox" class="speler-check" value="${speler}" ${checked}> ${speler}</label>`;
    });

    html += `
            </div>
            <button id="start-loting-btn" class="retro-button">🎯 Start Spannende Loting!</button>
        </div>
    `;
    appContainer.innerHTML = html;

    document.getElementById('start-loting-btn').addEventListener('click', () => {
        const aanwezigen = Array.from(document.querySelectorAll('.speler-check:checked')).map(cb => cb.value);
        if (aanwezigen.length < 4) {
            alert("Je hebt minimaal 4 spelers nodig voor een toernooi!");
            return;
        }
        voerLotingUit(aanwezigen);
    });
}

// 2. DE LOTING
function voerLotingUit(spelers) {
    for (let i = spelers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [spelers[i], spelers[j]] = [spelers[j], spelers[i]];
    }

    const helft = Math.ceil(spelers.length / 2);
    state.poules.A = spelers.slice(0, helft);
    state.poules.B = spelers.slice(helft);
    
    genereerWedstrijden();
    state.fase = 'loting';
    saveState();
}

function genereerWedstrijden() {
    state.matches = [];
    ['A', 'B'].forEach(poule => {
        let spelers = state.poules[poule];
        for (let i = 0; i < spelers.length; i++) {
            for (let j = i + 1; j < spelers.length; j++) {
                state.matches.push({
                    id: Math.random().toString(36).substr(2, 9),
                    poule: poule,
                    speler1: spelers[i],
                    speler2: spelers[j],
                    score1: null,
                    score2: null,
                    gespeeld: false
                });
            }
        }
    });
    berekenStanden();
}

function renderLoting() {
    appContainer.innerHTML = `
        <div class="card">
            <h2>De Loting is bekend!</h2>
            <div style="display:flex; justify-content:space-around; margin-top: 20px;">
                <div>
                    <h3>Poule A</h3>
                    ${state.poules.A.map((s, i) => `<div class="draw-reveal" style="animation-delay: ${i * 0.5}s">${s}</div>`).join('')}
                </div>
                <div>
                    <h3>Poule B</h3>
                    ${state.poules.B.map((s, i) => `<div class="draw-reveal" style="animation-delay: ${(state.poules.A.length + i) * 0.5}s">${s}</div>`).join('')}
                </div>
            </div>
            <button id="naar-poules-btn" class="retro-button" style="margin-top: 30px;">Let's Play Darts! ➡️</button>
        </div>
    `;

    document.getElementById('naar-poules-btn').addEventListener('click', () => {
        state.fase = 'poules';
        saveState();
    });
}

// 3. POULE FASE (Standen & Wedstrijden)
function renderPoules() {
    let html = '';
    ['A', 'B'].forEach(poule => {
        html += `
            <div class="card">
                <h2>Poule ${poule} - Stand</h2>
                <table class="retro-table">
                    <tr><th>Naam</th><th>#</th><th>W</th><th>G</th><th>V</th><th>PT</th><th>Legs</th></tr>
                    ${state.standings[poule].map(s => `
                        <tr>
                            <td style="text-align: left;"><strong>${s.naam}</strong></td>
                            <td>${s.gespeeld}</td>
                            <td>${s.winst}</td>
                            <td>${s.gelijk}</td>
                            <td>${s.verlies}</td>
                            <td class="punten-cel">${s.punten}</td>
                            <td>${s.legsVoor}-${s.legsTegen}</td>
                        </tr>
                    `).join('')}
                </table>

                <h3>Wedstrijden (Tot 4, of 3-3)</h3>
                ${state.matches.filter(m => m.poule === poule).map(m => `
                    <div class="match-row">
                        <span class="match-player speler1">${m.speler1}</span>
                        <div class="match-inputs">
                            <input type="number" min="0" max="4" class="score-input" data-id="${m.id}" data-speler="1" value="${m.score1 !== null ? m.score1 : ''}">
                            -
                            <input type="number" min="0" max="4" class="score-input" data-id="${m.id}" data-speler="2" value="${m.score2 !== null ? m.score2 : ''}">
                        </div>
                        <span class="match-player speler2">${m.speler2}</span>
                    </div>
                `).join('')}
            </div>
        `;
    });

    const alleGespeeld = state.matches.every(m => m.gespeeld);
    if (alleGespeeld) {
        html += `<div class="card"><button id="naar-knockouts-btn" class="retro-button">🏆 Sluit Poules & Start Halve Finales!</button></div>`;
    }

    appContainer.innerHTML = html;

    document.querySelectorAll('.score-input').forEach(input => {
        input.addEventListener('change', (e) => handleScoreChange(e.target));
    });

    if (alleGespeeld) {
        document.getElementById('naar-knockouts-btn').addEventListener('click', () => {
            state.fase = 'knockouts';
            saveState();
        });
    }
}

function handleScoreChange(input) {
    const matchId = input.getAttribute('data-id');
    const spelerNummer = input.getAttribute('data-speler');
    const waarde = input.value === '' ? null : parseInt(input.value);

    const match = state.matches.find(m => m.id === matchId);
    if (spelerNummer === '1') match.score1 = waarde;
    else match.score2 = waarde;

    match.gespeeld = (match.score1 !== null && match.score2 !== null);
    
    berekenStanden();
    saveState();
}

function berekenStanden() {
    ['A', 'B'].forEach(poule => {
        let stats = {};
        state.poules[poule].forEach(speler => {
            stats[speler] = { naam: speler, gespeeld: 0, winst: 0, gelijk: 0, verlies: 0, punten: 0, legsVoor: 0, legsTegen: 0, saldo: 0 };
        });

        state.matches.filter(m => m.poule === poule && m.gespeeld).forEach(m => {
            let s1 = stats[m.speler1];
            let s2 = stats[m.speler2];

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

// 4. KNOCKOUT FASE
function renderKnockouts() {
    const nr1A = state.standings.A[0].naam;
    const nr2A = state.standings.A[1] ? state.standings.A[1].naam : "N/A";
    const nr1B = state.standings.B[0].naam;
    const nr2B = state.standings.B[1] ? state.standings.B[1].naam : "N/A";

    appContainer.innerHTML = `
        <div class="card">
            <h2>🔥 HALVE FINALES 🔥</h2>
            <div style="font-size: 1.4em; margin: 20px 0;">
                <p><strong>Halve Finale 1:</strong><br> ${nr1A} (1e Poule A) 🆚 ${nr2B} (2e Poule B)</p>
                <hr style="border:1px dashed #ccc; margin:15px 0;">
                <p><strong>Halve Finale 2:</strong><br> ${nr1B} (1e Poule B) 🆚 ${nr2A} (2e Poule A)</p>
            </div>
        </div>

        <div class="card" style="border-color: var(--highlight-color); box-shadow: 6px 6px 0px 0px var(--highlight-color);">
            <h2 style="font-size: 2.5em;">🏆 DE GROTE FINALE 🏆</h2>
            <p style="font-size: 1.5em; font-style: italic;">Winnaar HF 1 🆚 Winnaar HF 2</p>
        </div>
    `;
}

init();
