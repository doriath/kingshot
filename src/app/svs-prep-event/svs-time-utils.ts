export function toMinutes(timeStr: string): number {
    if (timeStr === '-23:45') return -15;

    let str = timeStr;
    let isNeg = false;
    if (str.startsWith('-')) {
        isNeg = true;
        str = str.substring(1);
    }
    if (!str.includes(':')) {
        str += ':00';
    }
    const [h, m] = str.split(':').map(Number);
    let total = h * 60 + m;
    if (isNeg) {
        // If it was generic negative input, we might want standard negation
        // But for our app context, -HH:MM usually implies "Previous Day HH:MM"
        // However, standard logic was simple negation.
        // Let's keep simple negation for things that aren't the special -23:45,
        // unless we want to support generic "previous day" input like "-23:15".
        // Use case is minimal. explicit check above handles the slot.
        total = -total;
    }
    return total;
}

export function generateTimeSlots(): string[] {
    const slots: string[] = [];
    for (let m = -15; m <= 1425; m += 30) {
        if (m < 0) {
            slots.push("-23:45");
        } else {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const hStr = h.toString().padStart(2, '0');
            const mStr = min.toString().padStart(2, '0');
            slots.push(`${hStr}:${mStr}`);
        }
    }
    return slots;
}

export function parseTimeInput(input: string, allSlots: string[]): string[] {
    // Normalize spaces around hyphens: "0 - 5" -> "0-5"
    const normalizedInput = input.replace(/\s*-\s*/g, '-');
    const parts = normalizedInput.split(/[\s,]+/);
    const result = new Set<string>();

    parts.forEach(part => {
        // Handle potential negative start time (e.g. -23:45-00:15)
        // If splitting by '-', a negative start will produce an empty first element
        const segments = part.split('-');
        let startStr: string | undefined;
        let endStr: string | undefined;

        if (segments.length === 2) {
            // Standard "10:00-11:00"
            startStr = segments[0];
            endStr = segments[1];
        } else if (segments.length === 3 && segments[0] === '') {
            // Negative start: "-23:45-00:15" -> ["", "23:45", "00:15"]
            startStr = '-' + segments[1];
            endStr = segments[2];
        }

        if (startStr && endStr) {
            const startMin = toMinutes(startStr);
            const endMin = toMinutes(endStr);
            const isWrap = startMin > endMin;

            for (const slot of allSlots) {
                const slotStart = toMinutes(slot);
                const slotEnd = slotStart + 30;

                // Strict Intersection
                // Normal: slotStart >= startMin AND slotEnd <= endMin
                // Wrap: (slotStart >= startMin) OR (slotEnd <= endMin)
                // Note: This works for our specific 24h+buffer context.
                // e.g. 20:00-05:00. Start=1200, End=300.
                // Slot 23:15 (1395-1425): 1395 >= 1200 (True). Keep.
                // Slot 04:15 (255-285): 285 <= 300 (True). Keep.
                // Slot 05:15 (315-345): 315 >= 1200 (False) OR 345 <= 300 (False). Skip.

                let keep = false;
                if (isWrap) {
                    if (slotStart >= startMin || slotEnd <= endMin) {
                        keep = true;
                    }
                } else {
                    if (slotStart >= startMin && slotEnd <= endMin) {
                        keep = true;
                    }
                }

                if (keep) {
                    result.add(slot);
                }
            }
        }
    });
    return Array.from(result);
}

export function formatRange(startMin: number, endMin: number): string {
    const formatTime = (m: number) => {
        if (m < 0) {
            // e.g. -15.
            // Becomes 1440 - 15 = 1425 (23:45)
            // Return "-23:45"
            const normalize = 24 * 60 + m;
            const h = Math.floor(normalize / 60);
            const min = normalize % 60;
            return `-${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        }

        let abs = Math.abs(m);
        // Handle wrap around if needed (e.g. 24:15 -> 00:15? or 24:15)
        // Usually compression ends are inclusive logic or exclusive?
        // Our slots logic: 10:15, 10:45 -> 10:15-11:15 (end is prev + 30)
        // If prev is 23:45 (1425). End is 1455 (24:15).
        // 24:15 should format as 00:15?

        if (abs >= 24 * 60) {
            abs -= 24 * 60;
            // And if it was exactly 24:00? -> 00:00
        }

        const h = Math.floor(abs / 60);
        const min = abs % 60;
        return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
    };
    return `${formatTime(startMin)}-${formatTime(endMin)}`;
}

export function getCompressedSlots(slots: string[]): string {
    if (!slots || slots.length === 0) return '-';

    // Convert to minutes, sort
    const mins = slots.map(s => toMinutes(s)).sort((a, b) => a - b);

    // Group into continuous ranges
    const ranges: { start: number, end: number }[] = [];
    if (mins.length === 0) return '-';

    let start = mins[0];
    let prev = mins[0];

    for (let i = 1; i < mins.length; i++) {
        const curr = mins[i];
        if (curr === prev + 30) {
            // Continuous
            prev = curr;
        } else {
            // Break
            ranges.push({ start, end: prev + 30 });
            start = curr;
            prev = curr;
        }
    }
    ranges.push({ start, end: prev + 30 });

    return ranges.map(r => formatRange(r.start, r.end)).join(', ');
}
