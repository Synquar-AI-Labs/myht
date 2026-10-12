export type PrescriptionMedicine = {
  name: string; strength: string; amount: string;
  days: 'daily' | 'every_n_days' | 'as_needed' | 'unknown';
  every_days: number | null; times_per_day: number | null; every_hours: number | null;
  instructions: string; duration: string; unsure: string[]; source_text: string; photos: number[];
};
export type PrescriptionResult = { is_prescription: boolean; medicines: PrescriptionMedicine[] };
export class ReaderFailed extends Error {}
const FIELDS = ['name', 'strength', 'amount', 'days', 'times', 'instructions'];
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function validatePrescription(value: unknown, photoCount: number): PrescriptionResult {
  if (!object(value) || typeof value.is_prescription !== 'boolean' || !Array.isArray(value.medicines)) throw new ReaderFailed();
  if (!value.is_prescription) return { is_prescription: false, medicines: [] };
  const medicines: PrescriptionMedicine[] = [];
  for (const entry of value.medicines) {
    if (!object(entry) || !Array.isArray(entry.unsure) || !Array.isArray(entry.photos)) throw new ReaderFailed();
    const unsure = new Set(entry.unsure.filter((field): field is string => typeof field === 'string' && FIELDS.includes(field)));
    const text = (field: string, max: number, mark = field) => {
      if (typeof entry[field] !== 'string') throw new ReaderFailed();
      const raw = entry[field].trim();
      if (raw.length > max && FIELDS.includes(mark)) unsure.add(mark);
      return raw.slice(0, max);
    };
    const integer = (field: string, min: number, max: number, mark: string) => {
      const number = entry[field];
      if (number === null) return null;
      if (typeof number === 'number' && Number.isInteger(number) && number >= min && number <= max) return number;
      unsure.add(mark); return null;
    };
    const name = text('name', 120), strength = text('strength', 60), amount = text('amount', 60);
    const source_text = text('source_text', 300, 'instructions');
    if (!name && !source_text) continue;
    const days = ['daily', 'every_n_days', 'as_needed', 'unknown'].includes(String(entry.days)) ? entry.days as PrescriptionMedicine['days'] : 'unknown';
    if (days === 'unknown') unsure.add('days');
    let every_days = integer('every_days', 2, 7, 'days');
    if (days !== 'every_n_days') every_days = null;
    if (days === 'every_n_days' && every_days === null) unsure.add('days');
    const instructions = text('instructions', 300);
    const duration = text('duration', Math.max(0, 300 - instructions.length - (instructions ? 2 : 0)), 'instructions');
    const photos = [...new Set(entry.photos.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= photoCount))].sort((a, b) => a - b);
    medicines.push({ name, strength, amount, days, every_days,
      times_per_day: integer('times_per_day', 1, 24, 'times'), every_hours: integer('every_hours', 1, 12, 'times'),
      instructions, duration, source_text, unsure: [...unsure], photos: photos.length ? photos : Array.from({ length: photoCount }, (_, i) => i + 1),
    });
    if (medicines.length === 30) break;
  }
  return { is_prescription: medicines.length > 0, medicines };
}
