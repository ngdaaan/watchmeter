import { POSITIONS, getISOStringFromDate } from './utils.js';
import { calculateCycleStats, calculateRegulationAggregates } from './calculations.js';
import { watchMic } from './audio.js';

let cycleCount = 0;

export function createRegulationCycle(cycleNumber) {
    cycleCount++;
    const cycleId = `cycle-${cycleCount}`;

    return `
        <div class="regulation-cycle" id="${cycleId}">
            <div class="cycle-header">
                <span class="cycle-number">${cycleNumber}</span>
                <div class="cycle-header-inputs">
                    <label for="cycle-temp">Temp</label>
                    <input type="number" class="cycle-temp cycle-input" placeholder="°C">
                    <label for="cycle-pr">PR</label>
                    <input type="number" class="cycle-pr cycle-input" placeholder="%">
                    <input type="date" class="cycle-date cycle-input" value="${getISOStringFromDate()}">
                    <button type="button" class="btn-danger no-print" onclick="removeRegulationCycle('${cycleId}')">X</button>
                </div>
            </div>

            <div class="position-grid">
                ${POSITIONS.map((pos, idx) => `
                    <div class="position-card">
                        <div class="position-name" style="display:flex; justify-content:space-between; align-items:center;">
                            <span>${pos.name}</span>
                            <button type="button" class="btn-record no-print" onclick="startWatchListening('${cycleId}', ${idx}, this)" title="Record"></button>
                        </div>
                        <div class="position-info-msg" style="font-size:11px; color:var(--color-primary); display:none; margin-bottom:4px;"></div>
                        <div class="position-row">
                            <span class="small-label">Beat:</span>
                            <input type="number" class="beat-error" placeholder="0.00" step="0.01" data-position="${idx}" oninput="calculateCycleSummary('${cycleId}')">
                            <span class="small-label">ms</span>
                        </div>
                        <div class="position-row">
                            <span class="small-label">Rate:</span>
                            <input type="number" class="rate-per-day" placeholder="+/-" step="0.1" data-position="${idx}" oninput="calculateCycleSummary('${cycleId}')">
                            <span class="small-label">s/d</span>
                        </div>
                    </div>
                `).join('')}
            </div>
            <input type="text" class="cycle-notes" placeholder="Notes for this regulation cycle...">
            <div class="cycle-summary" style="margin-top: 8px; display: none; background: rgba(33, 128, 141, 0.05); padding: 8px; border-radius: 4px; font-size: 14px;"></div>
        </div>
    `;
}

export function addRegulationCycle() {
    const container = document.getElementById('regulationCycles');
    const newCycleNumber = container.querySelectorAll('.regulation-cycle').length + 1;
    // Sync cycleCount just in case used out of order
    cycleCount = Math.max(cycleCount, newCycleNumber - 1); // Ensure we don't conflict

    const cycleHTML = createRegulationCycle(newCycleNumber);
    container.insertAdjacentHTML('beforeend', cycleHTML);
    calculateTotalRegulationAverage();
}

export function removeRegulationCycle(cycleId) {
    const cycle = document.getElementById(cycleId);
    if (cycle) {
        cycle.remove();
    }
    calculateTotalRegulationAverage();
}

export function calculateCycleSummary(cycleId) {
    const cycle = document.getElementById(cycleId);
    if (!cycle) return;

    const beatErrors = Array.from(cycle.querySelectorAll('.beat-error')).map(el => el.value === '' ? null : parseFloat(el.value)).filter(v => v !== null);
    const rates = Array.from(cycle.querySelectorAll('.rate-per-day')).map(el => el.value === '' ? null : parseFloat(el.value)).filter(v => v !== null);

    const { avgBeatError, avgRate, maxRate, minRate, variation } = calculateCycleStats(beatErrors, rates);

    const summary = cycle.querySelector('.cycle-summary');
    summary.innerHTML = `<strong>Cycle Summary:</strong> Avg Beat Error: <b>${avgBeatError} ms</b> | Avg Rate: <b>${avgRate} s/d</b> | Best: <b>${maxRate}</b> | Worst: <b>${minRate}</b> | Delta: <b>${variation} s/d</b>`;
    summary.style.display = 'block';

    calculateTotalRegulationAverage();
}

export function calculateTotalRegulationAverage() {
    const cycles = document.querySelectorAll('.regulation-cycle');

    // Extract data from DOM
    const cyclesData = Array.from(cycles).map(cycle => {
        const beatErrors = Array.from(cycle.querySelectorAll('.beat-error')).map(el => el.value === '' ? null : parseFloat(el.value)).filter(v => v !== null);
        const rates = Array.from(cycle.querySelectorAll('.rate-per-day')).map(el => el.value === '' ? null : parseFloat(el.value)).filter(v => v !== null);
        return { beatErrors, rates };
    });

    const { globalAvgRate, globalAvgBeat, rateCount } = calculateRegulationAggregates(cyclesData);

    let totalDiv = document.getElementById('regulationTotalAverage');

    if (cycles.length > 0) {
        if (!totalDiv) {
            totalDiv = document.createElement('div');
            totalDiv.id = 'regulationTotalAverage';
            totalDiv.className = 'result-box';
            document.getElementById('regulationCycles').after(totalDiv);
        }
        totalDiv.style.display = 'block';
        totalDiv.innerHTML = `Overall Average: <strong>Avg Beat Error: ${globalAvgBeat} ms | Avg Rate: ${globalAvgRate} s/d</strong>`;

        const finalRateInput = document.getElementById('finalRate');
        if (finalRateInput && rateCount > 0) {
            finalRateInput.value = globalAvgRate;
        }
    } else {
        if (totalDiv) {
            totalDiv.style.display = 'none';
        }
    }
}

export function startWatchListening(cycleId, positionIndex, btnElement) {
    const card = btnElement.closest('.position-card');
    const statusDiv = card.querySelector('.position-info-msg');
    const beatInput = card.querySelector('.beat-error');
    const rateInput = card.querySelector('.rate-per-day');

    if (watchMic.isListening) {
        watchMic.stop();
        statusDiv.textContent = 'Cancelled.';
        statusDiv.style.color = 'var(--color-text-secondary)';
        btnElement.classList.remove('recording-active');

        document.querySelectorAll('.btn-record').forEach(b => b.disabled = false);

        setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
        return;
    }

    statusDiv.style.display = 'block';
    statusDiv.style.color = 'var(--color-primary)';
    statusDiv.textContent = 'Initializing...';

    document.querySelectorAll('.btn-record').forEach(b => {
        if (b !== btnElement) b.disabled = true;
    });

    btnElement.classList.add('recording-active');

    watchMic.start(
        (timeLeft, ticks, level, state, stats) => {
            const vol = Math.min(100, Math.round(level * 400));

            let statusText = '';
            if (state === 'DETECTING') {
                statusText = `Detecting BPH... ${timeLeft}s (Vol: ${vol}%)`;
            } else if (state === 'MEASURING') {
                statusText = `Measuring... ${timeLeft}s (Vol: ${vol}%)`;
                if (stats) {
                    statusText += ` | ${stats.bph} BPH`;
                    rateInput.value = stats.rate;
                    beatInput.value = stats.beatError;
                    calculateCycleSummary(cycleId);
                }
            } else {
                statusText = `Listening... ${timeLeft}s`;
            }

            statusDiv.textContent = statusText;
            statusDiv.style.color = 'var(--color-primary)';
        },
        (result) => {
            btnElement.classList.remove('recording-active');
            document.querySelectorAll('.btn-record').forEach(b => b.disabled = false);

            if (result.error) {
                statusDiv.textContent = `Error: ${result.error}`;
                statusDiv.style.color = 'var(--color-error)';
            } else {
                statusDiv.textContent = `Done! ${result.bph} BPH`;
                statusDiv.style.color = 'var(--color-success)';

                beatInput.value = result.beatError;
                rateInput.value = result.rate;

                calculateCycleSummary(cycleId);
            }
            setTimeout(() => {
                if (!result.error) statusDiv.style.display = 'none';
            }, 5000);
        },
        (err) => {
            console.error(err);
            btnElement.classList.remove('recording-active');
            document.querySelectorAll('.btn-record').forEach(b => b.disabled = false);

            statusDiv.textContent = `Mic Error: ${err.message}`;
            statusDiv.style.color = 'var(--color-error)';
        }
    );
}

export function resetRegulationState() {
    cycleCount = 0;
    document.getElementById('regulationCycles').innerHTML = '';
    const regSummary = document.getElementById('regulationTotalAverage');
    if (regSummary) regSummary.remove();
}
