import { parseScheduleTime } from '@/lib/medicineAlerts';
import { doseTimeLabel } from '@/lib/doseTime';
import { format, parseISO } from 'date-fns';
import { medicineIntervalDays, nextMedicineDay } from '@/lib/medicineDays';

export const MAX_MEDICINE_TIMES = 24;
export const hasPickedMedicineTimes = (times: (number | undefined)[]) => times.some(time => time !== undefined);
export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Every day',
  ...Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`every ${i + 2} days`, `Every ${i + 2} days`])),
  'as needed': 'Only when needed',
};

export function canonicalSchedule(times: number[]): string {
  return [...new Set(times)].sort((a, b) => a - b).map(doseTimeLabel).join(' / ');
}

export function readStoredSchedule(raw: string) {
  const slots = parseScheduleTime(raw);
  const times = [...new Set(slots.map(slot => slot.hour24 * 60 + slot.minute))].sort((a, b) => a - b);
  // Keep the complete original if any fragment is not solely a readable time.
  // The runtime parser intentionally accepts a time embedded in other text.
  const parts = raw.split(/[/,]/).map(part => part.trim()).filter(Boolean);
  const unread = !!raw.trim() && (slots.length !== parts.length || parts.some(part => !/^\d{1,2}(?::\d{2})?\s*(AM|PM)$/i.test(part)));
  return { times, earlier: unread ? raw : '' };
}

export function preserveEarlierNote(note: string, earlier: string): string {
  if (!earlier || note.includes(earlier)) return note;
  return [note, `Earlier entry: ${earlier}`].filter(Boolean).join('\n');
}

export function fillMedicineTimes(hours: number, start: number): number[] {
  if (!Number.isInteger(hours) || hours < 1 || hours > 12 || !Number.isInteger(start) || start < 0 || start >= 1440) throw new Error('Invalid interval');
  const times: number[] = [];
  if (24 % hours === 0) {
    for (let i = 0; i < 24 / hours; i++) times.push((start + i * hours * 60) % 1440);
  } else {
    for (let time = start; time < 1440; time += hours * 60) times.push(time);
  }
  return [...new Set(times)].sort((a, b) => a - b);
}

export function medicineReadBack(frequency: string, times: number[], start_date?: string | null, now = new Date()): string {
  if (frequency === 'as needed') return 'Given only when needed.';
  const labels = canonicalSchedule(times).split(' / ').filter(Boolean);
  const at = labels.length ? ` at ${labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`}` : '';
  const days = frequency === 'daily' || !frequency ? 'every day' : frequency;
  let sentence = `Given ${days}${at}.`;
  if ((frequency === 'daily' || !frequency) && !labels.length) sentence += ' No times set, so it will not appear under Coming up.';
  if (medicineIntervalDays(frequency)) {
    const next = nextMedicineDay({ frequency, start_date }, times, now);
    if (!next) sentence += ' Pick a start day to see this under Coming up.';
    else {
      sentence = `Given ${days}${at}, starting ${format(parseISO(start_date!), 'EEEE, MMMM d')}. Next: ${format(next, 'EEEE, MMMM d')}.`;
      if (!labels.length) sentence += ' No times set, so it will not appear under Coming up.';
    }
  }
  return sentence;
}
