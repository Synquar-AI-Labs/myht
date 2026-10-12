import { describe, it, expect } from 'vitest';
import { isMedicineScheduledOnDate, nextMedicineDay } from '@/lib/medicineDays';
import { medicineReadBack } from '@/lib/medicineForm';
import { buildUpcomingList, slotStateAt } from '@/components/today/todaySchedule';
import type { Medicine } from '@/hooks/useMedicines';
import { URGENCY } from '@/lib/medicineUrgency';
import { visibleDoseGroups } from '@/lib/doseGroups';

describe('anchored calendar days', () => {
  const medicine = { frequency: 'every 3 days', start_date: '2026-10-11' };
  it('includes start and positive multiples, but not intervening or earlier days', () => {
    for (const [day, expected] of [['2026-10-10', false], ['2026-10-11', true], ['2026-10-13', false], ['2026-10-14', true], ['2026-10-17', true]] as const) expect(isMedicineScheduledOnDate(medicine, new Date(`${day}T23:59:00`))).toBe(expected);
  });
  it('supports weekly and rejects missing/invalid starts and unsupported frequencies', () => {
    expect(isMedicineScheduledOnDate({ ...medicine, frequency: 'every 7 days' }, new Date('2026-10-18T00:00:00'))).toBe(true);
    for (const start_date of [null, 'invalid', '2026-02-31']) expect(isMedicineScheduledOnDate({ ...medicine, start_date }, new Date('2026-10-11T12:00:00'))).toBe(false);
    expect(isMedicineScheduledOnDate({ frequency: 'as needed', start_date: medicine.start_date }, new Date())).toBe(false);
  });
  it('counts calendar days across DST rather than elapsed 24-hour periods', () => {
    const before = new Date('2026-03-07T09:00:00-05:00');
    const after = new Date('2026-03-09T09:00:00-04:00');
    expect((after.getTime() - before.getTime()) / 3_600_000).toBe(47);
    expect(isMedicineScheduledOnDate({ frequency: 'every 2 days', start_date: '2026-03-07' }, after)).toBe(true);
    expect(isMedicineScheduledOnDate({ frequency: 'every 2 days', start_date: '2026-10-31' }, new Date('2026-11-02T09:00:00-05:00'))).toBe(true);
  });
  it('changes at local midnight and includes eligible tomorrow slots in the 12-hour window', () => {
    const med = { id: 'm', category: 'medicine', show_in_quick_log: true, frequency: 'every 2 days', start_date: '2026-10-12', schedule_time: '1:00 AM' } as Medicine;
    const items = buildUpcomingList([med], [], new Date('2026-10-11T23:30:00'));
    expect(items).toHaveLength(1);
    expect(items[0].at.getDate()).toBe(12);
    expect(isMedicineScheduledOnDate(med, new Date('2026-10-11T23:59:59'))).toBe(false);
    expect(isMedicineScheduledOnDate(med, new Date('2026-10-12T00:00:00'))).toBe(true);
  });
  it('keeps daily scheduling independent of the start marker and reads back the next date', () => {
    expect(isMedicineScheduledOnDate({ frequency: 'daily', start_date: '2030-01-01' }, new Date('2026-10-11T12:00:00'))).toBe(true);
    const now = new Date('2026-10-11T12:00:00');
    expect(nextMedicineDay(medicine, [540], now)?.getDate()).toBe(14);
    expect(medicineReadBack(medicine.frequency, [540], medicine.start_date, now)).toBe('Given every 3 days at 9:00 AM, starting Sunday, October 11. Next: Wednesday, October 14.');
  });
});

describe('urgency boundaries and visibility', () => {
  const at = new Date('2026-10-11T12:00:00');
  it.each([[-15 * 60_000 - 1, 'scheduled'], [-15 * 60_000, 'soon'], [-1, 'soon'], [0, 'due'], [15 * 60_000, 'due'], [15 * 60_000 + 1, 'late'], [120 * 60_000, 'late']] as const)('classifies elapsed milliseconds %i as %s', (elapsed, state) => {
    expect(slotStateAt(at, new Date(at.getTime() + elapsed))).toBe(state);
  });
  it('keeps the unchanged 2-hour drop-off', () => {
    const med = { id: 'm', category: 'medicine', frequency: 'daily', schedule_time: '12:00 PM', show_in_quick_log: true } as Medicine;
    expect(buildUpcomingList([med], [], new Date(at.getTime() + 120 * 60_000))).toHaveLength(1);
    expect(buildUpcomingList([med], [], new Date(at.getTime() + 120 * 60_000 + 1))).toHaveLength(0);
  });
  it('never hides an urgent group beyond six rows', () => {
    const groups = Array.from({ length: 10 }, (_, i) => ({ at: new Date(at.getTime() + i * 60_000), state: i === 9 ? 'late' as const : 'scheduled' as const }));
    expect(visibleDoseGroups(groups, at, true)).toContain(groups[9]);
  });
  it('keeps each badge foreground/background contrast above 4.5:1', () => {
    const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(part => parseInt(part, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    Object.values(URGENCY).forEach(style => {
      const values = [luminance(style.badgeText), luminance(style.badgeBackground)].sort((a, b) => b - a);
      expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
