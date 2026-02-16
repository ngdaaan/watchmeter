import {
    handleBeforePrint,
    handleAfterPrint,
    printForm,
    resetForm
} from './ui.js';

import {
    addRegulationCycle,
    removeRegulationCycle,
    calculateCycleSummary,
    startWatchListening
} from './regulation.js';

import {
    addMultiDayMeasurement,
    removeMultiDayRow,
    calculateMultiDayStats
} from './multiday.js';

import { saveFormData, loadFormData } from './storage.js';

// Expose functions to global scope for HTML event handlers
window.addRegulationCycle = addRegulationCycle;
window.removeRegulationCycle = removeRegulationCycle;
window.calculateCycleSummary = calculateCycleSummary;
window.addMultiDayMeasurement = addMultiDayMeasurement;
window.removeMultiDayRow = removeMultiDayRow;
window.calculateMultiDayStats = calculateMultiDayStats;
window.printForm = printForm;
window.resetForm = resetForm;
window.startWatchListening = startWatchListening;
window.saveFormData = saveFormData;
window.loadFormData = loadFormData;

// Event Listeners
window.addEventListener('beforeprint', handleBeforePrint);
window.addEventListener('afterprint', handleAfterPrint);

window.addEventListener('load', () => {
    const dateInput = document.getElementById('serviceDate');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
});
