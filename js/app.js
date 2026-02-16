import {
    addRegulationCycle,
    removeRegulationCycle,
    calculateCycleSummary,
    addMultiDayMeasurement,
    removeMultiDayRow,
    calculateMultiDayStats,
    handleBeforePrint,
    handleAfterPrint,
    printForm,
    resetForm,
    startWatchListening
} from './ui.js';
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
