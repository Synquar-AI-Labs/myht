import { describe, it, expect } from 'vitest';
import { currentQuarter, doseTimeFields, doseTimeLabel, doseTimeValue, QUARTER_HOURS } from '@/lib/doseTime';
import { logDateTime, buildUpcomingList, type GivenItem, type UpcomingItem } from '@/components/today/todaySchedule';
import { groupGiven, groupUpcoming, relativeDoseTime, elapsedDoseTime, visibleDoseGroups } from '@/lib/doseGroups';
import type { Medicine } from '@/hooks/useMedicines';

describe('medicine dose minutes', () => {
  it('round-trips all quarter hours, including noon and midnight', () => {
    expect(QUARTER_HOURS).toHaveLength(96);
    QUARTER_HOURS.forEach(time => expect(doseTimeValue(doseTimeFields(time))).toBe(time));
    expect(doseTimeLabel(0)).toBe('12:00 AM');
    expect(doseTimeLabel(735)).toBe('12:15 PM');
  });
  it('rounds now down without rounding the hour forward', () => {
    expect(currentQuarter(new Date(2026, 9, 11, 23, 59))).toBe(1425);
  });
  it('keeps legacy hour-only logs and hour-only custom entries unchanged', () => {
    expect(logDateTime({ date: '2026-10-11', hour: 12, am_pm: 'AM' }).getMinutes()).toBe(0);
  });
  it('carries minutes into the administration timestamp', () => {
    const date = logDateTime({ date: '2026-10-11', hour: 9, am_pm: 'PM', minute: 45 });
    expect(date.getHours()).toBe(21);
    expect(date.getMinutes()).toBe(45);
  });
  it('uses precise minutes for the unchanged one-hour matching boundary', () => {
    const medicine = { id: 'medicine', category: 'medicine', frequency: 'daily', schedule_time: '9:00 PM', show_in_quick_log: true } as Medicine;
    const now = new Date('2026-10-11T20:00:00');
    const log = { id: 'log', date: '2026-10-11', medicine_id: medicine.id, hour: 7, am_pm: 'PM', minute: 45, recorded_by: '', created_at: '' };
    expect(buildUpcomingList([medicine], [log], now)).toHaveLength(1);
    expect(buildUpcomingList([medicine], [{ ...log, hour: 8, minute: 0 }], now)).toHaveLength(0);
  });
});

describe('dose time grouping', () => {
  const now = new Date('2026-10-11T12:00:00');
  it('formats future, late, current and elapsed labels', () => {
    expect(relativeDoseTime(new Date('2026-10-11T12:20:00'), now)).toBe('in 20 minutes');
    expect(relativeDoseTime(new Date('2026-10-11T14:00:00'), now)).toBe('in 2 hours');
    expect(relativeDoseTime(now, now)).toBe('now');
    expect(relativeDoseTime(new Date('2026-10-11T11:35:00'), now)).toBe('25 minutes late');
    expect(elapsedDoseTime(new Date('2026-10-11T10:00:00'), now)).toBe('2 hours ago');
    expect(relativeDoseTime(new Date('2026-10-11T13:48:00'), now)).toBe('in 1 hour 48 minutes');
    expect(relativeDoseTime(new Date('2026-10-11T13:00:00'), now)).toBe('in 1 hour');
    expect(relativeDoseTime(new Date('2026-10-11T12:01:00'), now)).toBe('in 1 minute');
    expect(relativeDoseTime(new Date('2026-10-11T10:55:00'), now)).toBe('1 hour 5 minutes late');
    expect(elapsedDoseTime(new Date('2026-10-11T10:55:00'), now)).toBe('1 hour 5 minutes ago');
    expect(elapsedDoseTime(new Date('2026-10-11T11:59:00'), now)).toBe('1 minute ago');
  });
  it('combines same instants and takes the most urgent state', () => {
    const items = [{ at: now, medicine: { id: 'a' }, state: 'late' }, { at: now, medicine: { id: 'b' }, state: 'due' }] as UpcomingItem[];
    const groups = groupUpcoming(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].state).toBe('late');
    expect(items[0].state).toBe('late');
  });
  it('keeps newest-first Given input order and does not merge separate dates', () => {
    const older = new Date('2026-10-10T12:00:00');
    const groups = groupGiven([{ at: now }, { at: now }, { at: older }] as GivenItem[]);
    expect(groups.map(g => g.items.length)).toEqual([2, 1]);
    expect(groups[0].at).toBe(now);
  });
  it('keeps the nearest upcoming time among six visible rows even after many overdue rows', () => {
    const groups = Array.from({ length: 12 }, (_, index) => ({ at: new Date(now.getTime() + (index - 8) * 15 * 60_000) }));
    const visible = visibleDoseGroups(groups, now, true);
    expect(visible).toHaveLength(6);
    expect(visible).toContain(groups[8]);
    expect(visible.map(group => group.at.getTime())).toEqual([...visible.map(group => group.at.getTime())].sort((a, b) => a - b));
  });
});
