export class WatchMicrophone {
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
        this.threshold = 0.00075;
        this.minInterval = 0.08;

        // New State Variables
        this.state = 'IDLE'; // IDLE, DETECTING, MEASURING, FINISHED
        this.detectedBPH = 0;
        this.refInterval = 0; // Target interval for locked BPH
        this.startTime = 0;
        this.totalSamples = 0;
        this.sampleRate = 0;

        // For visualization/debugging
        this.debugCallback = null;
    }

    async start(onProgress, onResult, onError) {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Microphone access not supported. (Are you on HTTPS or localhost?)");
            }

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
            this.source = this.audioCtx.createMediaStreamSource(this.stream);
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = 50.0;
            this.filter = this.audioCtx.createBiquadFilter();
            this.filter.type = 'highpass';
            this.filter.frequency.value = 200;

            this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);

            this.source.connect(this.filter);
            this.filter.connect(this.gainNode);
            this.gainNode.connect(this.processor);
            this.processor.connect(this.audioCtx.destination);

            this.isListening = true;
            this.ticks = [];
            this.totalSamples = 0;
            this.sampleRate = this.audioCtx.sampleRate;
            this.startTime = Date.now();

            // Initialize State
            this.state = 'DETECTING';
            this.detectedBPH = 0;
            this.minInterval = 0.08; // Conservative start

            this.processor.onaudioprocess = (e) => {
                if (!this.isListening) return;

                const inputData = e.inputBuffer.getChannelData(0);
                this.processAudioBuffer(inputData);

                this.totalSamples += inputData.length;

                // Update Progress and State Logic
                const duration = (Date.now() - this.startTime) / 1000;

                // 1. Check for BPH Detection if in DETECTING mode
                if (this.state === 'DETECTING') {
                    // Attempt detection every 0.5s after 2s mark
                    if (duration > 2.0 && this.ticks.length > 5) {
                        this.attemptBPHDetection();
                    }
                    // Force fail if too long?
                    if (duration > 10.0 && this.state === 'DETECTING') {
                        // Keep trying but warn? or default?
                    }
                }

                const remaining = 30 - duration;

                // Calculate Live Stats if Measuring
                let stats = null;
                if (this.state === 'MEASURING') {
                    stats = this.calculateLiveStats();
                }

                // Throttle UI updates
                if (Math.random() < 0.1) {
                    onProgress(Math.ceil(remaining), this.ticks.length, this.currentLevel || 0, this.state, stats);
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
        let maxAmp = 0;
        let maxIndex = 0;

        for (let i = 0; i < data.length; i++) {
            const abs = Math.abs(data[i]);
            if (abs > maxAmp) {
                maxAmp = abs;
                maxIndex = i;
            }
        }
        this.currentLevel = maxAmp;

        if (maxAmp > this.threshold) {
            const exactSampleIndex = this.totalSamples + maxIndex;
            const tickTime = exactSampleIndex / this.sampleRate;

            if (tickTime - this.lastTickTime > this.minInterval) {
                this.ticks.push(tickTime);
                this.lastTickTime = tickTime;
            }
        }
    }

    attemptBPHDetection() {
        const intervals = [];
        for (let i = 1; i < this.ticks.length; i++) {
            intervals.push(this.ticks[i] - this.ticks[i - 1]);
        }
        if (intervals.length < 5) return;

        // Sort and Median
        const sorted = [...intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];

        // Filter Outliers (Noise)
        const validIntervals = intervals.filter(i => Math.abs(i - median) < median * 0.2);

        if (validIntervals.length < 5) return; // Wait for more clean data

        const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
        const bphObserved = (1 / avgInterval) * 3600;

        const standards = [14400, 18000, 19800, 21600, 25200, 28800, 36000];
        const targetBPH = standards.reduce((prev, curr) =>
            Math.abs(curr - bphObserved) < Math.abs(prev - bphObserved) ? curr : prev
        );

        // Check if close enough (within 1000 BPH is generous but handles drift)
        if (Math.abs(bphObserved - targetBPH) < 2000) {
            console.log(`Locked BPH: ${targetBPH} (Observed: ${bphObserved.toFixed(1)})`);
            this.detectedBPH = targetBPH;
            this.refInterval = 3600 / targetBPH;
            this.state = 'MEASURING';

            // Tighten minInterval to reject echoes/ringing
            // Set to 85% of expected interval to avoid double triggering on echoes
            this.minInterval = this.refInterval * 0.85;
        }
    }

    calculateLiveStats() {
        if (!this.detectedBPH || this.ticks.length < 2) return null;

        const first = this.ticks[0];
        const last = this.ticks[this.ticks.length - 1];
        const count = this.ticks.length - 1;

        // Expected time for 'count' beats
        const expectedTime = count * this.refInterval;
        const actualTime = last - first;

        // Positive drift means Actual < Expected (Device is FAST)
        // Negative drift means Actual > Expected (Device is SLOW)
        const drift = expectedTime - actualTime;

        // Rate s/d
        const rate = (drift / actualTime) * 86400;

        // Beat Error
        let beatError = 0;
        if (this.ticks.length > 4) {
            let evenSum = 0, evenCount = 0;
            let oddSum = 0, oddCount = 0;
            for (let i = 1; i < this.ticks.length; i++) {
                const val = this.ticks[i] - this.ticks[i - 1];
                // Basic filter for validity
                if (Math.abs(val - this.refInterval) < this.refInterval * 0.3) {
                    if (i % 2 === 0) { evenSum += val; evenCount++; }
                    else { oddSum += val; oddCount++; }
                }
            }
            if (evenCount > 0 && oddCount > 0) {
                const avgEven = evenSum / evenCount;
                const avgOdd = oddSum / oddCount;
                beatError = Math.abs(avgEven - avgOdd) * 1000;
            }
        }

        return {
            bph: this.detectedBPH,
            rate: rate.toFixed(1),
            beatError: beatError.toFixed(1)
        };
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

        // Final Calculation
        if (this.state !== 'MEASURING') {
            // Try one last detection
            this.attemptBPHDetection();
            if (this.state !== 'MEASURING') {
                return { error: "Could not lock BPH. Signal too noisy?" };
            }
        }

        const stats = this.calculateLiveStats();

        return {
            rate: stats.rate,
            beatError: stats.beatError,
            bph: this.detectedBPH,
            bphActual: Math.round(this.detectedBPH)
        };
    }
}

export const watchMic = new WatchMicrophone();
