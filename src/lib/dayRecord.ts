import type { HealthRecordForm } from '@/types/health';
import type { HouseholdPerson } from '@/hooks/HouseholdProvider';
import { attributionForEdit, changedCaregiverId } from '@/lib/caregiverChoice';

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

export function changedDayFields(form: HealthRecordForm, baseline: HealthRecordForm, people: HouseholdPerson[]) {
  const { recorded_by: _name, ...fields } = changedFormFields(form as unknown as Record<string, unknown>, baseline as unknown as Record<string, unknown>);
  return { ...fields, ...attributionForEdit(people, changedCaregiverId(form.caregiverId, baseline.caregiverId), baseline.caregiverId ?? null) };
}
