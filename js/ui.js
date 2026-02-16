import { resetRegulationState } from './regulation.js';
import { resetMultiDayState } from './multiday.js';

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

        resetRegulationState();
        resetMultiDayState();
    }
}
