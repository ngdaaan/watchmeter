import { POSITIONS, getISOStringFromDate, formatTime } from './utils.js';
import { calculateCycleStats, calculateStats, calculateRegulationAggregates, calculateMultiDayPoint, calculateMultiDayRate } from './calculations.js';
import { watchMic } from './audio.js';

let cycleCount = 0;
let mdCount = 0;

export function createRegulationCycle(cycleNumber) {
    cycleCount++;
    // If called with a specific number (loading), use it, but update internal count if needed?
    // Actually, loading calls with specific numbers, but usually sequential.
    // Let's just use the current count for ID generation to be safe, or manage it better.
    // The original code used a global counter.
    // When loading, we might want to respect the passed number for display but ensure unique IDs.
    // Simple fix: Always use cycleCount for ID.

    // However, if we load 3 cycles, we want cycleCount to be 3.
    // So we should probably sync cycleCount with DOM length on load or similar.
    // Or just increment.

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

    // Actually, createRegulationCycle increments cycleCount.
    // If we have 0 items, newCycleNumber is 1. cycleCount becomes 1. ID cycle-1.
    // If we delete cycle-1, we have 0 items. newCycleNumber is 1. cycleCount becomes 2. ID cycle-2.
    // This is fine.

    const cycleHTML = createRegulationCycle(newCycleNumber);
    container.insertAdjacentHTML('beforeend', cycleHTML);
    calculateTotalRegulationAverage();
}

export function removeRegulationCycle(cycleId) {
    const cycle = document.getElementById(cycleId);
    if (cycle) {
        cycle.remove();
        // Renumber cycles?
        // Original code didn't renumber IDs, just visual numbers?
        // Original code: createRegulationCycle took cycleNumber.
        // removeRegulationCycle just removed.
        // If we remove one in middle, visual numbers might be weird if we don't re-render.
        // But original code didn't re-render entire list.
        // Let's stick to original behavior: remove DOM element.
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

export function addMultiDayMeasurement() {
    mdCount++;
    const mdId = `md-${mdCount}`;
    const container = document.getElementById('multiDayGrid');

    const now = new Date();
    const dateStr = getISOStringFromDate(now);
    const { full: fullTimeStr, simple: simpleTimeStr } = formatTime(now);

    const mdHTML = `
        <div class="position-card multi-day-card" id="${mdId}">
            <div class="position-name" style="display:flex; justify-content:space-between; align-items:center;">
                <input type="date" class="md-date position-name" value="${dateStr}" onchange="calculateMultiDayStats()" style="border:none; background:transparent; font-weight:bold; color:var(--color-primary); font-family:inherit; cursor:pointer; margin-bottom:4px;">
                <button type="button" class="btn-danger no-print" onclick="removeMultiDayRow('${mdId}')">X</button>
            </div>
            
            <input type="hidden" class="md-ref-time" value="${fullTimeStr}">
            
            <div class="position-row">
                <span class="small-label">Time</span>
                <input type="text" class="md-watch-time" value="${simpleTimeStr}" onchange="calculateMultiDayStats()" placeholder="HH:MM:SS">
            </div>

            <div class="position-row">
                <span class="small-label">Dev</span>
                <span class="md-deviation">0.00</span>
                <span class="small-label">s</span>
            </div>

            <div class="position-row">
                <span class="small-label">Rate</span>
                <span class="md-rate">0.00</span>
                <span class="small-label">s/d</span>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', mdHTML);
    calculateMultiDayStats();
}

export function removeMultiDayRow(mdId) {
    const mdMeasurement = document.getElementById(mdId);
    if (mdMeasurement) {
        mdMeasurement.remove();
    }
    calculateMultiDayStats();
}

export function calculateMultiDayStats() {
    const cards = document.querySelectorAll('#multiDayGrid .position-card');
    let previousData = null;
    let firstData = null;
    let lastData = null;

    cards.forEach((card, i) => {
        const dateVal = card.querySelector('.md-date').value;
        const refTimeVal = card.querySelector('.md-ref-time').value;
        const watchTimeVal = card.querySelector('.md-watch-time').value;

        const deviationSpan = card.querySelector('.md-deviation');
        const rateSpan = card.querySelector('.md-rate');

        if (!dateVal || !refTimeVal || !watchTimeVal) {
            deviationSpan.textContent = '-';
            rateSpan.textContent = '-';
            return;
        }

        const parseTime = (dStr, tStr) => {
            const [h, m, sWithMs] = tStr.split(':');
            const [s, ms] = (sWithMs || '').split('.');
            if (!h || !m || !s) return null;
            const d = new Date(dStr);
            d.setHours(parseInt(h), parseInt(m), parseInt(s), ms ? parseInt(ms.padEnd(3, '0').substring(0, 3)) : 0);
            return d;
        };

        const refDate = parseTime(dateVal, refTimeVal);
        let watchDate = parseTime(dateVal, watchTimeVal);

        if (!refDate || !watchDate) {
            deviationSpan.textContent = '-';
            rateSpan.textContent = '-';
            return;
        }

        // Apply +200ms offset for human reaction time (matching previous logic)
        watchDate.setMilliseconds(watchDate.getMilliseconds() + 200);

        const deviation = calculateMultiDayPoint(refDate, watchDate);
        deviationSpan.textContent = deviation.toFixed(2);

        const currentData = { date: refDate, deviation: deviation };

        if (i === 0) firstData = currentData;
        lastData = currentData;

        if (previousData) {
            const rate = calculateMultiDayRate(previousData, currentData);
            rateSpan.textContent = rate;
        } else {
            rateSpan.textContent = '0.00';
        }

        previousData = currentData;
    });

    const totalAvgRateSpan = document.getElementById('totalAvgRate');
    const resultBox = totalAvgRateSpan.closest('.result-box');

    if (cards.length >= 2) {
        if (resultBox) resultBox.style.display = 'block';

        if (firstData && lastData && firstData !== lastData) {
            debugger;
            const avgRate = calculateMultiDayRate(firstData, lastData);
            // Logic check: The original code did:
            // totalDeltaDev = last - first
            // totalTimeDiff = last.date - first.date
            // avgRate = totalDeltaDev / totalTimeDiff
            // This is exactly what calculateMultiDayRate does given first and last data points!

            if (avgRate !== '0.00') { // Simplified check, or check days > 0
                totalAvgRateSpan.textContent = avgRate + ' s/d';
                const finalVarInput = document.getElementById('finalVariation');
                if (finalVarInput) finalVarInput.value = parseFloat(avgRate).toFixed(1);
            } else {
                totalAvgRateSpan.textContent = '0.00 s/d';
            }
        } else {
            totalAvgRateSpan.textContent = '0.00 s/d';
        }
    } else {
        totalAvgRateSpan.textContent = '0.00 s/d';
        if (resultBox) resultBox.style.display = 'none';
    }
}

export function handleBeforePrint() {
    const regCycles = document.getElementById('regulationCycles');
    if (regCycles) {
        const regSection = regCycles.closest('.section');
        const cycleCount = document.querySelectorAll('.regulation-cycle').length;
        if (cycleCount === 0) {
            regSection.classList.add('print-hidden');
        } else {
            regSection.classList.remove('print-hidden');
        }
    }

    const mdGrid = document.getElementById('multiDayGrid');
    if (mdGrid) {
        const mdSection = mdGrid.closest('.section');
        const mdCardCount = mdGrid.querySelectorAll('.position-card').length;
        if (mdCardCount === 0) {
            mdSection.classList.add('print-hidden');
        } else {
            mdSection.classList.remove('print-hidden');
        }
    }

    document.querySelectorAll('input[type="date"]').forEach(input => {
        const val = input.value;
        if (val) {
            const span = document.createElement('span');
            span.className = 'print-date-text';
            const parts = val.split('-');
            if (parts.length === 3) {
                const d = new Date(parts[0], parts[1] - 1, parts[2]);
                span.textContent = d.toLocaleDateString();
            } else {
                span.textContent = val;
            }
            input.parentNode.insertBefore(span, input.nextSibling);
        }
    });
}

export function handleAfterPrint() {
    document.querySelectorAll('.print-date-text').forEach(el => el.remove());
}

export function printForm() {
    window.print();
}

export function resetForm() {
    if (confirm('Reset all form data?')) {
        document.getElementById('watchForm').reset();
        document.getElementById('regulationCycles').innerHTML = '';
        document.getElementById('multiDayGrid').innerHTML = '';

        const regSummary = document.getElementById('regulationTotalAverage');
        if (regSummary) regSummary.remove();

        const mdRateSpan = document.getElementById('totalAvgRate');
        if (mdRateSpan) {
            mdRateSpan.textContent = '0.00 s/d';
            const mdResultBox = mdRateSpan.closest('.result-box');
            if (mdResultBox) mdResultBox.style.display = 'none';
        }

        cycleCount = 0;
        mdCount = 0;
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
