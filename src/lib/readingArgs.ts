import type { Database } from '@/integrations/supabase/types';

const READING_ARGS = {
  feedBags: 'p_feed_bags', feed_bags: 'p_feed_bags',
  bileBags: 'p_bile_bags', bile_bags: 'p_bile_bags',
  stoolCount: 'p_stool_count', stool_count: 'p_stool_count',
  vomitCount: 'p_vomit_count', vomit_count: 'p_vomit_count',
  urineCount: 'p_urine_count', urine_count: 'p_urine_count',
  flushMl: 'p_flush_ml', flush_ml: 'p_flush_ml',
  flushCount: 'p_flush_count', flush_count: 'p_flush_count',
  weight: 'p_weight',
} as const;

export function readingArgs(householdId: string, date: string, fields: Record<string, number | boolean | string>, caregiverId: string, recordedBy: string): Database['public']['Functions']['log_reading']['Args'] {
  const args: Database['public']['Functions']['log_reading']['Args'] = {
    p_household_id: householdId, p_date: date,
    p_caregiver_id: caregiverId, p_recorded_by: recordedBy,
  };
  for (const [key, value] of Object.entries(fields)) {
    const parameter = READING_ARGS[key as keyof typeof READING_ARGS];
    if (!parameter || typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Invalid reading');
    args[parameter] = value;
  }
  return args;
}
