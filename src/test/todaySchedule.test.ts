import { describe, it, expect } from 'vitest';
import { buildGivenList, buildUpcomingList, logDateTime } from '@/components/today/todaySchedule';
import type { Medicine, MedicineLog } from '@/hooks/useMedicines';

const med = (over: Partial<Medicine>): Medicine => ({
  id: 'm1',
  name: 'Test Med',
  potency: '',
  amount: '1 pill',
  schedule_note: '',
  schedule_time: '',
  category: 'medicine',
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

  it('excludes future-dated logs', () => {
    const logs = [log({ id: 'f', hour: 11, am_pm: 'PM' })]; // 11 PM > now+1h
    expect(buildGivenList(logs, [med({})], NOW)).toHaveLength(0);
  });
});

describe('buildUpcomingList', () => {
  it('lists scheduled doses in the next 12 hours, soonest first', () => {
    const meds = [
      med({ id: 'm1', name: 'A', schedule_time: '9:00 PM' }),
      med({ id: 'm2', name: 'B', schedule_time: '8:00 AM' }), // tomorrow morning, inside 12h
      med({ id: 'm3', name: 'C', schedule_time: '2:00 PM' }), // today past+outside, tomorrow outside
    ];
    const result = buildUpcomingList(meds, [], NOW);
    expect(result.map(r => r.medicine.name)).toEqual(['A', 'B']);
  });

  it('flags due within lead window and keeps missed doses up to 2h back', () => {
    const meds = [
      med({ id: 'm1', name: 'DueNow', schedule_time: '9:00 PM' }),   // 13 min ahead → due
      med({ id: 'm2', name: 'Missed', schedule_time: '7:30 PM' }),   // 77 min ago, unlogged → due
      med({ id: 'm3', name: 'Later', schedule_time: '11:00 PM' }),   // 2h+ ahead → not due
    ];
    const result = buildUpcomingList(meds, [], NOW);
    const byName = Object.fromEntries(result.map(r => [r.medicine.name, r.due]));
    expect(byName['DueNow']).toBe(true);
    expect(byName['Missed']).toBe(true);
    expect(byName['Later']).toBe(false);
  });

  it('drops slots already logged within ±1 hour', () => {
    const meds = [med({ id: 'm1', name: 'A', schedule_time: '9:00 PM' })];
    const logs = [log({ hour: 8, am_pm: 'PM' })]; // 8:00 PM log covers 9:00 PM slot (±1h)
    expect(buildUpcomingList(meds, logs, NOW)).toHaveLength(0);
  });

  it('handles multi-slot schedules and never flags non-medicines due', () => {
    const meds = [
      med({ id: 'm1', name: 'Multi', schedule_time: '10:00 AM / 9:00 PM' }),
      med({ id: 'm2', name: 'Flush', category: 'non-medicine', schedule_time: '10:00 PM' }),
    ];
    const result = buildUpcomingList(meds, [], NOW);
    const multi = result.filter(r => r.medicine.name === 'Multi');
    // 9:00 PM today (due) and 10:00 AM tomorrow is >12h → excluded
    expect(multi).toHaveLength(1);
    expect(multi[0].due).toBe(true);
    const flush = result.find(r => r.medicine.name === 'Flush');
    expect(flush).toBeDefined();
    expect(flush!.due).toBe(false);
  });

  it('skips as-needed/unparseable schedules', () => {
    const meds = [med({ id: 'm1', schedule_time: 'As needed' }), med({ id: 'm2', schedule_time: '' })];
    expect(buildUpcomingList(meds, [], NOW)).toHaveLength(0);
  });
});
