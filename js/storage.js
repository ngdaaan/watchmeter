import { createRegulationCycle, calculateCycleSummary, calculateMultiDayStats, addMultiDayMeasurement } from './ui.js';

export function saveFormData() {
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
            const posName = card.querySelector('.position-name').textContent.trim();
            const posData = {
                name: posName,
                beatError: card.querySelector('.beat-error').value,
                rate: card.querySelector('.rate-per-day').value
            };
            cycleData.positions.push(posData);
        });

        formData.regulationCycles.push(cycleData);
    });

    // Multi-Day Data
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

    const parts = [
        formData.ownerName,
        formData.watchBrand,
        formData.watchModel,
        formData.watchSerialNumber,
        formData.serviceDate,
        new Date().toISOString().split('T')[0]
    ];

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

export function loadFormData() {
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
                // Need to reset cycleCount in ui.js or expose a resetter. 
                // Since cycleCount is module-scoped in ui.js, we should handle this.
                // For now, we manually clear and let ui.js manage its own count, 
                // but we might need a reset function exposed.
                // Assuming ui.js exports a reset function or we just append.

                // Note: cycleCount in script.js was global. 
                // In ui.js it will be module scoped.

                if (data.regulationCycles && data.regulationCycles.length > 0) {
                    data.regulationCycles.forEach((cycleData, index) => {
                        // We need a way to recreate specific logic.
                        // Ideally ui.js exports 'importRegulationCycle' or similar?
                        // Or we just use createRegulationCycle and manually fill.
                        // However, createRegulationCycle probably increments internal counter.
                        // If we pass the cycle number, it might use that.

                        const cycleHTML = createRegulationCycle(index + 1);
                        regContainer.insertAdjacentHTML('beforeend', cycleHTML);
                        const cycleEl = regContainer.lastElementChild;
                        cycleEl.querySelector('.cycle-date').value = cycleData.date || '';
                        cycleEl.querySelector('.cycle-temp').value = cycleData.temp || '';
                        cycleEl.querySelector('.cycle-pr').value = cycleData.pr || '';
                        cycleEl.querySelector('.cycle-notes').value = cycleData.notes || '';

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
