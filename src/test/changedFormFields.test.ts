import { describe, it, expect } from 'vitest';
import { changedFormFields, changedDayFields } from '@/lib/dayRecord';
import type { HealthRecordForm } from '@/types/health';

describe('changedFormFields', () => {
  it('writes only weight and recorder when other saved values are untouched', () => {
    const baseline = { feedBags: 3, stoolCount: 2, miscNotes: 'Keep these notes', weight: 61, recordedBy: 'Previous caregiver' };
    expect(changedFormFields({ ...baseline, weight: 62, recordedBy: 'Current caregiver' }, baseline))
      .toEqual({ weight: 62, recorded_by: 'Current caregiver' });
  });

  it('compares with the blank starting form even if another row appeared meanwhile', () => {
    const baseline = { feedBags: 0, stoolCount: 0, miscNotes: '', weight: 0, recordedBy: '' };
    expect(changedFormFields({ ...baseline, weight: 62, recordedBy: 'Current caregiver' }, baseline))
      .toEqual({ weight: 62, recorded_by: 'Current caregiver' });
  });

  it('does not consider a different recorder a data change', () => {
    const baseline = { feedBags: 3, weight: 62, recordedBy: 'Previous caregiver' };
    expect(changedFormFields({ ...baseline, recordedBy: 'Current caregiver' }, baseline))
      .toEqual({ recorded_by: 'Current caregiver' });
  });
});

describe('absolute day edit fields', () => {
  const baseline = { feedBags: 3, stoolCount: 2, miscNotes: 'Keep these notes', weight: 61, recordedBy: 'Original caregiver', caregiverId: 'original' } as HealthRecordForm;
  it('a weight correction preserves every other value and original attribution', () => {
    expect(changedDayFields({ ...baseline, weight: 62 }, baseline, [])).toEqual({ weight: 62 });
  });
  it('no change writes no columns, even if a display name differs', () => {
    expect(changedDayFields({ ...baseline, recordedBy: 'Current device person' }, baseline, [])).toEqual({});
  });
  it('a blank baseline never contributes zero totals to a later-created day', () => {
    const blank = { feedBags: 0, stoolCount: 0, miscNotes: '', weight: 0, recordedBy: '' } as HealthRecordForm;
    expect(changedDayFields({ ...blank, weight: 62 }, blank, [])).toEqual({ weight: 62 });
  });
  it('deliberate attribution changes write the id and name together', () => {
    expect(changedDayFields({ ...baseline, caregiverId: 'helper' }, baseline, [{ caregiver_id: 'helper', display_name: 'Helper', is_active: true, user_id: null, role: null, email: null }])).toEqual({ caregiver_id: 'helper', recorded_by: 'Helper' });
  });
});
