export function getLocalISODateString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function toJalaali(gy, gm, gd) {
    var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    var gy2 = (gm > 2) ? (gy + 1) : gy;
    var days = 355666 + (365 * gy) + ~~((gy2 + 3) / 4) - ~~((gy2 + 99) / 100) + ~~((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
    var jy = -1595 + (33 * ~~(days / 12053));
    days %= 12053;
    jy += 4 * ~~(days / 1461);
    days %= 1461;
    if (days > 365) { jy += ~~((days - 1) / 365); days = (days - 1) % 365; }
    var jm = (days < 186) ? 1 + ~~(days / 31) : 7 + ~~((days - 186) / 30);
    var jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { jy: jy, jm: jm, jd: jd };
}

export function injectJalaaliDate(dayElem) {
    if (!dayElem || !dayElem.dateObj) return;
    if (dayElem.querySelector('.jalaali-date')) return;

    const dateObj = dayElem.dateObj;
    const j = toJalaali(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
    
    const span = document.createElement('span');
    span.className = 'jalaali-date';
    span.textContent = j.jd;
    dayElem.appendChild(span);
}

export function getPersianDateString(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return "";
    const j = toJalaali(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
    const months = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar", "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];
    return `${months[j.jm - 1]} ${j.jd}`;
}

export function getFullPersianDate(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return "";
    const j = toJalaali(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
    return `${j.jy}/${j.jm.toString().padStart(2, '0')}/${j.jd.toString().padStart(2, '0')}`;
}

export function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}