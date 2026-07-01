export function isYmd(s: string | null | undefined): s is string {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function parseTime12ToMinutes(time: string): number | null {
    const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ampm = m[3].toUpperCase();
    if (h === 12 && ampm === "AM") h = 0;
    else if (h !== 12 && ampm === "PM") h += 12;
    return h * 60 + min;
}

export function minutesToTime12(totalMins: number): string {
    let h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const ampm = h < 12 ? "AM" : "PM";
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export function endTimeFromStartAndDuration(startTime: string, durationMinutes: number): string {
    const s = parseTime12ToMinutes(startTime);
    if (s === null) return startTime;
    return minutesToTime12(s + durationMinutes);
}

export function computeDurationMinutes(startTime: string, endTime: string): number | null {
    const s = parseTime12ToMinutes(startTime);
    const e = parseTime12ToMinutes(endTime);
    if (s === null || e === null) return null;
    const diff = e - s;
    return diff > 0 ? diff : null;
}
