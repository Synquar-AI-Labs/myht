import { describe, it, expect } from 'vitest';
import { buildDiaryEntries, groupDiary, periodOf } from '@/components/history/diary';
import type { Medicine, MedicineLog } from '@/hooks/useMedicines';

const med: Medicine = {
  id: 'm1', name: 'Metoclopramide 5mg', potency: '5mg', amount: '2', schedule_note: '',
  schedule_time: '', category: 'medicine', frequency: 'daily', show_in_quick_log: true,
  created_at: '2026-07-01T00:00:00Z',
};

const medLog: MedicineLog = {
  id: 'l1', date: '2026-07-13', medicine_id: 'm1', hour: 8, am_pm: 'PM',
  recorded_by: 'Affan', created_at: '2026-07-13T20:05:00',
};

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
      medLogs: [medLog],
      medicines: [med],
      bpReadings: [{ id: 'b1', date: '2026-07-13', systolic: 118, diastolic: 76, recorded_by: 'Umair', created_at: '2026-07-13T14:15:00' }],
      customActions: [{ id: 'a1', name: 'Walk', unit: 'min', color: '', default_value: 10, show_graph: false, created_at: '' }],
      customLogs: [{ id: 'c1', action_id: 'a1', value: 15, date: '2026-07-13', recorded_by: 'Fahad', hour: 9, am_pm: 'AM', created_at: '2026-07-13T09:00:00' }],
      notes: [{ id: 'n1', date: '2026-07-13', title: 'Chair', content: 'Moved to chair fine', recorded_by: 'Umair', created_at: '2026-07-13T11:30:00' }],
      transcripts: [{ id: 't1', title: null, summary: 'Discussed dosage', recorded_by: 'Fahad', created_at: '2026-07-13T10:30:00' }],
    });

    expect(entries.map(e => e.kind)).toEqual(['medicine', 'bp', 'note', 'transcript', 'custom']);
    expect(entries[0].title).toBe('Metoclopramide 5mg given');
    expect(entries[0].detail).toBe('5mg · 2');
    expect(entries[0].by).toBe('Affan');
    expect(entries[1].title).toBe('Blood pressure 118/76');
    expect(entries[3].title).toBe('Doctor conversation');
  });
});

describe('groupDiary', () => {
  it('returns only non-empty periods, newest period first', () => {
    const entries = buildDiaryEntries({
      medLogs: [medLog, { ...medLog, id: 'l2', hour: 9, am_pm: 'AM', recorded_by: 'Umair' }],
      medicines: [med],
      bpReadings: [], customActions: [], customLogs: [], notes: [], transcripts: [],
    });
    const groups = groupDiary(entries);
    expect(groups.map(g => g.key)).toEqual(['evening', 'morning']);
    expect(groups[0].entries).toHaveLength(1);
    expect(groups[1].entries).toHaveLength(1);
  });
});
