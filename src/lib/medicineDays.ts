import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns';

export function medicineIntervalDays(frequency: string): number | null {
  const match = frequency.match(/^every ([2-7]) days$/);
  return match ? Number(match[1]) : null;
}

type Regimen = { frequency: string; start_date?: string | null };

function startDate(medicine: Regimen): Date | null {
  if (!medicine.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(medicine.start_date)) return null;
  const date = parseISO(medicine.start_date);
  return isValid(date) && format(date, 'yyyy-MM-dd') === medicine.start_date ? date : null;
}

export function isMedicineScheduledOnDate(medicine: Regimen, day: Date): boolean {
  if (!medicine.frequency || medicine.frequency === 'daily') return true;
  const interval = medicineIntervalDays(medicine.frequency);
  const start = startDate(medicine);
  if (!interval || !start) return false;
  const elapsed = differenceInCalendarDays(day, start);
  return elapsed >= 0 && elapsed % interval === 0;
}

/** Next calendar day with a future time; today's passed times do not become "next". */
export function nextMedicineDay(medicine: Regimen, times: number[], now = new Date()): Date | null {
  const interval = medicineIntervalDays(medicine.frequency);
  const start = startDate(medicine);
  if (!interval || !start) return null;
  const today = startOfDay(now);
  const elapsed = differenceInCalendarDays(today, start);
  let day = elapsed < 0 ? start : addDays(start, Math.ceil(elapsed / interval) * interval);
  if (differenceInCalendarDays(day, today) === 0 && times.length && !times.some(time => time >= now.getHours() * 60 + now.getMinutes())) day = addDays(day, interval);
  return day;
}
