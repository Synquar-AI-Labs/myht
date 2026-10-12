import { describe, it, expect } from 'vitest';
import { prescriptionDraft, samePrescriptionName, prescriptionMessage, photoSources } from '@/lib/prescriptionDraft';
import { photoDimensions } from '@/lib/preparePhoto';
import { hasPickedMedicineTimes, fillMedicineTimes } from '@/lib/medicineForm';
import type { PrescriptionMedicine } from '../../supabase/functions/read-prescription/validation';
const medicine: PrescriptionMedicine = { name: 'Synthetic tablet', strength: '5 mg', amount: '1 tablet', days: 'daily', every_days: null, times_per_day: 2, every_hours: null, instructions: 'after meals', duration: 'for 7 days', source_text: 'Synthetic tablet', unsure: ['strength'], photos: [1] };
describe('photo draft for the one medicine form', () => {
  it('uses plain once-a-day wording and always marks an unread name', () => {
    const draft = prescriptionDraft({ ...medicine, name: '', unsure: [], times_per_day: 1 }, '2026-10-12');
    expect(draft.frequencyNote).toBe('The prescription says: once a day. Pick the time.');
    expect(draft.marks).toContain('name');
  });
  it('maps copied fields, notes and empty times without classifying or scheduling', () => {
    const draft = prescriptionDraft(medicine, '2026-10-12');
    expect(draft.form).toMatchObject({ name: 'Synthetic tablet', potency: '5 mg', amount: '1 tablet', med_type: '', schedule_time: '', frequency: 'daily', schedule_note: 'after meals, for 7 days', source: 'prescription_photo' });
    expect(draft.times).toEqual([undefined, undefined]); expect(draft.marks).toContain('potency');
    expect(draft.frequencyNote).toBe('The prescription says: 2 times a day. Pick the 2 times.');
  });
  it('defaults unstated days and one empty time, marking the default', () => {
    const draft = prescriptionDraft({ ...medicine, days: 'unknown', times_per_day: null }, '2026-10-12');
    expect(draft.form.frequency).toBe('daily');expect(draft.marks).toContain('frequency');expect(draft.times).toEqual([undefined]);
  });
  it('maps every-N-days with a marked start day and PRN without time boxes', () => {
    const draft = prescriptionDraft({ ...medicine, days: 'every_n_days', every_days: 3 }, '2026-10-12');
    expect(draft.form.frequency).toBe('every 3 days'); expect(draft.form.start_date).toBe('2026-10-12');expect(draft.marks).toContain('start_date');
    expect(prescriptionDraft({ ...medicine, days: 'as_needed', every_hours: 8 }, '2026-10-12')).toMatchObject({ form: { frequency: 'as needed' }, times: [], helperHours: null });
  });
  it.each([1, 5, 8, 12])('opens the %s-hour helper with the same number of empty boxes it would fill', every_hours => {
    const draft = prescriptionDraft({ ...medicine, every_hours }, '2026-10-12');
    expect(draft.helperHours).toBe(every_hours);expect(draft.times).toHaveLength(fillMedicineTimes(every_hours, 480).length);expect(draft.times.every(time => time === undefined)).toBe(true);
  });
  it('asks replacement only for picked times, including midnight', () => {
    expect(hasPickedMedicineTimes([])).toBe(false);expect(hasPickedMedicineTimes([undefined, undefined])).toBe(false);
    expect(hasPickedMedicineTimes([undefined, 0])).toBe(true);
  });
  it('matches normalized whole names and whole-word prefixes, never blank or partial words', () => {
    expect(samePrescriptionName(' Synthetic tablet ', 'synthetic TABLET')).toBe(true);
    expect(samePrescriptionName('Synthetic', 'Synthetic 5mg')).toBe(true);
    expect(samePrescriptionName('Synthetic 5mg', 'Synthetic')).toBe(true);
    expect(samePrescriptionName('Syn', 'Synthetic')).toBe(false);expect(samePrescriptionName('', 'Synthetic')).toBe(false);
  });
  it('formats source numbers and human messages', () => {
    expect(photoSources([1, 2])).toBe('From photos 1 and 2');expect(photoSources([1, 2, 3])).toBe('From photos 1, 2 and 3');
    expect(prescriptionMessage('prescription_not_configured')).toBe('Reading photos is not set up on this server yet.');
    expect(prescriptionMessage('prescription_limit_reached')).toContain('Add the medicine by hand');
  });
  it('resizes the long edge without enlarging small photos', () => {
    expect(photoDimensions(4000, 3000)).toEqual({ width: 2048, height: 1536 });
    expect(photoDimensions(3000, 4000)).toEqual({ width: 1536, height: 2048 });
    expect(photoDimensions(100, 200)).toEqual({ width: 100, height: 200 });
    expect(() => photoDimensions(0, 200)).toThrow();
  });
});
