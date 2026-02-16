export const POSITIONS = [
    { name: 'Dial Up', abbr: 'DU' },
    { name: 'Dial Down', abbr: 'DD' },
    { name: 'Crown Up', abbr: 'CU' },
    { name: 'Crown Down', abbr: 'CD' },
    { name: 'Crown Right', abbr: 'CR' },
    { name: 'Crown Left', abbr: 'CL' }
];

export function getISOStringFromDate(date = new Date()) {
    return date.toISOString().split('T')[0];
}

export function formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0').substring(0, 3);
    return {
        full: `${h}:${m}:${s}.${ms}`,
        simple: `${h}:${m}:${s}`
    };
}
