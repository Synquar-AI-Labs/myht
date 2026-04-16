/**
 * Medicine time-alert utilities.
 *
 * Parses `schedule_time` strings like "10:00 AM", "10:00 AM / 9:00 PM"
 * and determines which medicines are currently "due" within a configurable
 * time window (default ±30 min).
 */

export interface ScheduleSlot {
  hour24: number; // 0-23
  minute: number; // 0-59
}

/**
 * Parse a schedule_time value into an array of 24-hour time slots.
 *
 * Supported formats:
 *   "10:00 AM"          → [{ hour24: 10, minute: 0 }]
 *   "10:00 AM / 9:00 PM" → [{ hour24: 10, minute: 0 }, { hour24: 21, minute: 0 }]
 *   "10AM"              → [{ hour24: 10, minute: 0 }]
 *   "10AM/9PM"          → [{ hour24: 10, minute: 0 }, { hour24: 21, minute: 0 }]
 *   "Continuous", "", unparseable → []
 */
export function parseScheduleTime(raw: string): ScheduleSlot[] {
  if (!raw || /continuous/i.test(raw) || /as needed/i.test(raw) || /prn/i.test(raw)) {
    return [];
  }

  const parts = raw.split(/[\/,]/).map(s => s.trim()).filter(Boolean);
  const slots: ScheduleSlot[] = [];

  for (const part of parts) {
    const slot = parseSingleTime(part);
    if (slot) slots.push(slot);
  }

  return slots;
}

function parseSingleTime(str: string): ScheduleSlot | null {
  // Match patterns like "10:00 AM", "10:00AM", "10 AM", "10AM", "9:30 PM"
  const match = str.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  const ampm = match[3].toUpperCase();

  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour24: hour, minute };
}

/**
 * Check if `now` is within the alert window: starts `leadMinutes` before
 * the scheduled time and ends `trailMinutes` after (default 120 min / 2 hours).
 */
function isInAlertWindow(slot: ScheduleSlot, nowHour: number, nowMinute: number, leadMinutes: number, trailMinutes = 120): boolean {
  const slotMin = slot.hour24 * 60 + slot.minute;
  const nowMin = nowHour * 60 + nowMinute;
  const alertStart = (slotMin - leadMinutes + 1440) % 1440;
  const alertEnd = (slotMin + trailMinutes) % 1440;

  // Check if nowMin is within [alertStart, alertEnd] with midnight wrap
  if (alertStart <= alertEnd) {
    return nowMin >= alertStart && nowMin <= alertEnd;
  }
  // Wraps midnight
  return nowMin >= alertStart || nowMin <= alertEnd;
}

/**
 * Given a medicine's schedule_time and the list of today's logs for that medicine,
 * determine if any schedule slot is currently "due" (within the window and not yet logged).
 */
export function isMedicineDue(
  scheduleTime: string,
  todayLogs: { hour: number; am_pm: string }[],
  now: Date = new Date(),
  leadMinutes = 15,
): boolean {
  const slots = parseScheduleTime(scheduleTime);
  if (slots.length === 0) return false;

  const nowHour = now.getHours();
  const nowMinute = now.getMinutes();

  return slots.some(slot => {
    if (!isInAlertWindow(slot, nowHour, nowMinute, leadMinutes)) return false;

    // Check if already logged for this slot
    const slotAmPm = slot.hour24 >= 12 ? 'PM' : 'AM';
    const slotHour12 = slot.hour24 === 0 ? 12 : slot.hour24 > 12 ? slot.hour24 - 12 : slot.hour24;

    const logged = todayLogs.some(log => {
      // Fuzzy match: same AM/PM and hour within ±1 hour
      if (log.am_pm !== slotAmPm) return false;
      return Math.abs(log.hour - slotHour12) <= 1;
    });

    return !logged;
  });
}

/**
 * Returns a Set of medicine IDs that are currently due.
 */
export function getDueMedicineIds(
  medicines: { id: string; schedule_time?: string }[],
  logs: { medicine_id: string; hour: number; am_pm: string }[],
  dismissedIds: Set<string> = new Set(),
  now: Date = new Date(),
  leadMinutes = 15,
): Set<string> {
  const dueIds = new Set<string>();

  for (const med of medicines) {
    if (!med.schedule_time || dismissedIds.has(med.id)) continue;
    const medLogs = logs.filter(l => l.medicine_id === med.id);
    if (isMedicineDue(med.schedule_time, medLogs, now, leadMinutes)) {
      dueIds.add(med.id);
    }
  }

  return dueIds;
}
