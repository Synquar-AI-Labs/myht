import type { PrescriptionMedicine } from '../../supabase/functions/read-prescription/validation';
import type { MedicineScheduleInsert } from '@/hooks/useMedicineSchedule';
import { fillMedicineTimes } from '@/lib/medicineForm';

export function prescriptionDraft(medicine: PrescriptionMedicine, today: string) {
  const interval = medicine.days === 'every_n_days' && medicine.every_days;
  const frequency = medicine.days === 'as_needed' ? 'as needed' : interval ? `every ${interval} days` : 'daily';
  const marks = new Set(medicine.unsure.map(field => ({ strength: 'potency', days: 'frequency', instructions: 'schedule_note' }[field] ?? field)));
  if (!medicine.name.trim()) marks.add('name');
  if (medicine.days === 'unknown' || (medicine.days === 'every_n_days' && !interval)) marks.add('frequency');
  if (interval) marks.add('start_date');
  const count = medicine.every_hours ? fillMedicineTimes(medicine.every_hours, 480).length : medicine.times_per_day ?? 1;
  const form: MedicineScheduleInsert = {
    name: medicine.name, potency: medicine.strength, amount: medicine.amount,
    med_type: '', category: 'medicine', frequency, start_date: interval ? today : null,
    schedule_time: '', schedule_note: [medicine.instructions, medicine.duration].filter(Boolean).join(', '),
    show_in_quick_log: true, source: 'prescription_photo',
  };
  return { form, times: frequency === 'as needed' ? [] : Array.from({ length: count }, () => undefined as number | undefined),
    helperHours: frequency === 'as needed' ? null : medicine.every_hours, marks: [...marks],
    frequencyNote: medicine.times_per_day && !medicine.every_hours && frequency !== 'as needed' ? medicine.times_per_day === 1 ? 'The prescription says: once a day. Pick the time.' : `The prescription says: ${medicine.times_per_day} times a day. Pick the ${medicine.times_per_day} times.` : '',
  };
}
export function samePrescriptionName(a: string, b: string) {
  const first = a.trim().toLowerCase(), second = b.trim().toLowerCase();
  if (!first || !second) return false;
  const prefix = (short: string, long: string) => long.startsWith(short) && /^[^\p{L}\p{N}_]/u.test(long.slice(short.length));
  return first === second || prefix(first, second) || prefix(second, first);
}
export function prescriptionMessage(code?: string) {
  if (code === 'prescription_limit_reached') return "Today's limit for reading photos has been reached. Add the medicine by hand, or try again tomorrow.";
  if (code === 'prescription_not_configured') return 'Reading photos is not set up on this server yet.';
  if (code === 'unreadable') return 'I could not read this. Try again closer, with more light, and every word in view.';
  return 'Reading did not work this time. Try again, or take photos of fewer medicines at a time.';
}
export function photoSources(numbers: number[]) {
  return `From ${numbers.length === 1 ? 'photo' : 'photos'} ${numbers.length < 3 ? numbers.join(' and ') : `${numbers.slice(0, -1).join(', ')} and ${numbers.at(-1)}`}`;
}
