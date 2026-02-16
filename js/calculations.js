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
