// watch-microphone.js

export class WatchMicrophone {
    constructor() {
        // Web Audio state
        this.audioCtx = null;
        this.stream = null;
        this.source = null;
        this.gainNode = null;
        this.filter = null;
        this.processor = null;

        // Tick detection state
        this.isListening = false;
        this.sampleRate = 0;
        this.totalSamples = 0;
        this.currentLevel = 0;

        this.ticks = [];          // tick timestamps in seconds (float)
        this.lastTickTime = 0;    // last accepted tick time (s)

        // Adaptive thresholding
        this.runningPeak = 0.001;
        this.adaptiveThreshold = 0.00075;
        this.absMinThreshold = 0.00075;

        // Beat detection / measurement state
        this.state = "IDLE";      // IDLE | DETECTING | MEASURING | FINISHED
        this.detectedBPH = 0;
        this.refInterval = 0;     // expected interval between detected beats (s)
        this.minInterval = 0.08;  // minimum spacing between ticks (s)
        this.measureStartIndex = 0;

        // Timing window
        this.startTimeMs = 0;
        this.measureDurationSec = 30;

        // UI callbacks
        this.onProgress = null;
        this.onResult = null;
        this.onError = null;
    }

    async start(onProgress, onResult, onError) {
        this.onProgress = onProgress;
        this.onResult = onResult;
        this.onError = onError;

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Microphone access not supported. Use HTTPS or localhost.");
            }

            // Request mono, raw-ish audio
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
            this.sampleRate = this.audioCtx.sampleRate;

            this.source = this.audioCtx.createMediaStreamSource(this.stream);

            // Gain (boost low-level tick sounds)
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.value = 50.0;

            // High-pass filter to remove handling / low-frequency noise
            this.filter = this.audioCtx.createBiquadFilter();
            this.filter.type = "highpass";
            this.filter.frequency.value = 200;

            // ScriptProcessorNode (deprecated but still widely supported; can be replaced with AudioWorkletNode)
            this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);

            this.source.connect(this.filter);
            this.filter.connect(this.gainNode);
            this.gainNode.connect(this.processor);
            this.processor.connect(this.audioCtx.destination);

            // Reset state
            this.isListening = true;
            this.state = "DETECTING";
            this.totalSamples = 0;
            this.ticks = [];
            this.lastTickTime = 0;
            this.runningPeak = 0.001;
            this.adaptiveThreshold = this.absMinThreshold;
            this.detectedBPH = 0;
            this.refInterval = 0;
            this.measureStartIndex = 0;
            this.startTimeMs = performance.now();

            this.processor.onaudioprocess = (e) => {
                if (!this.isListening) return;

                const inputData = e.inputBuffer.getChannelData(0);
                this._processAudioBuffer(inputData);

                this.totalSamples += inputData.length;

                const elapsedSec = (performance.now() - this.startTimeMs) / 1000;
                const remainingSec = Math.max(0, this.measureDurationSec - elapsedSec);

                // Try lock BPH while in DETECTING
                if (this.state === "DETECTING") {
                    if (elapsedSec > 2 && this.ticks.length > 10) {
                        this._attemptBPHDetection();
                    }
                }

                // Live stats during MEASURING
                let liveStats = null;
                if (this.state === "MEASURING") {
                    liveStats = this._calculateStats();
                }

                // Throttle UI updates to reduce overhead
                if (this.onProgress && Math.random() < 0.15) {
                    this.onProgress(
                        Math.ceil(remainingSec),
                        this.ticks.length,
                        this.currentLevel,
                        this.state,
                        liveStats
                    );
                }

                // Stop after window expires
                if (elapsedSec >= this.measureDurationSec) {
                    this.stop();
                    const result = this._finalResults();
                    if (this.onResult) this.onResult(result);
                }
            };
        } catch (err) {
            if (this.onError) this.onError(err);
        }
    }

    stop() {
        this.isListening = false;
        this.state = "FINISHED";

        if (this.processor) {
            this.processor.disconnect();
            this.processor.onaudioprocess = null;
            this.processor = null;
        }
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.filter) {
            this.filter.disconnect();
            this.filter = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
        if (this.audioCtx) {
            this.audioCtx.close();
            this.audioCtx = null;
        }
    }

    // ---------- Low-level audio processing ----------

    _processAudioBuffer(buffer) {
        let maxAmp = 0;
        let maxIndex = 0;

        // Find peak amplitude in this buffer
        for (let i = 0; i < buffer.length; i++) {
            const v = buffer[i];
            const abs = v >= 0 ? v : -v;
            if (abs > maxAmp) {
                maxAmp = abs;
                maxIndex = i;
            }
        }

        this.currentLevel = maxAmp;

        // Adaptive threshold: track running peak with decay, set threshold to 50% of that
        if (maxAmp > this.runningPeak) {
            this.runningPeak = maxAmp;
        } else {
            this.runningPeak *= 0.995; // slow decay
        }

        this.adaptiveThreshold = Math.max(this.absMinThreshold, this.runningPeak * 0.5);

        // Accept a tick when the buffer peak exceeds threshold and is far enough from the last tick
        if (maxAmp > this.adaptiveThreshold) {
            const absoluteSampleIndex = this.totalSamples + maxIndex;
            const tickTime = absoluteSampleIndex / this.sampleRate;

            if (tickTime - this.lastTickTime > this.minInterval) {
                this.ticks.push(tickTime);
                this.lastTickTime = tickTime;
            }
        }
    }

    // ---------- Beat rate detection (BPH) ----------

    _attemptBPHDetection() {
        if (this.ticks.length < 8) return;

        // Common mechanical watch beat rates (BPH)
        const candidatesBPH = [14400, 18000, 19800, 21600, 25200, 28800, 36000];

        const baseTime = this.ticks[0];
        const candidates = [];

        for (const bph of candidatesBPH) {
            const interval = 3600 / bph; // seconds per beat

            let sumSqErr = 0;
            let maxErr = 0;

            for (let i = 1; i < this.ticks.length; i++) {
                const t = this.ticks[i] - baseTime;
                const n = Math.round(t / interval);
                const expected = n * interval;
                const diff = Math.abs(t - expected);

                sumSqErr += diff * diff;
                if (diff > maxErr) maxErr = diff;
            }

            const rmse = Math.sqrt(sumSqErr / (this.ticks.length - 1));
            candidates.push({ bph, interval, rmse, maxErr });
        }

        candidates.sort((a, b) => a.rmse - b.rmse);
        const best = candidates[0];

        // RMSE tolerance: we expect good lock at a few ms deviation
        if (!best) return;
        if (best.rmse > 0.04) {
            // too noisy / not enough consistent ticks yet
            return;
        }

        // Lock reference beat rate
        this.detectedBPH = best.bph;
        this.refInterval = best.interval;
        this.state = "MEASURING";

        // Only use ticks after this point for stats
        this.measureStartIndex = this.ticks.length;

        // Reject echoes slightly shorter than expected beat
        this.minInterval = this.refInterval * 0.8;
    }

    // ---------- Rate and beat error computation ----------

    /**
     * Returns:
     * {
     *   bph: number,
     *   rate: number (seconds/day, + fast, - slow),
     *   beatErrorMs: number (ms, tick–tock asymmetry),
     *   sampleCount: number,
     *   elapsedSec: number
     * }
     */
    _calculateStats() {
        if (!this.detectedBPH) return null;

        const ticks = this.ticks.slice(this.measureStartIndex);
        if (ticks.length < 4) return null;

        const first = ticks[0];
        const last = ticks[ticks.length - 1];
        const elapsed = last - first;
        if (elapsed <= 0) return null;

        const intervals = [];
        for (let i = 1; i < ticks.length; i++) {
            intervals.push(ticks[i] - ticks[i - 1]);
        }

        const nominal = this.refInterval;

        // Filter out obviously wrong intervals (missed beats, double ticks)
        const filtered = intervals.filter(dt => Math.abs(dt - nominal) < nominal * 0.4);
        if (filtered.length < 3) return null;

        // Observed average interval (s per beat)
        const sum = filtered.reduce((a, b) => a + b, 0);
        const avgInterval = sum / filtered.length;

        // Rate in seconds/day: difference vs nominal beat period
        // If avgInterval < nominal, watch is fast, so positive rate (gains seconds/day).
        const rateSecPerDay = ((nominal - avgInterval) / nominal) * 86400;

        // Beat error: tick–tock asymmetry in ms
        // Alternate intervals (even vs odd) correspond to tick–tock sides of the balance.
        let evenSum = 0, evenCount = 0;
        let oddSum = 0, oddCount = 0;

        for (let i = 0; i < filtered.length; i++) {
            const dt = filtered[i];
            if (i % 2 === 0) {
                evenSum += dt; evenCount++;
            } else {
                oddSum += dt; oddCount++;
            }
        }

        let beatErrorMs = 0;
        if (evenCount > 0 && oddCount > 0) {
            const avgEven = evenSum / evenCount;
            const avgOdd = oddSum / oddCount;
            beatErrorMs = Math.abs(avgEven - avgOdd) * 1000;
        }

        return {
            bph: this.detectedBPH,
            rate: rateSecPerDay,
            beatErrorMs,
            sampleCount: ticks.length,
            elapsedSec: elapsed
        };
    }

    // ---------- Final result ----------

    _finalResults() {
        if (this.ticks.length < 10) {
            return { error: "Not enough ticks detected. Increase volume or move closer." };
        }

        if (!this.detectedBPH) {
            // One last attempt if we never locked during streaming
            this._attemptBPHDetection();
            if (!this.detectedBPH) {
                return { error: "Could not lock beat rate (BPH). Signal too noisy or inconsistent." };
            }
        }

        const stats = this._calculateStats();
        if (!stats) {
            return { error: "Not enough clean beats for stable measurement." };
        }

        return {
            bph: stats.bph,
            rateSecondsPerDay: Number(stats.rate.toFixed(1)),      // + fast, - slow
            beatErrorMs: Number(stats.beatErrorMs.toFixed(1)),
            rawSampleCount: stats.sampleCount,
            measuredSpanSec: Number(stats.elapsedSec.toFixed(2))
        };
    }
}

export const watchMic = new WatchMicrophone();