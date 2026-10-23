import { routineDay, type RoutineItem, type RoutineLog } from './routineSchedule';
import { format, parseISO } from 'date-fns';
import { doseTimeLabel } from './doseTime';
export const MEAL_AMOUNTS = { all: 'All', most: 'Most', half: 'Half', little: 'A little', none: 'None' } as const;
export function routineUrgency(at: Date, now: Date): 'scheduled' | 'soon' | 'due' {
  const minutes = (now.getTime() - at.getTime()) / 60_000;
  if (minutes >= 0 && minutes <= 30) return 'due';
  if (minutes >= -15 && minutes < 0) return 'soon';
  return 'scheduled';
}
export function routineSection(items: RoutineItem[], logs: RoutineLog[], date: string, now: Date) {
  const day = routineDay(items, logs, date);
  const pending = day.occurrences.filter(o => !o.log).map(o => {
    const state = routineUrgency(o.at, now);
    return { ...o, state, notDoneYet: state === 'scheduled' && o.at < now };
  });
  const urgent = pending.find(o => o.state === 'due') ?? pending.find(o => o.state === 'soon');
  return { ...day, hidden: !day.planned, complete: !!day.planned && day.done === day.planned,
    doneRows: day.occurrences.filter(o => o.log),
    pending, urgent, state: urgent?.state ?? 'scheduled',
    folded: `${day.done} done · ${day.occurrences.filter(o => o.log).map(o => o.log!.name).join(', ')}` };
}
export function routineBarText(model: ReturnType<typeof routineSection>) {
  if (model.urgent) return `${model.state === 'soon' ? 'Next: ' : ''}${model.urgent.item.name} · ${doseTimeLabel(model.urgent.minute)}`;
  const passed = model.pending.find(o => o.notDoneYet);
  if (passed) return `${passed.item.name} · not done yet`;
  const next = model.pending[0];
  if (next) return `Next: ${next.item.name} · ${doseTimeLabel(next.minute)}`;
  return `All ${model.done} done`;
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
