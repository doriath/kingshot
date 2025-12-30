import { toMinutes, generateTimeSlots, parseTimeInput, getCompressedSlots } from './svs-time-utils';

describe('SvS Time Utils', () => {
    describe('toMinutes', () => {
        it('should parse simple hours', () => {
            expect(toMinutes('10')).toBe(600);
            expect(toMinutes('10:00')).toBe(600);
        });
        it('should parse hours and minutes', () => {
            expect(toMinutes('10:30')).toBe(630);
            expect(toMinutes('00:15')).toBe(15);
        });
        it('should parse negative times', () => {
            expect(toMinutes('-23:45')).toBe(-15); // Special case for continuity
            expect(toMinutes('-23:45')).toBe(-15);
        });
    });

    describe('generateTimeSlots', () => {
        it('should generate correct number of slots', () => {
            const slots = generateTimeSlots();
            // -15 to 1425 step 30
            // Range: 1440 min
            // Count: 1440 / 30 + 1 = 49 slots? 
            // 1425 - (-15) = 1440. 
            // 0, 30, ... 1440. 
            // 49 items.
            expect(slots.length).toBe(49);
        });
        it('should include specific slots', () => {
            const slots = generateTimeSlots();
            expect(slots).toContain('10:15'); // 10*60+15 = 615. -15 + N*30. 615 - (-15) = 630. 630/30 = 21. Yes.
            expect(slots).toContain('10:45');
        });
    });

    describe('parseTimeInput (Strict Intersection)', () => {
        const allSlots = generateTimeSlots();
        // Slots like: ... 09:45, 10:15, 10:45, 11:15 ...
        // 09:45 covers [09:45, 10:15)
        // 10:15 covers [10:15, 10:45)
        // 10:45 covers [10:45, 11:15)

        it('should select single slot fully contained', () => {
            // Range 10:00 - 11:00
            // 09:45 slot: 09:45-10:15. Start 9:45 < 10:00. Not fully contained.
            // 10:15 slot: 10:15-10:45. Start 10:15 >= 10:00. End 10:45 <= 11:00. YES.
            // 10:45 slot: 10:45-11:15. End 11:15 > 11:00. Not fully contained.

            const result = parseTimeInput('10:00-11:00', allSlots);
            expect(result).toEqual(['10:15']);
        });

        it('should select multiple contained slots', () => {
            // Range 10:00 - 12:00
            // 10:15 (ends 10:45) - YES
            // 10:45 (ends 11:15) - YES
            // 11:15 (ends 11:45) - YES
            // 11:45 (ends 12:15) - NO (ends after 12:00)

            const result = parseTimeInput('10:00-12:00', allSlots);
            expect(result.sort()).toEqual(['10:15', '10:45', '11:15'].sort());
        });

        it('should handle exact slot matches', () => {
            // Range 10:15 - 10:45
            // 10:15 slot: starts 10:15, ends 10:45. Fits exactly.
            const result = parseTimeInput('10:15-10:45', allSlots);
            expect(result).toEqual(['10:15']);
        });

        it('should handle multiple ranges', () => {
            // 10-11 (10:15), 13-14 (13:15)
            const result = parseTimeInput('10-11 13-14', allSlots);
            expect(result.sort()).toEqual(['10:15', '13:15'].sort());
        });

        it('should handle spaces in ranges', () => {
            // "10 - 11" should be treated as "10-11" -> 10:15
            const result = parseTimeInput('10 - 11', allSlots);
            expect(result).toEqual(['10:15']);
        });

        it('should handle wrapping ranges', () => {
            // 20:00 - 05:00
            // Should include late slots (>=20:00) and early slots (<=05:00)
            const result = parseTimeInput('20:00-05:00', allSlots);

            // Check boundaries
            expect(result).toContain('20:15'); // 20:15-20:45 (Start >= 20:00)
            expect(result).toContain('23:45'); // 23:45-00:15 (Start >= 20:00)
            expect(result).toContain('00:15'); // 00:15-00:45 (End <= 05:00)
            expect(result).toContain('04:15'); // 04:15-04:45 (End <= 05:00)
            expect(result).toContain('-23:45'); // -15 to 15. End 15 <= 300. YES.

            expect(result).not.toContain('19:45'); // 19:45-20:15 (Start 19:45 < 20:00)
            expect(result).not.toContain('05:15'); // 05:15-05:45 (End 345 > 300)
        });
    });

    describe('getCompressedSlots', () => {
        it('should compress consecutive slots', () => {
            // 10:15, 10:45, 11:15 -> 10:15-11:45
            // 10:15 starts 10:15.
            // 11:15 ends 11:45.
            const slots = ['10:15', '10:45', '11:15'];
            expect(getCompressedSlots(slots)).toBe('10:15-11:45');
        });

        it('should handle disjoint ranges', () => {
            // 10:15, 13:15
            // 10:15-10:45, 13:15-13:45
            const slots = ['10:15', '13:15'];
            expect(getCompressedSlots(slots)).toBe('10:15-10:45, 13:15-13:45');
        });

        it('should merge -23:45 and 00:15', () => {
            // -23:45 is -15.
            // 00:15 is 15.
            // -15 + 30 = 15. Continuous!
            const slots = ['-23:45', '00:15'];
            // Range start -15. End 15 + 30 = 45.
            // Format start -15 -> -23:45.
            // Format end 45 -> 00:45.
            expect(getCompressedSlots(slots)).toBe('-23:45-00:45');
        });
    });
});
