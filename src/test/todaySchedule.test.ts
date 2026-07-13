import { describe, it, expect } from 'vitest';
import { buildGivenList, buildUpcomingList, logDateTime, doseLabel } from '@/components/today/todaySchedule';
import type { Medicine, MedicineLog } from '@/hooks/useMedicines';

const med = (over: Partial<Medicine>): Medicine => ({
  id: 'm1',
  name: 'Test Med',
  potency: '',
  amount: '1 pill',
  schedule_note: '',
  schedule_time: '',
  category: 'medicine',
  frequency: 'daily',
  show_in_quick_log: true,
  created_at: '2026-07-01T00:00:00Z',
  ...over,
});

const log = (over: Partial<MedicineLog>): MedicineLog => ({
  id: 'l1',
  date: '2026-07-13',
  medicine_id: 'm1',
  hour: 8,
  am_pm: 'AM',
  recorded_by: 'Fahad',
  created_at: '2026-07-13T08:00:00Z',
  ...over,
});

// Fixed "now": July 13 2026, 8:47 PM local
const NOW = new Date('2026-07-13T20:47:00');

describe('logDateTime', () => {
  it('converts 12h fields to a local Date', () => {
    expect(logDateTime({ date: '2026-07-13', hour: 8, am_pm: 'PM' }).getHours()).toBe(20);
    expect(logDateTime({ date: '2026-07-13', hour: 12, am_pm: 'AM' }).getHours()).toBe(0);
    expect(logDateTime({ date: '2026-07-13', hour: 12, am_pm: 'PM' }).getHours()).toBe(12);
  });
});

describe('doseLabel', () => {
  it('joins potency and amount — potency is medically meaningful', () => {
    expect(doseLabel(med({ potency: '1mg', amount: '1.5 pills' }))).toBe('1mg · 1.5 pills');
    expect(doseLabel(med({ potency: '', amount: '2 pills' }))).toBe('2 pills');
    expect(doseLabel(undefined)).toBe('');
  });
});

describe('buildGivenList', () => {
  it('includes logs within the last 12 hours, most recent first', () => {
    const logs = [
      log({ id: 'a', hour: 10, am_pm: 'AM' }), // 10:00 AM — inside window
      log({ id: 'b', hour: 8, am_pm: 'PM' }),  // 8:00 PM — inside window
      log({ id: 'c', hour: 7, am_pm: 'AM' }),  // 7:00 AM — outside (>12h ago)
    ];
    const result = buildGivenList(logs, [med({})], NOW);
    expect(result.map(r => r.log.id)).toEqual(['b', 'a']);
  });

  it('spans midnight using yesterday logs', () => {
    const morning = new Date('2026-07-13T06:00:00');
    const logs = [
      log({ id: 'y', date: '2026-07-12', hour: 11, am_pm: 'PM' }), // 7h ago — inside
      log({ id: 'z', date: '2026-07-12', hour: 5, am_pm: 'PM' }),  // 13h ago — outside
    ];
    const result = buildGivenList(logs, [med({})], morning);
    expect(result.map(r => r.log.id)).toEqual(['y']);
  });

  it('never shows future administrations as given (max 5 min clock skew)', () => {
    const logs = [log({ id: 'f', hour: 9, am_pm: 'PM' })]; // 9 PM > 8:47 + 5 min
    expect(buildGivenList(logs, [med({})], NOW)).toHaveLength(0);
  });
});

describe('buildUpcomingList — scheduling scope', () => {
  it('lists daily doses in the next 12 hours, soonest first', () => {
    const meds = [
      med({ id: 'm1', name: 'A', schedule_time: '9:00 PM' }),
      med({ id: 'm2', name: 'B', schedule_time: '8:00 AM' }), // tomorrow morning, inside 12h
      med({ id: 'm3', name: 'C', schedule_time: '2:00 PM' }), // today too old, tomorrow too far
    ];
    const result = buildUpcomingList(meds, [], NOW);
    expect(result.map(r => r.medicine.name)).toEqual(['A', 'B']);
  });

  it('never auto-schedules PRN or every-N-day medicines, even with parseable times', () => {
    const meds = [
      med({ id: 'm1', name: 'PRN', frequency: 'as needed', schedule_time: '9:00 PM' }),
      med({ id: 'm2', name: 'EveryTwo', frequency: 'every 2 days', schedule_time: '9:00 PM' }),
      med({ id: 'm3', name: 'Daily', frequency: 'daily', schedule_time: '9:00 PM' }),
    ];
    const result = buildUpcomingList(meds, [], NOW);
    expect(result.map(r => r.medicine.name)).toEqual(['Daily']);
  });

  it('excludes non-medicine items and hidden medicines entirely', () => {
    const meds = [
      med({ id: 'm1', name: 'Flush', category: 'non-medicine', schedule_time: '10:00 PM' }),
      med({ id: 'm2', name: 'Hidden', show_in_quick_log: false, schedule_time: '9:00 PM' }),
    ];
    expect(buildUpcomingList(meds, [], NOW)).toHaveLength(0);
  });

  it('skips as-needed/unparseable schedule strings', () => {
    const meds = [med({ id: 'm1', schedule_time: 'As needed' }), med({ id: 'm2', schedule_time: '' })];
    expect(buildUpcomingList(meds, [], NOW)).toHaveLength(0);
  });
});

describe('buildUpcomingList — states', () => {
  it('splits due (±15 min, flashing) from overdue (static, up to 2h) from scheduled', () => {
    const meds = [
      med({ id: 'm1', name: 'DueNow', schedule_time: '9:00 PM' }),   // 13 min ahead → due
      med({ id: 'm2', name: 'Missed', schedule_time: '7:30 PM' }),   // 77 min ago → overdue
      med({ id: 'm3', name: 'JustPast', schedule_time: '8:45 PM' }), // 2 min ago → due
      med({ id: 'm4', name: 'Later', schedule_time: '11:00 PM' }),   // 2h+ ahead → scheduled
    ];
    const byName = Object.fromEntries(
      buildUpcomingList(meds, [], NOW).map(r => [r.medicine.name, r.state]),
    );
    expect(byName['DueNow']).toBe('due');
    expect(byName['Missed']).toBe('overdue');
    expect(byName['JustPast']).toBe('due');
    expect(byName['Later']).toBe('scheduled');
  });

  it('drops overdue doses after the 2-hour trail', () => {
    const meds = [med({ id: 'm1', schedule_time: '6:00 PM' })]; // 2h47m ago
    expect(buildUpcomingList(meds, [], NOW)).toHaveLength(0);
  });
});

describe('buildUpcomingList — one-to-one log matching', () => {
  it('one log can never satisfy two scheduled doses', () => {
    // Slots 8 PM and 10 PM; a single 9 PM log is within ±1h of BOTH.
    const meds = [med({ id: 'm1', name: 'Twice', schedule_time: '8:00 PM / 10:00 PM' })];
    const logs = [log({ hour: 9, am_pm: 'PM' })];
    const result = buildUpcomingList(meds, logs, NOW);
    // The log consumes the 8 PM slot (walked chronologically); 10 PM survives.
    expect(result).toHaveLength(1);
    expect(result[0].at.getHours()).toBe(22);
  });

  it('two logs clear two adjacent slots', () => {
    const meds = [med({ id: 'm1', schedule_time: '8:00 PM / 10:00 PM' })];
    const logs = [
      log({ id: 'a', hour: 8, am_pm: 'PM' }),
      log({ id: 'b', hour: 9, am_pm: 'PM', created_at: '2026-07-13T21:00:00Z' }),
    ];
    expect(buildUpcomingList(meds, logs, NOW)).toHaveLength(0);
  });

  it('drops a slot when a log lands within ±1 hour', () => {
    const meds = [med({ id: 'm1', schedule_time: '9:00 PM' })];
    const logs = [log({ hour: 8, am_pm: 'PM' })];
    expect(buildUpcomingList(meds, logs, NOW)).toHaveLength(0);
  });

  it('handles multi-slot schedules across the window', () => {
    const meds = [med({ id: 'm1', name: 'Multi', schedule_time: '10:00 AM / 9:00 PM' })];
    const result = buildUpcomingList(meds, [], NOW);
    // 10 AM today is >2h past, 10 AM tomorrow is >12h away → only 9 PM shows.
    expect(result).toHaveLength(1);
    expect(result[0].state).toBe('due');
  });
});
