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

export type SlotState = 'scheduled' | 'due' | 'overdue';

/** A scheduled, not-yet-administered dose inside the upcoming window. */
export interface UpcomingItem {
  medicine: Medicine;
  /** Scheduled occurrence. */
  at: Date;
  /**
   * due      → now is within ±15 min of the slot (flashes)
   * overdue  → slot passed 15 min–2 h ago, still unlogged (static highlight)
   * scheduled→ later today/tonight
   */
  state: SlotState;
}

const GIVEN_WINDOW_MS = 12 * 60 * 60 * 1000;
const UPCOMING_WINDOW_MS = 12 * 60 * 60 * 1000;
/** Flash window around the scheduled time. */
const DUE_BEFORE_MS = 15 * 60 * 1000;
const DUE_AFTER_MS = 15 * 60 * 1000;
/** How long an unlogged dose stays visible as OVERDUE after its time. */
const OVERDUE_TRAIL_MS = 120 * 60 * 1000;
/** A log within this distance of a slot marks that slot as administered. */
const MATCH_TOLERANCE_MS = 60 * 60 * 1000;
/** Small clock-skew allowance for "given" timestamps. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/** Convert a log's 12-hour clock fields to a Date on the log's day. */
export function logDateTime(log: { date: string; hour: number; am_pm: string; minute?: number }): Date {
  let hour24 = log.hour % 12;
  if (log.am_pm === 'PM') hour24 += 12;
  return new Date(`${log.date}T${String(hour24).padStart(2, '0')}:${String(log.minute ?? 0).padStart(2, '0')}:00`);
}

/** "potency · amount" dose text (e.g. "1mg · 1.5 pills") — potency is medically meaningful. */
export function doseLabel(med: Pick<Medicine, 'potency' | 'amount'> | undefined): string {
  if (!med) return '';
  return [med.potency, med.amount].filter(Boolean).join(' · ');
}

/**
 * Medicine logs administered within the last 12 hours, most recent first.
 * Callers pass today's and yesterday's logs so the window can span midnight.
 * Future-dated entries are NOT "given" (only a small clock-skew tolerance).
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
      return t >= cutoff && t <= now.getTime() + CLOCK_SKEW_MS;
    })
    .sort((a, b) =>
      b.at.getTime() - a.at.getTime() ||
      (b.log.created_at ?? '').localeCompare(a.log.created_at ?? ''),
    );
}

/** Only medicines we can safely auto-schedule: real medicines, shown in quick log, explicitly daily. */
function isAutoScheduled(med: Medicine): boolean {
  const isMedicine = med.category === 'medicine' || !med.category;
  const isDaily = !med.frequency || med.frequency === 'daily';
  return isMedicine && isDaily && med.show_in_quick_log !== false;
}

/**
 * Scheduled occurrences within (now - 2h … now + 12h), soonest first.
 *
 * Rules (per adversarial review):
 * - Only explicitly daily medicines are auto-scheduled. PRN and every-N-day
 *   medicines never appear here — they are manual actions elsewhere.
 * - Logs match slots ONE-TO-ONE: each log satisfies at most one slot (the
 *   nearest unmatched slot within ±1 h). One administration can never clear
 *   two expected administrations.
 * - An unlogged slot flashes DUE only within ±15 min of its time, then stays
 *   visible as a static OVERDUE row for 2 h, then drops off.
 */
export function buildUpcomingList(
  medicines: Medicine[],
  logs: MedicineLog[],
  now: Date,
): UpcomingItem[] {
  const nowMs = now.getTime();
  const windowStart = nowMs - OVERDUE_TRAIL_MS;
  const windowEnd = nowMs + UPCOMING_WINDOW_MS;

  const logTimesByMed = new Map<string, number[]>();
  logs.forEach(log => {
    const list = logTimesByMed.get(log.medicine_id) ?? [];
    list.push(logDateTime(log).getTime());
    logTimesByMed.set(log.medicine_id, list);
  });

  const items: UpcomingItem[] = [];

  for (const med of medicines) {
    if (!isAutoScheduled(med)) continue;
    const slotDefs = parseScheduleTime(med.schedule_time || '');
    if (slotDefs.length === 0) continue;

    // Materialize every occurrence near the window (yesterday/today/tomorrow
    // so 12-hour windows work across midnight in both directions).
    const slotTimes: number[] = [];
    for (const slot of slotDefs) {
      for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
        const day = new Date(now);
        day.setDate(day.getDate() + dayOffset);
        const at = new Date(
          `${format(day, 'yyyy-MM-dd')}T${String(slot.hour24).padStart(2, '0')}:${String(slot.minute).padStart(2, '0')}:00`,
        );
        slotTimes.push(at.getTime());
      }
    }
    slotTimes.sort((a, b) => a - b);

    // One-to-one matching: walk slots chronologically, each consuming the
    // nearest still-unused log within tolerance.
    const medLogs = (logTimesByMed.get(med.id) ?? []).slice().sort((a, b) => a - b);
    const usedLogs = new Set<number>();

    for (const t of slotTimes) {
      let bestIdx = -1;
      let bestDist = MATCH_TOLERANCE_MS + 1;
      for (let i = 0; i < medLogs.length; i++) {
        if (usedLogs.has(i)) continue;
        const dist = Math.abs(medLogs[i] - t);
        if (dist <= MATCH_TOLERANCE_MS && dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0) {
        usedLogs.add(bestIdx);
        continue; // administered — drop the slot
      }

      if (t < windowStart || t > windowEnd) continue;

      let state: SlotState;
      if (t <= nowMs + DUE_BEFORE_MS && t >= nowMs - DUE_AFTER_MS) state = 'due';
      else if (t < nowMs) state = 'overdue';
      else state = 'scheduled';

      items.push({ medicine: med, at: new Date(t), state });
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
