import { describe, it, expect } from 'vitest';
import { changedFormFields } from '@/lib/dayRecord';

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
