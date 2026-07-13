import { format, subDays } from 'date-fns';
import { parseScheduleTime } from '@/lib/medicineAlerts';
import type { Medicine, MedicineLog } from '@/hooks/useMedicines';

/** A medicine dose already administered, positioned in real time. */
export interface GivenItem {
  log: MedicineLog;
  medicine: Medicine | undefined;
  /** Best-known administration time (log date + logged hour). */
  at: Date;
}

/** A scheduled dose/task inside the upcoming window. */
export interface UpcomingItem {
  medicine: Medicine;
  /** Scheduled occurrence. */
  at: Date;
  /** Within the due window (lead 15 min … trail 2 h) and not yet logged. Only true for category "medicine". */
  due: boolean;
}

const GIVEN_WINDOW_MS = 12 * 60 * 60 * 1000;
const UPCOMING_WINDOW_MS = 12 * 60 * 60 * 1000;
/** How early a dose starts counting as "due" (matches medicineAlerts default). */
const DUE_LEAD_MS = 15 * 60 * 1000;
/** How long past its time a dose stays "due" before we drop it (matches medicineAlerts trail). */
const DUE_TRAIL_MS = 120 * 60 * 1000;

/** Convert a log's 12-hour clock fields to a Date on the log's day. */
export function logDateTime(log: { date: string; hour: number; am_pm: string }): Date {
  let hour24 = log.hour % 12;
  if (log.am_pm === 'PM') hour24 += 12;
  return new Date(`${log.date}T${String(hour24).padStart(2, '0')}:00:00`);
}

/**
 * Medicine logs administered within the last 12 hours, most recent first.
 * Callers pass today's and yesterday's logs so the window can span midnight.
 */
export function buildGivenList(
  logs: MedicineLog[],
  medicines: Medicine[],
  now: Date,
): GivenItem[] {
  const medById = new Map(medicines.map(m => [m.id, m]));
  const cutoff = now.getTime() - GIVEN_WINDOW_MS;

  return logs
    .map(log => ({
      log,
      medicine: log.medicine ?? medById.get(log.medicine_id),
      at: logDateTime(log),
    }))
    .filter(g => {
      const t = g.at.getTime();
      // Exclude future-dated entries (logged ahead by mistake) from "given".
      return t >= cutoff && t <= now.getTime() + 60 * 60 * 1000;
    })
    .sort((a, b) =>
      b.at.getTime() - a.at.getTime() ||
      (b.log.created_at ?? '').localeCompare(a.log.created_at ?? ''),
    );
}

/** True if any log for this medicine sits within ±1 hour of the slot (same fuzzy rule as medicineAlerts). */
function slotLogged(slotAt: Date, medLogs: { at: Date }[]): boolean {
  return medLogs.some(l => Math.abs(l.at.getTime() - slotAt.getTime()) <= 60 * 60 * 1000);
}

/**
 * Scheduled occurrences within (now - 2h … now + 12h), soonest first.
 *
 * Slots already administered (a log within ±1 h) are dropped. Past-due but
 * still-unlogged doses (up to 2 h back) are kept and flagged `due` so a missed
 * dose stays visible at the top instead of silently disappearing.
 * Non-medicine items (Feed/Flush schedules) are listed for awareness but are
 * never flagged due, since they're not logged through medicine_logs.
 */
export function buildUpcomingList(
  medicines: Medicine[],
  logs: MedicineLog[],
  now: Date,
): UpcomingItem[] {
  const nowMs = now.getTime();
  const windowStart = nowMs - DUE_TRAIL_MS;
  const windowEnd = nowMs + UPCOMING_WINDOW_MS;

  const logTimesByMed = new Map<string, { at: Date }[]>();
  logs.forEach(log => {
    const list = logTimesByMed.get(log.medicine_id) ?? [];
    list.push({ at: logDateTime(log) });
    logTimesByMed.set(log.medicine_id, list);
  });

  const items: UpcomingItem[] = [];

  for (const med of medicines) {
    const slots = parseScheduleTime(med.schedule_time || '');
    if (slots.length === 0) continue;

    const isMedicine = med.category === 'medicine' || !med.category;
    const medLogs = logTimesByMed.get(med.id) ?? [];

    for (const slot of slots) {
      // A slot recurs daily; consider yesterday, today and tomorrow so the
      // 12-hour window works across midnight in both directions.
      for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
        const day = new Date(now);
        day.setDate(day.getDate() + dayOffset);
        const at = new Date(
          `${format(day, 'yyyy-MM-dd')}T${String(slot.hour24).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}:00`,
        );
        const t = at.getTime();
        if (t < windowStart || t > windowEnd) continue;
        if (isMedicine && slotLogged(at, medLogs)) continue;

        const due = isMedicine && t <= nowMs + DUE_LEAD_MS && t >= windowStart;
        // Past, not-due-anymore occurrences of non-medicines are noise.
        if (!isMedicine && t < nowMs) continue;

        items.push({ medicine: med, at, due });
      }
    }
  }

  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** "8:00 PM" style label for a schedule/log time. */
export function timeLabel(at: Date): string {
  return format(at, 'h:mm a');
}

/** Yesterday's yyyy-MM-dd for a given now. */
export function previousDay(now: Date): string {
  return format(subDays(now, 1), 'yyyy-MM-dd');
}
