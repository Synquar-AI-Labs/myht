import { describe, it, expect } from 'vitest';
import { buildUpcomingList, occurrenceLink, scheduledDoseDetail, visibleSkips, type DoseSkip } from '@/components/today/todaySchedule';
import type { Medicine, MedicineLog } from '@/hooks/useMedicines';
import { doseCandidates, automaticDose } from '@/lib/doseRecording';

const med = { id: 'm', name: 'Synthetic tablet', frequency: 'daily', category: 'medicine', show_in_quick_log: true, schedule_time: '8:00 AM / 9:00 AM' } as Medicine;
const now = new Date('2026-10-11T11:00:00');
const at = new Date('2026-10-11T08:00:00');
const log = { id: 'l', medicine_id: 'm', date: '2026-10-11', hour: 11, minute: 0, am_pm: 'AM', recorded_by: 'Synthetic caregiver' } as MedicineLog;
describe('explicit dose resolution', () => {
  it('a linked record 3 hours late clears only its own slot; an unlinked one does not', () => {
    expect(buildUpcomingList([med], [log], now)).toHaveLength(2);
    const linked = { ...log, ...occurrenceLink(at) };
    expect(buildUpcomingList([med], [linked], now).map(i => i.at.getHours())).toEqual([9]);
    expect(scheduledDoseDetail(linked)).toBe('due 8:00 AM');
  });
  it('resolves linked slots first, then matches the remaining legacy record', () => {
    const linked = { ...log, ...occurrenceLink(at) };
    const legacy = { ...log, hour: 8, minute: 30 };
    expect(buildUpcomingList([med], [legacy, linked], now)).toHaveLength(0);
  });
  it('an explicit extra dose never clears a slot', () => {
    expect(buildUpcomingList([med], [{ ...log, hour: 8, is_extra: true }], now)).toHaveLength(2);
  });
  it('missed starts after 2 hours and ends after 12 hours', () => {
    const one = { ...med, schedule_time: '8:00 AM' };
    expect(buildUpcomingList([one], [], new Date('2026-10-11T10:00:00'))[0].state).toBe('late');
    expect(buildUpcomingList([one], [], new Date('2026-10-11T10:00:00.001'))[0].state).toBe('missed');
    expect(buildUpcomingList([one], [], new Date('2026-10-11T20:00:00')).filter(item => item.at.getDate() === 11)).toHaveLength(1);
    expect(buildUpcomingList([one], [], new Date('2026-10-11T20:00:00.001')).filter(item => item.at.getDate() === 11)).toHaveLength(0);
  });
  it('resolves a previous-day link across midnight without clearing the next slot', () => {
    const overnight = { ...med, schedule_time: '11:00 PM / 1:00 AM' };
    const linked = { ...log, date: '2026-10-12', hour: 2, ...occurrenceLink(new Date('2026-10-11T23:00:00')) };
    const result = buildUpcomingList([overnight], [linked], new Date('2026-10-12T02:00:00'));
    expect(result.map(i => i.at.getHours())).toEqual([1]);
  });
  it('a skip resolves its slot without being a dose', () => {
    const skip = { id: 's', medicine_id: med.id, ...occurrenceLink(at), reason: 'Not needed' } as DoseSkip;
    expect(buildUpcomingList([med], [], now, [skip]).map(i => i.at.getHours())).toEqual([9]);
    expect(visibleSkips([skip], [{ ...log, ...occurrenceLink(at) }], [med], now)).toHaveLength(0);
    expect(visibleSkips([skip], [{ ...log, hour: 8 }], [med], now)).toHaveLength(0);
    expect(visibleSkips([skip], [{ ...log, hour: 8, is_extra: true }], [med], now)).toHaveLength(1);
    // Given wins over a skip, but one legacy record still clears only one slot.
    expect(buildUpcomingList([med], [{ ...log, hour: 8, minute: 30 }], now, [skip]).map(item => item.at.getHours())).toEqual([9]);
  });
  it('list candidates stop at 2 hours ahead; only a single soon/due candidate auto-links', () => {
    const list = buildUpcomingList([med], [], new Date('2026-10-11T07:50:00'));
    const candidates = doseCandidates(list, med.id, new Date('2026-10-11T07:50:00'));
    expect(candidates).toHaveLength(2); expect(automaticDose(candidates)).toBeUndefined();
    expect(automaticDose(candidates.slice(0, 1))).toBe(candidates[0]);
    expect(automaticDose([{ ...candidates[0], state: 'missed' }])).toBeUndefined();
  });
});
