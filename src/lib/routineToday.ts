import { routineDay, type RoutineItem, type RoutineLog } from './routineSchedule';
import { format, parseISO } from 'date-fns';
export const MEAL_AMOUNTS = { all: 'All', most: 'Most', half: 'Half', little: 'A little', none: 'None' } as const;
export function routineSection(items: RoutineItem[], logs: RoutineLog[], date: string, now: Date) {
  const day = routineDay(items, logs, date);
  return { ...day, hidden: !day.planned, complete: !!day.planned && day.done === day.planned,
    doneRows: day.occurrences.filter(o => o.log),
    pending: day.occurrences.filter(o => !o.log).map(o => ({ ...o, notDoneYet: o.at < now })),
    folded: `${day.done} done · ${day.occurrences.filter(o => o.log).map(o => o.log!.name).join(', ')}` };
}
export function mealSummary(logs: RoutineLog[]) {
  const meals = logs.filter(l => l.kind === 'meal');
  return meals.length ? `Meals recorded: ${meals.length} · ${meals.map(l => `${l.name} ${MEAL_AMOUNTS[l.amount as keyof typeof MEAL_AMOUNTS]?.toLowerCase() ?? l.amount}`).join(', ')}` : null;
}
export function showDailyFood(foodTaken: boolean, logs: RoutineLog[]) { return foodTaken || !logs.some(l => l.kind === 'meal'); }
export const displayedMinutes = (minutes: number) => Math.max(1, Math.round(minutes));
const PLANNED_DETAIL_GRACE_MS = 5 * 60_000;
export function routinePlannedDetail(log: RoutineLog) {
  const planned = parseISO(log.for_date);
  planned.setHours(Math.floor(log.for_minute / 60), log.for_minute % 60, 0, 0);
  const done = new Date(log.done_at);
  if (format(done, 'yyyy-MM-dd') === log.for_date && Math.abs(done.getTime() - planned.getTime()) <= PLANNED_DETAIL_GRACE_MS) return '';
  return format(done, 'yyyy-MM-dd') === log.for_date ? `planned ${format(planned, 'h:mm a')}` : `for ${format(planned, 'MMM d, h:mm a')}`;
}
