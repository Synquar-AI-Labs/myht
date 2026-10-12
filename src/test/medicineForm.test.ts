import { describe, it, expect } from 'vitest';
import { canonicalSchedule, readStoredSchedule, preserveEarlierNote, fillMedicineTimes, medicineReadBack } from '@/lib/medicineForm';

describe('medicine form schedule', () => {
  it('sorts, de-duplicates and round-trips schedule text', () => {
    const text = canonicalSchedule([855, 360, 600, 360]);
    expect(text).toBe('6:00 AM / 10:00 AM / 2:15 PM');
    expect(readStoredSchedule(text)).toEqual({ times: [360, 600, 855], earlier: '' });
  });
  it('reads old typed times without rounding off-quarter minutes', () => {
    expect(readStoredSchedule('9:10AM/9PM')).toEqual({ times: [550, 1260], earlier: '' });
    expect(canonicalSchedule([550])).toBe('9:10 AM');
  });
  it('preserves unparseable or partially readable original text once', () => {
    for (const text of ['Continuous', '9AM / with food', '9 AM after food', '25:00 PM']) {
      expect(readStoredSchedule(text).earlier).toBe(text);
      const note = preserveEarlierNote('Existing note', text);
      expect(note).toBe(`Existing note\nEarlier entry: ${text}`);
      expect(preserveEarlierNote(note, text)).toBe(note);
    }
  });
  it('fills all round-the-clock intervals without duplicates, wrapping and sorting', () => {
    for (const hours of [1, 2, 3, 4, 6, 8, 12]) {
      const times = fillMedicineTimes(hours, 480);
      expect(times).toHaveLength(24 / hours);
      expect(new Set(times).size).toBe(times.length);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
    expect(fillMedicineTimes(4, 480)).toEqual([0, 240, 480, 720, 960, 1200]);
  });
  it('fills non-divisors only from start until midnight', () => {
    expect(fillMedicineTimes(5, 0)).toEqual([0, 300, 600, 900, 1200]);
    expect(fillMedicineTimes(5, 480)).toEqual([480, 780, 1080, 1380]);
    for (const hours of [5, 7, 9, 10, 11]) expect(fillMedicineTimes(hours, 1425)).toEqual([1425]);
  });
  it('rejects invalid interval arguments', () => {
    for (const hours of [0, 13, 1.5]) expect(() => fillMedicineTimes(hours, 480)).toThrow();
    for (const start of [-1, 1440, 1.5]) expect(() => fillMedicineTimes(4, start)).toThrow();
  });
  it('reads back daily, no-time, every-few-days and PRN accurately', () => {
    expect(medicineReadBack('daily', [360, 600, 840])).toBe('Given every day at 6:00 AM, 10:00 AM and 2:00 PM.');
    expect(medicineReadBack('daily', [])).toBe('Given every day. No times set, so it will not appear under Coming up.');
    expect(medicineReadBack('every 3 days', [540])).toBe('Given every 3 days at 9:00 AM. Pick a start day to see this under Coming up.');
    expect(medicineReadBack('as needed', [540])).toBe('Given only when needed.');
  });
  it('does not reinterpret unknown frequencies or off-quarter times', () => {
    expect(medicineReadBack('on clinic days', [550])).toBe('Given on clinic days at 9:10 AM.');
    expect(medicineReadBack('', [550])).toBe('Given every day at 9:10 AM.');
  });
});
