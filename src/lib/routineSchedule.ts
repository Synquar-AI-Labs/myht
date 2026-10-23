import { addDays, format, parseISO } from 'date-fns';
import { parseScheduleTime } from '@/lib/medicineAlerts';
import { canonicalSchedule } from '@/lib/medicineForm';
import type { Tables } from '@/integrations/supabase/types';

export type RoutineItem = Tables<'routine_items'>;
export type RoutineLog = Tables<'routine_logs'>;
export type RoutineOccurrence = { item: RoutineItem; date: string; minute: number; at: Date; log?: RoutineLog };

export function scheduleForDate(item: RoutineItem, date: string): string {
  return item.schedule_from && date < item.schedule_from ? item.previous_schedule_time ?? item.schedule_time : item.schedule_time;
}
export function routineMinutes(raw: string): number[] {
  return [...new Set(parseScheduleTime(raw).map(t => t.hour24 * 60 + t.minute))].sort((a, b) => a - b);
}
/** Stop is exclusive: "Stop from Friday" means nothing planned on Friday. */
export function routineDay(items: RoutineItem[], logs: RoutineLog[], date: string) {
  const occurrences: RoutineOccurrence[] = [];
  for (const item of items) {
    if (date < item.start_date || (item.end_date && date >= item.end_date)) continue;
    for (const minute of routineMinutes(scheduleForDate(item, date))) {
      const at = parseISO(date);
      at.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      if (at.getTime() < Date.parse(item.created_at)) continue;
      const log = logs.find(l => l.item_id === item.id && l.for_date === date && l.for_minute === minute);
      occurrences.push({ item, date, minute, at, log });
    }
  }
  occurrences.sort((a, b) => a.minute - b.minute || a.item.id.localeCompare(b.item.id));
  return { occurrences, planned: occurrences.length, done: occurrences.filter(o => o.log).length };
}
/** Preserve today's effective times even after multiple edits today. */
export function routineTimeChange(item: RoutineItem, times: number[], now = new Date()) {
  const next = canonicalSchedule(times);
  if (next === canonicalSchedule(routineMinutes(item.schedule_time))) return {};
  const today = format(now, 'yyyy-MM-dd');
  return { schedule_time: next, previous_schedule_time: scheduleForDate(item, today), schedule_from: format(addDays(now, 1), 'yyyy-MM-dd') };
}

export const TYPICAL_MEALS = [
  { name: 'Breakfast', schedule_time: '8:00 AM', details: 'Oatmeal with fruit', drink: 'Tea or water' },
  { name: 'Morning snack', schedule_time: '10:30 AM', details: 'Yogurt or apple slices', drink: '' },
  { name: 'Lunch', schedule_time: '1:00 PM', details: 'Grilled chicken salad', drink: '' },
  { name: 'Afternoon snack', schedule_time: '3:30 PM', details: 'Whole grain crackers', drink: '' },
  { name: 'Dinner', schedule_time: '6:00 PM', details: 'Baked fish and vegetables', drink: '' },
  { name: 'Evening snack', schedule_time: '8:30 PM', details: 'Warm milk or herbal tea', drink: '' },
] as const;
