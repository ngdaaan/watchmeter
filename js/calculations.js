export function calculateStats(values) {
    if (!values || values.length === 0) return null;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const variation = max - min;
    return { avg, max, min, variation };
}


// Re-implementing logic from original script.js but pure
export function calculateCycleStats(beatErrors, rates) {
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

    return { avgBeatError, avgRate, maxRate, minRate, variation };
}

export function calculateRegulationAggregates(cyclesData) {
    let totalRate = 0;
    let totalBeat = 0;
    let rateCount = 0;
    let beatCount = 0;

    cyclesData.forEach(data => {
        if (data.beatErrors && data.beatErrors.length > 0) {
            const avg = data.beatErrors.reduce((a, b) => a + b, 0) / data.beatErrors.length;
            totalBeat += avg;
            beatCount++;
        }

        if (data.rates && data.rates.length > 0) {
            const avg = data.rates.reduce((a, b) => a + b, 0) / data.rates.length;
            totalRate += avg;
            rateCount++;
        }
    });

    const globalAvgRate = rateCount > 0 ? (totalRate / rateCount).toFixed(1) : '0.0';
    const globalAvgBeat = beatCount > 0 ? (totalBeat / beatCount).toFixed(2) : '0.00';

    return { globalAvgRate, globalAvgBeat, rateCount, beatCount };
}

export function calculateMultiDayPoint(refDate, watchDate) {
    // watchDate should already have +200ms applied if that's the logic, or we do it here.
    // The previous logic applied +200ms in UI. Let's assume input dates are raw and we handle logic here?
    // Or keep it simple: input dates are final.
    // Let's move the +200ms logic here to be safe/consistent if it's "business logic".
    // Actually, let's keep it pure: input dates -> output difference.
    // But wait, the 200ms is a constant offset for human reaction time maybe?
    // Better to pass pure dates and let this function handle the "business logic" of the offset if possible, 
    // but the UI constructs the dates.
    // Let's act on the provided dates.

    const deviation = (watchDate - refDate) / 1000;
    return deviation;
}

export function calculateMultiDayRate(prevData, currentData) {
    const timeDiffDays = (currentData.date - prevData.date) / (1000 * 60 * 60 * 24);
    if (timeDiffDays <= 0) return '0.00';

    const deltaDeviation = currentData.deviation - prevData.deviation;
    const rate = deltaDeviation / timeDiffDays;
    return rate.toFixed(2);
}
