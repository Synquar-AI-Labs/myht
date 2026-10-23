import { describe, expect, it } from 'vitest';
import { format } from 'date-fns';
import { routineDay, routineTimeChange, scheduleForDate, TYPICAL_MEALS, type RoutineItem, type RoutineLog } from '@/lib/routineSchedule';
import { EXERCISE_GUIDE, EXERCISE_SAFETY } from '@/lib/exerciseGuide';

const item = (patch: Partial<RoutineItem> = {}): RoutineItem => ({ id: 'meal', household_id: 'family', kind: 'meal', name: 'Sample meal', details: '', drink: '', target_minutes: null, area: '', move_type: '', schedule_time: '8:00 AM / 11:30 PM', previous_schedule_time: null, schedule_from: null, start_date: '2026-01-01', end_date: null, created_at: '2025-12-31T00:00:00Z', ...patch });
const log = (patch: Partial<RoutineLog> = {}): RoutineLog => ({ id: 'log', household_id: 'family', item_id: 'meal', caregiver_id: 'caregiver', for_date: '2026-10-22', for_minute: 1410, done_at: '2026-10-23T04:10:00Z', recorded_by: 'Sample helper', kind: 'meal', name: 'Copied meal', details: 'Copied food', drink: 'Water', target_minutes: null, amount: 'all', minutes: null, note: '', ...patch });
describe('routine daily occurrences on the device clock', () => {
  it('matches exact minutes, not the real completion date or a nearby slot', () => {
    const day = routineDay([item()], [log()], '2026-10-22');
    expect(day.planned).toBe(2); expect(day.done).toBe(1);
    expect(day.occurrences[1].log?.name).toBe('Copied meal');
    expect(routineDay([item()], [log({ for_minute: 1400 })], '2026-10-22').done).toBe(0);
    expect(routineDay([item()], [log()], '2026-10-23').done).toBe(0);
  });
  it('applies start/stop dates and excludes times before creation', () => {
    expect(routineDay([item({ start_date: '2026-10-23' })], [], '2026-10-22').planned).toBe(0);
    expect(routineDay([item({ end_date: '2026-10-22' })], [], '2026-10-22').planned).toBe(0);
    const created = new Date(2026, 9, 22, 12).toISOString();
    expect(routineDay([item({ created_at: created })], [], '2026-10-22').occurrences.map(o => o.minute)).toEqual([1410]);
  });
  it('keeps today and a stale sheet stable through repeated changes, switches tomorrow', () => {
    const now = new Date(2026, 9, 22, 12);
    const old = item(); const stale = routineDay([old], [], '2026-10-22').occurrences[0];
    const changed = { ...old, ...routineTimeChange(old, [600], now) };
    const twice = { ...changed, ...routineTimeChange(changed, [660], now) };
    expect(scheduleForDate(twice, '2026-10-22')).toBe(old.schedule_time);
    expect(routineDay([twice], [log({ for_minute: stale.minute })], stale.date).done).toBe(1);
    expect(routineDay([twice], [], '2026-10-23').occurrences.map(o => o.minute)).toEqual([660]);
    expect(routineTimeChange(twice, [660], now)).toEqual({});
  });
  it('uses local calendar dates across midnight, not a household zone', () => {
    const now = new Date(2026, 9, 22, 23, 59);
    expect(format(now, 'yyyy-MM-dd')).toBe('2026-10-22');
    const householdDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Kiritimati' }).format(now);
    expect(householdDate).not.toBe(format(now, 'yyyy-MM-dd'));
    const day = routineDay([item({ schedule_time: '12:00 AM / 11:45 PM' })], [], format(now, 'yyyy-MM-dd'));
    expect(day.occurrences.map(o => [format(o.at, 'yyyy-MM-dd'), o.at.getHours()])).toEqual([['2026-10-22', 0], ['2026-10-22', 23]]);
  });
  it('keeps exact minute keys on spring-forward and fall-back days', () => {
    for (const date of ['2026-03-08', '2026-11-01']) {
      const day = routineDay([item({ schedule_time: '1:30 AM / 2:30 AM / 3:30 AM' })], [], date);
      expect(day.occurrences.map(o => o.minute)).toEqual([90, 150, 210]);
      expect(day.occurrences.every(o => Number.isFinite(o.at.getTime()))).toBe(true);
    }
  });
});
it('copies the six agreed meals and drinks without inventing any', () => {
  expect(TYPICAL_MEALS.map(m => m.schedule_time)).toEqual(['8:00 AM', '10:30 AM', '1:00 PM', '3:30 PM', '6:00 PM', '8:30 PM']);
  expect(TYPICAL_MEALS[0].drink).toBe('Tea or water'); expect(TYPICAL_MEALS[5].details).toBe('Warm milk or herbal tea');
});
it('preserves all thirteen guide areas, unusual groups and the safety line', () => {
  expect(EXERCISE_GUIDE.map(a => a.name)).toEqual(['Feet', 'Legs', 'Knees', 'Hips', 'Back', 'Neck', 'Shoulders', 'Thighs', 'Fingers', 'Elbows', 'Calves', 'Jaw', 'Head']);
  expect(EXERCISE_GUIDE.find(a => a.name === 'Thighs')?.groups.map(g => g.name)).toEqual(['Quads', 'Hamstrings', 'Inner thigh', 'Outer thigh']);
  expect(EXERCISE_GUIDE.find(a => a.name === 'Knees')?.groups[0].moves).toContain('Terminal knee extensions');
  expect(EXERCISE_GUIDE.find(a => a.name === 'Hips')?.groups[2].moves).toContain("World's greatest stretch");
  expect(EXERCISE_GUIDE.find(a => a.name === 'Head')?.groups[1].moves).toContain('20-20-20 eye breaks');
  expect(EXERCISE_SAFETY).toContain('Sharp pain, numbness, tingling or swelling means stop.');
  expect(EXERCISE_GUIDE.flatMap(a => a.groups.flatMap(g => g.moves)).every(m => !/\b(reps|sets)\b/i.test(m))).toBe(true);
});
