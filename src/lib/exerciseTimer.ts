import type { RoutineItem } from './routineSchedule';
export type ExerciseTimer = { user_id: string; household_id: string; elapsed_ms: number; running_since: number | null; state: 'running' | 'paused'; item: RoutineItem; for_date: string; for_minute: number; caregiver_id: string; recorded_by: string };
export const timerKey = (user: string, household: string) => `myht-exercise:${user}:${household}`;
export const elapsedMs = (timer: ExerciseTimer, now = Date.now()) => timer.elapsed_ms + (timer.state === 'running' && timer.running_since !== null ? Math.max(0, now - timer.running_since) : 0);
export function pauseTimer(timer: ExerciseTimer, now = Date.now()): ExerciseTimer { return { ...timer, elapsed_ms: elapsedMs(timer, now), running_since: null, state: 'paused' }; }
export function resumeTimer(timer: ExerciseTimer, now = Date.now()): ExerciseTimer { return timer.state === 'running' ? timer : { ...timer, running_since: now, state: 'running' }; }
export const timerMinutes = (timer: ExerciseTimer, now = Date.now()) => Math.round(elapsedMs(timer, now) / 6000) / 10;
export function recoverTimer(raw: string | null, user: string, household: string): ExerciseTimer | null {
  if (!raw) return null;
  const t = JSON.parse(raw) as ExerciseTimer;
  if (t.user_id !== user || t.household_id !== household || t.item?.household_id !== household || t.item?.kind !== 'exercise' || !t.item.id || !t.caregiver_id || !t.recorded_by || !/^\d{4}-\d{2}-\d{2}$/.test(t.for_date) || !Number.isInteger(t.for_minute) || t.for_minute < 0 || t.for_minute > 1439 || !Number.isFinite(t.elapsed_ms) || t.elapsed_ms < 0 || !['running','paused'].includes(t.state) || (t.state === 'running' ? !Number.isFinite(t.running_since) : t.running_since !== null)) throw new Error('Invalid saved exercise timer');
  return t;
}
export async function finishTimer(timer: ExerciseTimer, save: (minutes: number) => Promise<boolean>, now = Date.now()) {
  try { return await save(timerMinutes(timer, now)) ? null : timer; } catch { return timer; }
}
