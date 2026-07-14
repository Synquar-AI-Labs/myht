import { describe, it, expect } from 'vitest';
import { buildDiaryEntries, groupDiary, periodOf } from '@/components/history/diary';
import type { Medicine, MedicineLog } from '@/hooks/useMedicines';

const med: Medicine = {
  id: 'm1', name: 'Metoclopramide 5mg', potency: '5mg', amount: '2', schedule_note: '',
  schedule_time: '', category: 'medicine', frequency: 'daily', show_in_quick_log: true,
  created_at: '2026-07-01T00:00:00Z',
};

const flushMed: Medicine = { ...med, id: 'm2', name: 'Flush', category: 'non-medicine', potency: '', amount: '500 ml' };

const medLog: MedicineLog = {
  id: 'l1', date: '2026-07-13', medicine_id: 'm1', hour: 8, am_pm: 'PM',
  recorded_by: 'Affan', created_at: '2026-07-13T20:05:00',
};

const DAY = '2026-07-13';
const empty = { medLogs: [], medicines: [], bpReadings: [], customActions: [], customLogs: [], notes: [], transcripts: [] };

describe('periodOf', () => {
  it('maps hours to time-of-day periods', () => {
    expect(periodOf(new Date('2026-07-13T20:00:00'))).toBe('evening');
    expect(periodOf(new Date('2026-07-13T14:00:00'))).toBe('afternoon');
    expect(periodOf(new Date('2026-07-13T08:00:00'))).toBe('morning');
    expect(periodOf(new Date('2026-07-13T02:00:00'))).toBe('night');
    expect(periodOf(new Date('2026-07-13T17:00:00'))).toBe('evening');
    expect(periodOf(new Date('2026-07-13T12:00:00'))).toBe('afternoon');
    expect(periodOf(new Date('2026-07-13T05:00:00'))).toBe('morning');
  });
});

describe('buildDiaryEntries', () => {
  it('merges all sources newest-first with titles, dose detail and attribution', () => {
    const entries = buildDiaryEntries({
      ...empty,
      date: DAY,
      medLogs: [medLog],
      medicines: [med],
      bpReadings: [{ id: 'b1', date: DAY, systolic: 118, diastolic: 76, recorded_by: 'Umair', created_at: '2026-07-13T14:15:00' }],
      customActions: [{ id: 'a1', name: 'Walk', unit: 'min', color: '', default_value: 10, show_graph: false, created_at: '' }],
      customLogs: [{ id: 'c1', action_id: 'a1', value: 15, date: DAY, recorded_by: 'Fahad', hour: 9, am_pm: 'AM', created_at: '2026-07-13T09:00:00' }],
      notes: [{ id: 'n1', date: DAY, title: 'Chair', content: 'Moved to chair fine', recorded_by: 'Umair', created_at: '2026-07-13T11:30:00' }],
      transcripts: [{ id: 't1', title: null, summary: 'Discussed dosage', recorded_by: 'Fahad', created_at: '2026-07-13T10:30:00' }],
    });

    expect(entries.map(e => e.kind)).toEqual(['medicine', 'bp', 'note', 'transcript', 'custom']);
    expect(entries[0].title).toBe('Metoclopramide 5mg given');
    expect(entries[0].detail).toBe('5mg · 2');
    expect(entries[0].by).toBe('Affan');
    expect(entries[0].timeKind).toBe('event');
    expect(entries[1].title).toBe('Blood pressure 118/76');
    expect(entries[1].timeKind).toBe('entered');
    expect(entries[1].untimed).toBe(false);
  });

  it('reclassifies non-medicine pseudo-items as activities, not "given" medicines', () => {
    const entries = buildDiaryEntries({
      ...empty,
      date: DAY,
      medLogs: [{ ...medLog, id: 'l2', medicine_id: 'm2' }],
      medicines: [flushMed],
    });
    expect(entries[0].kind).toBe('custom');
    expect(entries[0].title).toBe('Flush');
  });

  it('marks entries typed in on a different day as untimed', () => {
    const entries = buildDiaryEntries({
      ...empty,
      date: '2026-07-12',
      bpReadings: [{ id: 'b1', date: '2026-07-12', systolic: 120, diastolic: 80, recorded_by: 'Umair', created_at: '2026-07-13T14:15:00' }],
    });
    expect(entries[0].untimed).toBe(true);
  });

  it('breaks equal-hour ties by created_at', () => {
    const entries = buildDiaryEntries({
      ...empty,
      date: DAY,
      medLogs: [
        { ...medLog, id: 'a', created_at: '2026-07-13T20:01:00' },
        { ...medLog, id: 'b', created_at: '2026-07-13T20:30:00' },
      ],
      medicines: [med],
    });
    expect(entries.map(e => e.id)).toEqual(['med-b', 'med-a']);
  });
});

describe('groupDiary', () => {
  it('returns only non-empty periods, newest period first', () => {
    const entries = buildDiaryEntries({
      ...empty,
      date: DAY,
      medLogs: [medLog, { ...medLog, id: 'l2', hour: 9, am_pm: 'AM', recorded_by: 'Umair' }],
      medicines: [med],
    });
    const groups = groupDiary(entries);
    expect(groups.map(g => g.key)).toEqual(['evening', 'morning']);
  });

  it('puts cross-day-entered items in the untimed group, last', () => {
    const entries = buildDiaryEntries({
      ...empty,
      date: '2026-07-12',
      medLogs: [{ ...medLog, date: '2026-07-12' }],
      medicines: [med],
      notes: [{ id: 'n1', date: '2026-07-12', title: null, content: 'Backfilled', recorded_by: 'Umair', created_at: '2026-07-13T09:00:00' }],
    });
    const groups = groupDiary(entries);
    expect(groups.map(g => g.key)).toEqual(['evening', 'untimed']);
    expect(groups[1].entries[0].kind).toBe('note');
  });
});
