// --- JOUW DATA VOOR DE REKENING ---
const financiën = {
    collectAndGoTotaal: 0.00, 
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

const alleSpelers = ["Jorden", "Yarni", "Joël", "Vince", "Jessy", "Stefaan", "Wim", "Tibe"];

let state = {
    fase: 'setup', poules: { A: [], B: [] }, matches: [], standings: { A: [], B: [] }, knockouts: null, lotingDeelnemers: [], huidigeTrekking: null, statsCO: [], stats180: []
};

const appContainer = document.getElementById('app-container');
const infoBoard = document.getElementById('info-board');
const mainHeader = document.getElementById('main-header');
const resetBtn = document.getElementById('reset-btn');
const resetZone = document.getElementById('reset-zone');

function init() {
    const savedState = localStorage.getItem('dartToernooiState');
    if (savedState) state = JSON.parse(savedState);
    render();
    setupFrietModal();
}

function saveState(skipRender = false) {
    localStorage.setItem('dartToernooiState', JSON.stringify(state));
    if(!skipRender) render();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

resetBtn.addEventListener('click', () => {
    if(confirm("Weet je zeker dat je ALLES wilt wissen?")) {
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
        if(resetZone) resetZone.style.display = 'block';
        renderSetup();
    } else if (state.fase === 'loting') {
        if(infoBoard) infoBoard.style.display = 'none';
        if(mainHeader) mainHeader.style.display = 'none'; 
        if(resetZone) resetZone.style.display = 'block';
        renderLoting();
    } else {
        if(infoBoard) infoBoard.style.display = 'none';
        if(mainHeader) mainHeader.style.display = 'none'; 
        if(resetZone) resetZone.style.display = 'none'; 
        renderDashboard();
    }
}

function renderSetup() {
    let html = `<div class="card" style="max-width: 600px; margin: 0 auto;"><h2>Wie is er aanwezig?</h2><div class="player-checkboxes">`;
    alleSpelers.forEach(speler => {
        html += `<label><input type="checkbox" class="speler-check" value="${speler}" checked> ${speler}</label>`;
    });
    html += `</div><button id="start-loting-btn" class="retro-button" style="font-size: 1.5em; padding: 10px 20px;">🎯 Start De Loting!</button></div>`;
    appContainer.innerHTML = html;

    document.getElementById('start-loting-btn').addEventListener('click', () => {
        const aanwezigen = Array.from(document.querySelectorAll('.speler-check:checked')).map(cb => cb.value);
        if (aanwezigen.length < 4) { alert("Minimaal 4 spelers!"); return; }
        
        let code = prompt("Voer de startcode in om het toernooi te beginnen:");
        if (code !== "1403") { alert("❌ Foutieve code!"); return; }

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
    let html = `<div style="width: 100%; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center;">`;

    // De basis kaders voor de effecten
    html += `<div class="loting-mega-box" id="cinematic-box">
                <div class="spotlight left" id="sl-l"></div>
                <div class="spotlight right" id="sl-r"></div>
                <div class="firework-flash fw-1" id="fw1"></div>
                <div class="firework-flash fw-2" id="fw2"></div>
                <div class="firework-flash fw-3" id="fw3"></div>
                <div class="vague-names-bg" id="vague-names-area"></div>
                
                <h1 id="cinematic-text">DE PIJLEN ZIJN GESLEPEN...<br><br>DE BORDEN HANGEN KLAAR...</h1>
                
                <div id="koker-content" style="display:none; width:100%;">
                    <h3>SPELER:</h3>
                    <h1 id="spinning-name">???</h1>
                    <div id="poule-reveal-area" style="display:none; width: 100%;">
                        <h3>POULE:</h3>
                        <div id="spinning-poule" class="loting-poule-box" style="width: fit-content; margin: 0 auto;">?</div>
                    </div>
                </div>
             </div>`;

    html += `<div style="display:flex; justify-content:space-around; margin-top: 3vh; width: 100%; max-width: 1200px; margin-left: auto; margin-right: auto;">
                <div class="poule-list"><h3>POULE A</h3><ul id="poule-a-list">${state.poules.A.map(s => `<li>${s}</li>`).join('')}</ul></div>
                <div class="poule-list"><h3>POULE B</h3><ul id="poule-b-list">${state.poules.B.map(s => `<li>${s}</li>`).join('')}</ul></div>
             </div></div>`;

    appContainer.innerHTML = html;

    if (state.lotingDeelnemers.length > 0) {
        startAudioEnTijdlijn();
    } else {
        // Fallback als de loting al klaar was bij het herladen
        let cBox = document.getElementById('cinematic-box');
        document.getElementById('cinematic-text').style.display = 'none';
        document.getElementById('koker-content').style.display = 'block';
        document.getElementById('poule-reveal-area').style.display = 'block';
        document.getElementById('spinning-name').innerText = "LOTING KLAAR";
        document.getElementById('spinning-poule').innerText = "✓";
        cBox.innerHTML += `<button id="naar-poules-btn" class="retro-button" style="font-size: clamp(1.5rem, 4vw, 2.5rem); padding: 2vh 4vw; margin-top: 2vh; background-color: #4CAF50; color: white;">🏆 Let's Play Darts! ➡️</button>`;
        document.getElementById('naar-poules-btn').addEventListener('click', () => {
            if (state.matches.length === 0) genereerWedstrijden();
            state.fase = 'poules';
            saveState();
        });
    }
}

// --- DE SUPER TIJDLIJN MET MUZIEK ---
async function startAudioEnTijdlijn() {
    const audio = new Audio('song.mp3');
    audio.play().catch(e => console.log("Muziek kon niet automatisch starten door browserbeveiliging."));

    const vNamesArea = document.getElementById('vague-names-area');
    const cinText = document.getElementById('cinematic-text');
    const kokerContent = document.getElementById('koker-content');
    const spinName = document.getElementById('spinning-name');
    const spinPoule = document.getElementById('spinning-poule');

    // Genereer wazige achtergrondnamen uit de echte deelnemers
    if (vNamesArea) {
        vNamesArea.innerHTML = state.lotingDeelnemers.map(s => `<span>${s}</span>`).join('') + state.lotingDeelnemers.map(s => `<span>${s}</span>`).join('');
    }

    // [0 - 20 SECONDEN]: Zwart scherm met spotlights, vuurwerk en vage namen (loopt via CSS)
    await sleep(20000);

    // [20 - 26 SECONDEN]: Introtekst wijzigt naar de opbouw-hype tekst
    if (cinText) cinText.innerHTML = "MAAK JULLIE KLAAR...";
    await sleep(6000); 

    // [26 SECONDEN]: Namen beginnen direct supersnel te ratelen/scrambelen!
    if (cinText) cinText.style.display = 'none';
    if (kokerContent) kokerContent.style.display = 'block';

    // Start direct de visuele koker-animatie
    let intervalName = setInterval(() => {
        spinName.innerText = state.lotingDeelnemers[Math.floor(Math.random() * state.lotingDeelnemers.length)];
    }, 70);

    // [26 -> 32.5 SECONDEN]: Ratelen gedurende exact 6.5 seconden tot de climax
    await sleep(6500); 
    clearInterval(intervalName); // Stop het ratelen precies op 32.5 seconden!

    // Trek de ALLEREERSTE speler exact op 32,5 seconden
    const eersteSpeler = state.lotingDeelnemers.shift();
    spinName.innerText = eersteSpeler;

    // Direct poule bepalen voor de eerste speler
    document.getElementById('poule-reveal-area').style.display = 'block';
    let validPoules = ['A', 'B'];
    const eerstePoule = validPoules[Math.floor(Math.random() * validPoules.length)];
    spinPoule.innerText = eerstePoule;

    // Voeg toe en update de visuele lijst onderaan direct
    state.poules[eerstePoule].push(eersteSpeler);
    document.getElementById('poule-a-list').innerHTML = state.poules.A.map(s => `<li>${s}</li>`).join('');
    document.getElementById('poule-b-list').innerHTML = state.poules.B.map(s => `<li>${s}</li>`).join('');
    saveState(true);

    // Wacht 2 seconden om te genieten van de eerste trekking
    await sleep(2500);

    // --- VERVOLG VAN DE LOTING ---
    // De rest van de 7 spelers wordt volautomatisch getrokken terwijl de muziek doorloopt
    while (state.lotingDeelnemers.length > 0) {
        await trekAutomatischVolgendeSpeler();
        await sleep(1500); // Pauze tussen spelers
    }

    // Alles klaar! Toon de grote groene knop om naar het toernooi te gaan
    document.getElementById('poule-reveal-area').style.display = 'block';
    document.getElementById('koker-content').innerHTML = `<h1>✅ Alle poules zijn bekend!</h1><button id="naar-poules-btn" class="retro-button" style="font-size: clamp(1.5rem, 4vw, 2.5rem); padding: 2vh 4vw; margin-top: 2vh; background-color: #4CAF50; color: white;">🏆 Let's Play Darts! ➡️</button>`;
    
    document.getElementById('naar-poules-btn').addEventListener('click', () => {
        if (state.matches.length === 0) genereerWedstrijden();
        state.fase = 'poules';
        saveState();
    });
}

// Functie voor de overige 7 spelers (kortere, vloeiende animatie)
function trekAutomatischVolgendeSpeler() {
    return new Promise(resolve => {
        document.getElementById('poule-reveal-area').style.display = 'none';
        let spinName = document.getElementById('spinning-name');
        let spinPoule = document.getElementById('spinning-poule');
        spinName.innerText = "???";

        let cyclesName = 0;
        let intervalName = setInterval(() => {
            spinName.innerText = state.lotingDeelnemers[Math.floor(Math.random() * state.lotingDeelnemers.length)];
            cyclesName++;
            
            if(cyclesName > 12) {
                clearInterval(intervalName);
                const speler = state.lotingDeelnemers.shift(); 
                spinName.innerText = speler; 

                setTimeout(() => {
                    document.getElementById('poule-reveal-area').style.display = 'block';
                    
                    let validPoules = [];
                    if (state.poules.A.length < 4) validPoules.push('A');
                    if (state.poules.B.length < 4) validPoules.push('B');

                    let cyclesPoule = 0;
                    let intervalPoule = setInterval(() => {
                        spinPoule.innerText = (Math.random() > 0.5) ? 'A' : 'B'; 
                        cyclesPoule++;
                        
                        if (cyclesPoule > 12) {
                            clearInterval(intervalPoule);
                            const poule = validPoules[Math.floor(Math.random() * validPoules.length)];
                            spinPoule.innerText = poule;
                            
                            state.poules[poule].push(speler);
                            
                            document.getElementById('poule-a-list').innerHTML = state.poules.A.map(s => `<li>${s}</li>`).join('');
                            document.getElementById('poule-b-list').innerHTML = state.poules.B.map(s => `<li>${s}</li>`).join('');
                            
                            saveState(true);
                            resolve(); 
                        }
                    }, 70);
                }, 500);
            }
        }, 80);
    });
}

// -----------------------------------

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
    html += `<div class="grid-col">${generatePouleHTML('A')}</div>`;
    html += `<div class="grid-col">${generatePouleHTML('B')}</div>`;
    
    html += `<div class="grid-col">`;
    if (state.fase === 'knockouts' && state.knockouts) {
        html += generateKnockoutsHTML();
    } else if (state.matches.every(m => m.locked)) {
        html += `<div class="card" style="margin-bottom: 1vh;"><button id="naar-knockouts-btn" class="retro-button">🏆 Start Halve Finales!</button></div>`;
    }
    html += generateStatsHTML();
    html += `</div></div>`;

    appContainer.innerHTML = html;
    attachEvents();
}

function generatePouleHTML(poule) {
    let html = `<div class="card">
        <h2>Poule ${poule} Stand</h2>
        <table class="retro-table">
            <tr><th>Naam</th><th>#</th><th>W</th><th>G</th><th>V</th><th>PT</th><th>Legs</th></tr>
            ${state.standings[poule].map(s => `
                <tr><td style="text-align: left;"><strong>${s.naam}</strong></td>
                <td>${s.gespeeld}</td><td>${s.winst}</td><td>${s.gelijk}</td><td>${s.verlies}</td><td class="punten-cel">${s.punten}</td><td>${s.legsVoor}-${s.legsTegen}</td></tr>
            `).join('')}
        </table>
        <h3>Wedstrijden</h3>
        <div style="flex: 1; display: flex; flex-direction: column;">`;
        
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
    return html + `</div></div>`;
}

function generateKnockoutsHTML() {
    let html = `<div class="card" style="border-color: var(--highlight-color); margin-bottom: 1vh;">
        <h2>🔥 KNOCK-OUTS 🔥</h2><div style="flex:1; display:flex; flex-direction:column; justify-content:center;">`;
    
    state.knockouts.forEach((m, index) => {
        if (index === 2) html += `<hr style="border:1px dashed #ccc; margin:1vh 0;"><h3>🏆 FINALE 🏆</h3>`;
        html += `
        <div class="match-container" style="border:none;">
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
    return html + `</div></div>`;
}

function generateStatsHTML() {
    let html = `<div class="card"><h2>📊 Stats</h2><div style="flex:1; display:flex; flex-direction:column; justify-content:space-around;">`;
    html += `<div><h3>🔥 Checkouts</h3><table class="retro-table stat-table"><tr><th>Speler</th><th>Uitgooi</th></tr>`;
    if (state.statsCO.length === 0) html += `<tr><td colspan="2">-</td></tr>`;
    else state.statsCO.slice(0, 5).forEach(co => html += `<tr><td>${co.naam}</td><td><strong>${co.score}</strong></td></tr>`);
    html += `</table></div>`;

    html += `<div><h3>🍺 180/171's</h3><table class="retro-table stat-table"><tr><th>Speler</th><th>Aantal</th></tr>`;
    if (state.stats180.length === 0) html += `<tr><td colspan="2">-</td></tr>`;
    else state.stats180.slice(0, 5).forEach(m => html += `<tr><td>${m.naam}</td><td><strong>${m.count}</strong></td></tr>`);
    html += `</table></div></div></div>`;

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
    saveState(true); 
    
    if(match.score1 !== null && match.score2 !== null) {
        saveState(); 
    }
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
    let actieveSpelers = (state.poules.A.length > 0 || state.poules.B.length > 0) ? state.poules.A.concat(state.poules.B) : (state.lotingDeelnemers.length > 0 ? state.lotingDeelnemers : alleSpelers);
    const collectGoPerPersoon = actieveSpelers.length > 0 ? (financiën.collectAndGoTotaal / actieveSpelers.length) : 0;

    let html = `<p><strong>🛒 Collect & Go Totaal:</strong> €${financiën.collectAndGoTotaal.toFixed(2)}</p><p><strong>👥 Gedeeld door ${actieveSpelers.length} spelers:</strong> €${collectGoPerPersoon.toFixed(2)} p.p.</p><table class="receipt-table"><tr><th>Speler</th><th>Frituur Bestelling</th><th>Te Betalen</th></tr>`;

    actieveSpelers.forEach(speler => {
        let bestelling = financiën.bestellingen[speler] || { item: "Geen bestelling", prijs: 0.00 };
        html += `<tr><td><strong>${speler}</strong></td><td style="font-size: 0.9em; color: #555;">${bestelling.item}<br>(€${bestelling.prijs.toFixed(2)})</td><td class="total-row">€${(collectGoPerPersoon + bestelling.prijs).toFixed(2)}</td></tr>`;
    });
    rekeningInhoud.innerHTML = html + `</table>`;
}

init();
