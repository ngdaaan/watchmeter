import { getISOStringFromDate, formatTime } from './utils.js';
import { calculateMultiDayPoint, calculateMultiDayRate } from './calculations.js';

let mdCount = 0;

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
            const avgRate = calculateMultiDayRate(firstData, lastData);

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

export function resetMultiDayState() {
    mdCount = 0;
    document.getElementById('multiDayGrid').innerHTML = '';
    const mdRateSpan = document.getElementById('totalAvgRate');
    if (mdRateSpan) {
        mdRateSpan.textContent = '0.00 s/d';
        const mdResultBox = mdRateSpan.closest('.result-box');
        if (mdResultBox) mdResultBox.style.display = 'none';
    }
}
