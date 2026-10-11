import { describe, expect, it } from 'vitest';
import { readingArgs } from '@/lib/readingArgs';

describe('quick reading RPC arguments', () => {
  it('maps all delta fields and identity without reading or computing totals', () => {
    expect(readingArgs('household', '2026-07-12', { feedBags: 2, bileBags: 1, stoolCount: -1, vomitCount: 1, urineCount: 3, flushMl: 500, flushCount: 1, weight: 62 }, 'person', 'Caregiver')).toEqual({
      p_household_id: 'household', p_date: '2026-07-12', p_caregiver_id: 'person', p_recorded_by: 'Caregiver',
      p_feed_bags: 2, p_bile_bags: 1, p_stool_count: -1, p_vomit_count: 1, p_urine_count: 3, p_flush_ml: 500, p_flush_count: 1, p_weight: 62,
    });
  });
  it('passes zero and negative corrections unchanged and omits unrelated parameters', () => {
    expect(readingArgs('household', '2026-07-12', { vomit_count: 0, stool_count: -1 }, 'person', 'Caregiver')).toEqual({
      p_household_id: 'household', p_date: '2026-07-12', p_caregiver_id: 'person', p_recorded_by: 'Caregiver', p_vomit_count: 0, p_stool_count: -1,
    });
  });
  it.each([{ bpSystolic: 120 }, { vomiting: true }, { feedBags: NaN }])('rejects fields that cannot be sent to log_reading', fields => {
    expect(() => readingArgs('household', '2026-07-12', fields, 'person', 'Caregiver')).toThrow('Invalid reading');
  });
});
