export const ADDITIVE_FIELDS = new Set([
  'feed_bags', 'bile_bags', 'stool_count', 'vomit_count', 'urine_count', 'flush_ml', 'flush_count',
]);

export function buildDayRecordWrite(existing: Record<string, unknown> | null, fields: Record<string, number | boolean | string>, recordedBy: string) {
  const write: Record<string, number | boolean | string> = { ...fields, recorded_by: recordedBy };
  for (const [key, value] of Object.entries(fields)) {
    if (ADDITIVE_FIELDS.has(key) && typeof value === 'number') {
      write[key] = Math.max(0, Number(existing?.[key] ?? 0) + value);
    }
  }
  if ('vomit_count' in fields) write.vomiting = Number(write.vomit_count) > 0;
  if ('stool_count' in fields) write.stool_passed = Number(write.stool_count) > 0;
  return write;
}

export const FORM_COLUMNS = {
  feedBags: 'feed_bags', flushCount: 'flush_count', weight: 'weight',
  bpSystolic: 'bp_systolic', bpDiastolic: 'bp_diastolic', foodTaken: 'food_taken',
  foodDescription: 'food_description', stoolPassed: 'stool_passed', stoolCount: 'stool_count',
  vomiting: 'vomiting', vomitCount: 'vomit_count', constipation: 'constipation',
  recordedBy: 'recorded_by', miscNotes: 'misc_notes',
} as const;

export function changedFormFields(form: Record<string, unknown>, baseline: Record<string, unknown>) {
  const result: Record<string, unknown> = { recorded_by: form.recordedBy };
  for (const [key, column] of Object.entries(FORM_COLUMNS)) {
    if (key !== 'recordedBy' && form[key] !== baseline[key]) result[column] = form[key];
  }
  return result;
}
