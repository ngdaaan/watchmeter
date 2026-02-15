const POSITIONS = [
    { name: 'Dial Up', abbr: 'DU' },
    { name: 'Dial Down', abbr: 'DD' },
    { name: 'Crown Up', abbr: 'CU' },
    { name: 'Crown Down', abbr: 'CD' },
    { name: 'Crown Right', abbr: 'CR' },
    { name: 'Crown Left', abbr: 'CL' }
];

let cycleCount = 0;

function createRegulationCycle(cycleNumber) {
    cycleCount++;
    const cycleId = `cycle-${cycleCount}`;

    const cycleHTML = `
        <div class="regulation-cycle" id="${cycleId}">
            <div class="cycle-header">
                <span class="cycle-number">${cycleNumber}</span>
                <div class="cycle-header-inputs">
                    <label for="cycle-temp">Temp</label>
                    <input type="number" class="cycle-temp cycle-input" placeholder="°C">
                    <label for="cycle-pr">PR</label>
                    <input type="number" class="cycle-pr cycle-input" placeholder="%">
                    <input type="date" class="cycle-date cycle-input" value="${new Date().toISOString().split('T')[0]}">
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

    return cycleHTML;
}

function addRegulationCycle() {
    const container = document.getElementById('regulationCycles');
    const newCycleNumber = container.querySelectorAll('.regulation-cycle').length + 1;
    const cycleHTML = createRegulationCycle(newCycleNumber);
    container.insertAdjacentHTML('beforeend', cycleHTML);
    calculateTotalRegulationAverage();
}

function removeRegulationCycle(cycleId) {
    const cycle = document.getElementById(cycleId);
    if (cycle) {
        cycle.remove();
    }
    calculateTotalRegulationAverage();
}

function calculateCycleSummary(cycleId) {
    const cycle = document.getElementById(cycleId);
    const beatErrors = Array.from(cycle.querySelectorAll('.beat-error')).map(el => el.value === '' ? null : parseFloat(el.value)).filter(v => v !== null);
    const rates = Array.from(cycle.querySelectorAll('.rate-per-day')).map(el => el.value === '' ? null : parseFloat(el.value)).filter(v => v !== null);

    let avgBeatError = '0.00';
    let avgRate = '0.0';
    let maxRate = '0.0';
    let minRate = '0.0';
    let variation = '0.0';

    if (beatErrors.length > 0) {
        avgBeatError = (beatErrors.reduce((a, b) => a + b, 0) / beatErrors.length).toFixed(2);
    }

    if (rates.length > 0) {
        avgRate = (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1);
        maxRate = Math.max(...rates).toFixed(1);
        minRate = Math.min(...rates).toFixed(1);
        variation = (Math.abs(maxRate - minRate)).toFixed(1);
    }

    const summary = cycle.querySelector('.cycle-summary');
    // Single line summary
    summary.innerHTML = `<strong>Cycle Summary:</strong> Avg Beat Error: <b>${avgBeatError} ms</b> | Avg Rate: <b>${avgRate} s/d</b> | Best: <b>${maxRate}</b> | Worst: <b>${minRate}</b> | Delta: <b>${variation} s/d</b>`;
    summary.style.display = 'block';

    calculateTotalRegulationAverage();
}

function calculateTotalRegulationAverage() {
    const cycles = document.querySelectorAll('.regulation-cycle');
    let totalRate = 0;
    let totalBeat = 0;
    let rateCount = 0;
    let beatCount = 0;

    cycles.forEach(cycle => {
        const beatErrors = Array.from(cycle.querySelectorAll('.beat-error')).map(el => el.value === '' ? null : parseFloat(el.value)).filter(v => v !== null);
        const rates = Array.from(cycle.querySelectorAll('.rate-per-day')).map(el => el.value === '' ? null : parseFloat(el.value)).filter(v => v !== null);

        if (beatErrors.length > 0) {
            const cycleAvgBeat = beatErrors.reduce((a, b) => a + b, 0) / beatErrors.length;
            totalBeat += cycleAvgBeat;
            beatCount++;
        }

        if (rates.length > 0) {
            const cycleAvgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
            totalRate += cycleAvgRate;
            rateCount++;
        }
    });

    const globalAvgRate = rateCount > 0 ? (totalRate / rateCount).toFixed(1) : '0.0';
    const globalAvgBeat = beatCount > 0 ? (totalBeat / beatCount).toFixed(2) : '0.00';

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

        // Auto-populate Final Rate
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

// --- Multi-Day Testing Logic ---

let mdCount = 0;

function addMultiDayMeasurement() {
    mdCount++;
    const mdId = `md-${mdCount}`;
    const container = document.getElementById('multiDayGrid');

    // Set default date/time to now
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0').substring(0, 3);
    const fullTimeStr = `${h}:${m}:${s}.${ms}`;
    const simpleTimeStr = `${h}:${m}:${s}`;

    const mdHTML = `
        <div class="position-card multi-day-card" id="${mdId}">
            <div class="position-name" style="display:flex; justify-content:space-between; align-items:center;">
                <input type="date" class="md-date position-name" value="${dateStr}" onchange="calculateMultiDayStats()" style="border:none; background:transparent; font-weight:bold; color:var(--color-primary); font-family:inherit; cursor:pointer; margin-bottom:4px;">
                <button type="button" class="btn-danger no-print" onclick="removeMultiDayRow('${mdId}')">X</button>
            </div>
            
            <!-- Hidden Ref Time (Used for calc) -->
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

// Helper to remove a specific measurement row
function removeMultiDayRow(mdId) {
    const mdMeasurement = document.getElementById(mdId);
    if (mdMeasurement) {
        mdMeasurement.remove();
    }
    calculateMultiDayStats();
}

function calculateMultiDayStats() {
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

        // Basic validation
        if (!dateVal || !refTimeVal || !watchTimeVal) {
            deviationSpan.textContent = '-';
            rateSpan.textContent = '-';
            return;
        }

        // Need to reconstruct datetime objects
        // Helper to parse time string HH:MM:SS.mmm
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

        // Add 200ms user reaction time compensation to Watch Time
        watchDate.setMilliseconds(watchDate.getMilliseconds() + 200);

        // Deviation = Watch - Ref (in seconds)
        const deviation = (watchDate - refDate) / 1000;
        deviationSpan.textContent = deviation.toFixed(2);

        const currentData = { date: refDate, deviation: deviation };

        if (i === 0) firstData = currentData;
        lastData = currentData;

        // Calculate rate from previous point
        if (previousData) {
            // Time difference in days
            const timeDiffDays = (currentData.date - previousData.date) / (1000 * 60 * 60 * 24);

            if (timeDiffDays > 0) {
                // Rate
                const deltaDeviation = currentData.deviation - previousData.deviation;
                const rate = deltaDeviation / timeDiffDays;
                rateSpan.textContent = rate.toFixed(2);
            } else {
                rateSpan.textContent = '0.00';
            }
        } else {
            rateSpan.textContent = '0.00'; // First point has no rate
        }

        previousData = currentData;
    });

    // Total Average Rate
    const totalAvgRateSpan = document.getElementById('totalAvgRate');
    const resultBox = totalAvgRateSpan.closest('.result-box');

    if (cards.length >= 2) {
        // We have enough points to potentially calculate
        if (resultBox) resultBox.style.display = 'block';

        if (firstData && lastData && firstData !== lastData) {
            const totalTimeDiffDays = (lastData.date - firstData.date) / (1000 * 60 * 60 * 24);

            if (Math.abs(totalTimeDiffDays) > 0.001) { // Avoid divide by zero/tiny diffs
                const totalDeltaDev = lastData.deviation - firstData.deviation;
                const avgRate = totalDeltaDev / totalTimeDiffDays;
                totalAvgRateSpan.textContent = avgRate.toFixed(2) + ' s/d';

                // Auto-populate Final Assessment
                const finalVarInput = document.getElementById('finalVariation');
                if (finalVarInput) finalVarInput.value = avgRate.toFixed(1);
            } else {
                // Time difference too small, just show 0.00
                totalAvgRateSpan.textContent = '0.00 s/d';
            }
        } else {
            totalAvgRateSpan.textContent = '0.00 s/d';
        }
    } else {
        // Not enough data
        totalAvgRateSpan.textContent = '0.00 s/d';
        if (resultBox) resultBox.style.display = 'none';
    }

}

function handleBeforePrint() {
    // Check Regulation Cycles
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

    // Check Multi-Day Measurements - Updated for Grid
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

    // Replace Date Inputs with Text Spans
    document.querySelectorAll('input[type="date"]').forEach(input => {
        const val = input.value;
        if (val) {
            const span = document.createElement('span');
            span.className = 'print-date-text';
            // Format date (optional, stick to value for accuracy/simplicity or formatting)
            // Let's try to format it nicely if possible, or just keep raw YYYY-MM-DD
            // Given 'Watch Service', ISO is okay, but 'Feb 11, 2026' is nicer.
            // Doing safe local parse:
            const parts = val.split('-');
            if (parts.length === 3) {
                const d = new Date(parts[0], parts[1] - 1, parts[2]);
                span.textContent = d.toLocaleDateString();
            } else {
                span.textContent = val;
            }

            // Copy styles if needed? The class has font-weight bold.
            // Insert after
            input.parentNode.insertBefore(span, input.nextSibling);
        }
    });
}

function handleAfterPrint() {
    // Remove the text spans
    document.querySelectorAll('.print-date-text').forEach(el => el.remove());
}

window.addEventListener('beforeprint', handleBeforePrint);
window.addEventListener('afterprint', handleAfterPrint);

function printForm() {
    window.print();
}

function resetForm() {
    if (confirm('Reset all form data?')) {
        document.getElementById('watchForm').reset();
        document.getElementById('regulationCycles').innerHTML = '';
        document.getElementById('multiDayGrid').innerHTML = '';

        // Remove checks/summaries
        const regSummary = document.getElementById('regulationTotalAverage');
        if (regSummary) regSummary.remove();

        // Reset Multi-Day Result
        const mdRateSpan = document.getElementById('totalAvgRate');
        if (mdRateSpan) {
            mdRateSpan.textContent = '0.00 s/d';
            const mdResultBox = mdRateSpan.closest('.result-box');
            if (mdResultBox) mdResultBox.style.display = 'none';
        }

        // Reset global variables
        cycleCount = 0;
        mdCount = 0; // Reset this too
    }
}



// --- Microphone Watch Timing Logic ---

class WatchMicrophone {
    constructor() {
        this.audioCtx = null;
        this.stream = null;
        this.source = null;
        this.gainNode = null;
        this.filter = null;
        this.processor = null;
        this.isListening = false;

        this.ticks = []; // Array of timestamps (seconds, float)
        this.lastTickTime = 0;
        this.threshold = 0.00075; // Slightly higher to avoid echo
        this.minInterval = 0.08; // 80ms (Max 45000 BPH, blocks 54000 ringing)

        // For visualization/debugging
        this.debugCallback = null;
    }

    async start(onProgress, onResult, onError) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Microphone access not supported. (Are you on HTTPS or localhost?)");
            }

            // Request with echoCancellation OFF for raw audio
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    latency: 0,
                    channelCount: 1
                }
            });

            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            // 1. Source
            this.source = this.audioCtx.createMediaStreamSource(this.stream);

            // 2. Gain (Moderate Boost)
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = 50.0;

            // 3. Filter (Standard Highpass for mechanics)
            this.filter = this.audioCtx.createBiquadFilter();
            this.filter.type = 'highpass';
            this.filter.frequency.value = 200; // Remove rumble/hum, keep clicks

            // 4. Processor (ScriptProcessor for continuous data)
            // Buffer size 2048 ~ 42ms latency at 48kHz
            this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);

            // Connect Graph:
            // Source -> Filter -> Gain -> Processor -> Destination (mute)
            this.source.connect(this.filter);
            this.filter.connect(this.gainNode);
            this.gainNode.connect(this.processor);
            this.processor.connect(this.audioCtx.destination);

            this.isListening = true;
            this.ticks = [];
            this.totalSamples = 0;
            this.sampleRate = this.audioCtx.sampleRate;
            this.startTime = Date.now();

            // Audio Processing Loop
            this.processor.onaudioprocess = (e) => {
                if (!this.isListening) return;

                const inputData = e.inputBuffer.getChannelData(0);
                this.processAudioBuffer(inputData);

                this.totalSamples += inputData.length;

                // Update Progress
                const duration = (Date.now() - this.startTime) / 1000;
                const remaining = 30 - duration;

                // Throttle UI updates to ~10Hz
                if (Math.random() < 0.1) {
                    onProgress(Math.ceil(remaining), this.ticks.length, this.currentLevel || 0);
                }

                if (duration >= 30) {
                    this.stop();
                    const results = this.calculateResults();
                    onResult(results);
                }
            };

        } catch (err) {
            onError(err);
        }
    }

    processAudioBuffer(data) {


        // Find peaks in this buffer
        let maxAmp = 0;
        let maxIndex = 0;

        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > maxAmp) {
                maxAmp = abs;
                maxIndex = i;
            }
        }

        // Store level for UI
        this.currentLevel = maxAmp;

        // If peak exceeds threshold
        if (maxAmp > this.threshold) {
            // Calculate exact time of the peak
            // time = start_time + (sample_index / sample_rate)
            // Note: audioCtx.currentTime is at the *end* of the processed block usually?
            // Actually in ScriptProcessor, it's roughly the current play time.
            // Better precision: maintain a running timestamp sample-count. 
            // But for simple "Watch Service", simplified wall-clock mapping is okay-ish, 
            // or better: just use Date.now() for relative intervals if buffer is processed real-time.
            // Even better: use the hardware timestamp.

            // Precision Time: (Total samples before this buffer + peak index) / SampleRate
            const exactSampleIndex = this.totalSamples + maxIndex;
            const tickTime = exactSampleIndex / this.sampleRate; // Seconds (float)

            if (tickTime - this.lastTickTime > this.minInterval) {
                this.ticks.push(tickTime);
                this.lastTickTime = tickTime;
            }
        }
    }

    stop() {
        this.isListening = false;
        if (this.processor) {
            this.processor.disconnect();
            this.processor.onaudioprocess = null;
        }
        if (this.gainNode) this.gainNode.disconnect();
        if (this.filter) this.filter.disconnect();
        if (this.source) this.source.disconnect();
        if (this.stream) this.stream.getTracks().forEach(track => track.stop());
        if (this.audioCtx) this.audioCtx.close();
    }

    calculateResults() {
        if (this.ticks.length < 10) return { error: "Not enough clicks detected. Volume too low?" };

        // 1. Calculate intervals (in SECONDS)
        const intervals = [];
        for (let i = 1; i < this.ticks.length; i++) {
            intervals.push(this.ticks[i] - this.ticks[i - 1]);
        }

        if (intervals.length === 0) return { error: "No intervals." };

        // 2. Filter outliers
        // Calculate Median
        const sorted = [...intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];

        // Tight filter: watch beats are very periodic. Reject anything > 20% off median.
        const validIntervals = intervals.filter(i => Math.abs(i - median) < (median * 0.2));

        if (validIntervals.length < 10) return { error: "Inconsistent beating detected." };

        const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length; // seconds

        // 3. Match to Standard BPH
        const beatsPerSecObserved = 1 / avgInterval;
        const bphObserved = beatsPerSecObserved * 3600;

        const standards = [14400, 18000, 21600, 25200, 28800, 32400, 36000];
        const targetBPH = standards.reduce((prev, curr) =>
            Math.abs(curr - bphObserved) < Math.abs(prev - bphObserved) ? curr : prev
        );

        const targetBps = targetBPH / 3600;
        const targetInterval = 1 / targetBps; // seconds

        // 4. Calculate Rate (s/d)
        // Drift per beat (seconds)
        const driftSecPerBeat = avgInterval - targetInterval;
        // Drift per day = Drift per beat * Beats per day
        const dailyDriftSec = driftSecPerBeat * (targetBPH * 24);

        // 5. Calculate Beat Error (Robust clustering)
        // A watch with beat error has two alternating intervals: Long (L) and Short (S).
        // Average interval I = (L + S) / 2.
        // Beat Error = |L - S|.
        // We will separate intervals into two clusters: those > median and those < median.

        let bigs = [];
        let smalls = [];

        // Note: validIntervals contains both L and S mixed.
        // Their average is 'avgInterval'.
        // If there is beat error, they will be bimodal.

        // Simple approach: 
        // Error = Difference between "Odd" and "Even" beats IF they are consistent.
        // But we might have missed a beat, flipping odd/even.
        // Better: Check alignment with the "Tick" vs "Tock" phase.

        // Let's stick to the Histogram approach implicitly.
        // If Beat Error is 0, all intervals are roughly equal.
        // If Beat Error is High (e.g. 2ms), we see I-1ms and I+1ms.

        // We can just calculate the standard deviation or mean absolute deviation from the median?
        // No, Beat Error is specifically the asymmetry.

        // Robust Even/Odd Extraction:
        // Assuming we didn't miss many beats, we can try the alternating sum again,
        // but checking for consistency.

        // Let's use the raw ticks to reconstruct a phase-locked loop (PLL) conceptually? Too complex.
        // Let's stick to the Even/Odd avg, but be stricter about "chains".

        let longSum = 0, longCount = 0;
        let shortSum = 0, shortCount = 0;

        // Re-iterate raw intervals to preserve order (Tick-Tock-Tick-Tock)
        let currentIntervals = [];
        for (let i = 1; i < this.ticks.length; i++) {
            let val = this.ticks[i] - this.ticks[i - 1];
            if (Math.abs(val - median) < median * 0.2) {
                currentIntervals.push(val);
            }
        }

        // If we assume the first one is "Even", let's see.
        let evenAcc = 0, oddAcc = 0;
        let eC = 0, oC = 0;

        for (let i = 0; i < currentIntervals.length; i++) {
            if (i % 2 === 0) { evenAcc += currentIntervals[i]; eC++; }
            else { oddAcc += currentIntervals[i]; oC++; }
        }

        let beatError = 0;
        if (eC > 0 && oC > 0) {
            const avg1 = evenAcc / eC;
            const avg2 = oddAcc / oC;
            // Convert seconds to ms for display
            beatError = Math.abs(avg1 - avg2) * 1000;
        }

        return {
            rate: dailyDriftSec.toFixed(1),
            beatError: beatError.toFixed(1),
            bph: targetBPH,
            bphActual: Math.round(bphObserved)
        };
    }
}


const watchMic = new WatchMicrophone();

function startWatchListening(cycleId, positionIndex, btnElement) {
    const card = btnElement.closest('.position-card');
    const statusDiv = card.querySelector('.position-info-msg');
    const beatInput = card.querySelector('.beat-error');
    const rateInput = card.querySelector('.rate-per-day');

    // 1. Toggle functionality: Stop if already listening
    if (watchMic.isListening) {
        watchMic.stop();
        statusDiv.textContent = 'Cancelled.';
        statusDiv.style.color = 'var(--color-text-secondary)';
        btnElement.classList.remove('recording-active');

        // Re-enable all buttons immediately
        document.querySelectorAll('.btn-record').forEach(b => b.disabled = false);

        setTimeout(() => { statusDiv.style.display = 'none'; }, 2000);
        return;
    }

    // 2. Start Listening
    // Reset UI
    statusDiv.style.display = 'block';
    statusDiv.style.color = 'var(--color-primary)';
    statusDiv.textContent = 'Requesting Mic...';

    // Disable ALL other buttons to prevent multiple recordings
    document.querySelectorAll('.btn-record').forEach(b => {
        if (b !== btnElement) b.disabled = true;
    });

    // Mark current as active (pulsing) but KEEP ENABLED (to allow stop click)
    btnElement.classList.add('recording-active');

    watchMic.start(
        (timeLeft, ticks, level) => {
            // Normalize display: 0.05 (5%) -> 20% visual
            const vol = Math.min(100, Math.round(level * 400));
            // Show raw level for debugging
            statusDiv.textContent = `Listening... ${timeLeft}s (Ticks: ${ticks}) Vol: ${vol}% (${level.toFixed(5)})`;
            statusDiv.style.color = 'var(--color-primary)';
        },
        (result) => {
            // Finished
            btnElement.classList.remove('recording-active');

            // Re-enable all buttons
            document.querySelectorAll('.btn-record').forEach(b => b.disabled = false);

            if (result.error) {
                statusDiv.textContent = `Error: ${result.error}`;
                statusDiv.style.color = 'var(--color-error)';
            } else {
                statusDiv.textContent = `Done! ${result.bph} BPH (Obs: ${result.bphActual})`;
                statusDiv.style.color = 'var(--color-success)';

                // Fill inputs
                beatInput.value = result.beatError;
                rateInput.value = result.rate;

                // Trigger calcs
                calculateCycleSummary(cycleId);
            }
            setTimeout(() => {
                if (!result.error) statusDiv.style.display = 'none';
            }, 5000);
        },
        (err) => {
            console.error(err);
            btnElement.classList.remove('recording-active');

            // Re-enable all buttons in case of error
            document.querySelectorAll('.btn-record').forEach(b => b.disabled = false);

            statusDiv.textContent = `Mic Error: ${err.message}`;
            statusDiv.style.color = 'var(--color-error)';
        }
    );
}


function saveFormData() {
    const formData = {
        storeName: document.getElementById('storeName').value,
        storeContact: document.getElementById('storeContact').value,
        storeAddress: document.getElementById('storeAddress').value,
        ownerName: document.getElementById('ownerName').value,
        ownerContact: document.getElementById('ownerContact').value,
        ownerAddress: document.getElementById('ownerAddress').value,
        watchBrand: document.getElementById('watchBrand').value,
        watchModel: document.getElementById('watchModel').value,
        watchMovement: document.getElementById('watchMovement').value,
        watchSerialNumber: document.getElementById('watchSerialNumber').value,
        serviceDate: document.getElementById('serviceDate').value,
        serviceTechnician: document.getElementById('serviceTechnician').value,
        serviceInitialCondition: document.getElementById('serviceInitialCondition').value,
        servicePerformed: document.getElementById('servicePerformed').value,
        finalRate: document.getElementById('finalRate').value,
        finalVariation: document.getElementById('finalVariation').value,
        finalNotes: document.getElementById('finalNotes').value,
        finalServiceCost: document.getElementById('finalServiceCost').value,
        finalWarranty: document.getElementById('finalWarranty').value,
        regulationCycles: [] // Will be populated below
    };

    document.querySelectorAll('.regulation-cycle').forEach(cycle => {
        const cycleData = {
            date: cycle.querySelector('.cycle-date').value,
            temp: cycle.querySelector('.cycle-temp').value,
            pr: cycle.querySelector('.cycle-pr').value,
            notes: cycle.querySelector('.cycle-notes').value,
            positions: []
        };

        cycle.querySelectorAll('.position-card').forEach(card => {
            const posName = card.querySelector('.position-name').textContent;
            const inputs = card.querySelectorAll('input');
            // We only need to save the values, order is preserved by HTML structure
            // Actually, simpler to just save the raw input values in order? 
            // Or explicitly map them regarding the new structure?
            // The regulation cycle structure hasn't changed, only Multi-Day.
            // Let's keep regulation logic as is if it works, or ensure it matches.
            // Wait, regulation-cycle logic is fine. Focusing on Multi-Day.

            const posData = {
                name: posName,
                beatError: card.querySelector('.beat-error').value,
                rate: card.querySelector('.rate-per-day').value
            };
            // Handle responsive/new grid if input selectors changed? 
            // The regulation inputs are currently generic 'input' in grid.
            // Let's trust the existing binding if I didn't break it. 
            // Actually, I should just update the Multi-Day part below.

            // Re-reading logic: The loop above is for Regulation. 
            // I will leave it alone and focus on Multi-Day below.
            cycleData.positions.push(posData);
        });

        // Correction for Regulation save logic if needed... 
        // The previous code wasn't shown fully but looked standard.
        formData.regulationCycles.push(cycleData);
    });

    // Multi-Day Data
    // Initialize multiDayData array first
    formData.multiDayData = [];
    document.querySelectorAll('#multiDayGrid .position-card').forEach(card => {
        formData.multiDayData.push({
            date: card.querySelector('.md-date').value,
            refTime: card.querySelector('.md-ref-time').value,
            watchTime: card.querySelector('.md-watch-time').value
        });
    });

    const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Construct filename: ownername_brand_model_serialnumber_servicedate_exportdate
    const parts = [
        formData.ownerName,
        formData.watchBrand,
        formData.watchModel,
        formData.watchSerialNumber,
        formData.serviceDate,
        new Date().toISOString().split('T')[0] // Export date
    ];

    // Filter out empty parts, sanitize, and join with underscore
    const filename = parts
        .map(p => p ? String(p).trim().replace(/[^a-zA-Z0-9]/g, '_') : '')
        .filter(p => p)
        .join('_');

    a.download = `${filename || 'watch_service_data'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);


}

function loadFormData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);

                document.getElementById('storeName').value = data.storeName || '';
                document.getElementById('storeAddress').value = data.storeAddress || '';
                document.getElementById('storeContact').value = data.storeContact || '';
                document.getElementById('ownerName').value = data.ownerName || '';
                document.getElementById('ownerContact').value = data.ownerContact || '';
                document.getElementById('ownerAddress').value = data.ownerAddress || '';
                document.getElementById('watchBrand').value = data.watchBrand || '';
                document.getElementById('watchModel').value = data.watchModel || '';
                document.getElementById('watchMovement').value = data.watchMovement || '';
                document.getElementById('watchSerialNumber').value = data.watchSerialNumber || '';
                document.getElementById('serviceDate').value = data.serviceDate || '';
                document.getElementById('serviceTechnician').value = data.serviceTechnician || '';
                document.getElementById('serviceInitialCondition').value = data.serviceInitialCondition || '';
                document.getElementById('servicePerformed').value = data.servicePerformed || '';
                document.getElementById('finalRate').value = data.finalRate || '';
                document.getElementById('finalVariation').value = data.finalVariation || '';
                document.getElementById('finalNotes').value = data.finalNotes || '';
                document.getElementById('finalServiceCost').value = data.finalServiceCost || '';
                document.getElementById('finalWarranty').value = data.finalWarranty || '';

                const regContainer = document.getElementById('regulationCycles');
                regContainer.innerHTML = '';
                cycleCount = 0;

                if (data.regulationCycles && data.regulationCycles.length > 0) {
                    data.regulationCycles.forEach((cycleData, index) => {
                        const cycleHTML = createRegulationCycle(index + 1); // Get HTML
                        regContainer.insertAdjacentHTML('beforeend', cycleHTML); // Append to DOM
                        const cycleEl = regContainer.lastElementChild; // Now it exists
                        cycleEl.querySelector('.cycle-date').value = cycleData.date || '';
                        cycleEl.querySelector('.cycle-temp').value = cycleData.temp || '';
                        cycleEl.querySelector('.cycle-pr').value = cycleData.pr || '';
                        cycleEl.querySelector('.cycle-notes').value = cycleData.notes || '';

                        // ... positions logic ...
                        const positionCards = Array.from(cycleEl.querySelectorAll('.position-card'));
                        if (cycleData.positions) {
                            cycleData.positions.forEach((posData, posIdx) => {
                                let card;
                                if (posData.name) {
                                    card = positionCards.find(c => c.querySelector('.position-name').textContent.trim() === posData.name.trim());
                                }
                                if (!card && positionCards[posIdx]) {
                                    card = positionCards[posIdx];
                                }

                                if (card) {
                                    // Handle potential missing fields gracefully
                                    const beatInput = card.querySelector('.beat-error');
                                    const rateInput = card.querySelector('.rate-per-day');
                                    if (beatInput) beatInput.value = posData.beatError || '';
                                    if (rateInput) rateInput.value = posData.rate || '';
                                }
                            });
                        }
                        calculateCycleSummary(cycleEl.id);
                    });
                }

                const mdGrid = document.getElementById('multiDayGrid');
                mdGrid.innerHTML = '';
                if (data.multiDayData && data.multiDayData.length > 0) {
                    data.multiDayData.forEach(mdData => {
                        addMultiDayMeasurement();
                        const card = mdGrid.lastElementChild;
                        card.querySelector('.md-date').value = mdData.date || '';
                        card.querySelector('.md-ref-time').value = mdData.refTime || mdData.time || '';
                        card.querySelector('.md-watch-time').value = mdData.watchTime || '';
                    });
                    calculateMultiDayStats();
                }

                alert('Data loaded successfully!');
            } catch (err) {
                alert('Error loading file: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Initialize with NO rows on page load
window.addEventListener('load', () => {
    document.getElementById('serviceDate').valueAsDate = new Date();
});
