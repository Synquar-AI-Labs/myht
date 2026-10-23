import { createContext, useContext, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useHousehold } from './HouseholdProvider';
import { useRoutineWrites } from './useRoutineRecords';
import { useCaregiverChoice } from './useCaregiverChoice';
import { useUpdateBusy } from './useUpdateBusy';
import { useNativeBack } from '@/native/back';
import { elapsedMs, finishTimer, pauseTimer, readStoredTimer, resumeTimer, timerKey, timerProgress, type ExerciseTimer } from '@/lib/exerciseTimer';
import { displayedMinutes } from '@/lib/routineToday';
import { EXERCISE_SAFETY } from '@/lib/exerciseGuide';
import { Button } from '@/components/ui/button';
import { CaregiverPicker } from '@/components/CaregiverPicker';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type StartTimer = Omit<ExerciseTimer, 'elapsed_ms' | 'running_since' | 'state' | 'user_id' | 'household_id'>;
const Context = createContext<{ start: (input: StartTimer) => void } | null>(null);
export const useExerciseTimer = () => useContext(Context)!;
export function ExerciseTimerProvider({ children }: { children: React.ReactNode }) {
  const { user, householdId } = useHousehold();
  const key = timerKey(user.id, householdId!);
  const choice = useCaregiverChoice();
  const clearedNotice = () => toast.info('The saved exercise timer could not load and was cleared. You can start a new one.');
  const [timer, setTimer] = useState<ExerciseTimer | null>(() => {
    try { return readStoredTimer(localStorage, user.id, householdId!, clearedNotice); }
    catch { toast.error('The saved exercise timer could not load.'); return null; }
  });
  const [open, setOpen] = useState(!!timer);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [changingPerson, setChangingPerson] = useState(false);
  const writes = useRoutineWrites();
  useUpdateBusy(!!timer || busy);
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== key) return;
      try { setTimer(readStoredTimer(localStorage, user.id, householdId!, clearedNotice)); }
      catch { toast.error('The saved exercise timer could not load.'); }
    };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, [key, user.id, householdId]);
  useNativeBack(() => { if (!open) return false; if (!busy) setOpen(false); return true; }, 20, true);
  const persist = (next: ExerciseTimer | null) => {
    try { if (next) localStorage.setItem(key, JSON.stringify(next)); else localStorage.removeItem(key); setTimer(next); return true; }
    catch { toast.error('Could not save the timer on this device. Please try again.'); return false; }
  };
  const seconds = timer ? Math.floor(elapsedMs(timer, now) / 1000) : 0;
  const progress = timer ? timerProgress(timer, now) : 0;
  return <Context.Provider value={{ start: input => {
    if (timer) { toast.info('An exercise timer is already open. Return to it first.'); setOpen(true); return; }
    try {
      const stored = readStoredTimer(localStorage, user.id, householdId!, clearedNotice);
      if (stored) { setTimer(stored); setOpen(true); toast.info('An exercise timer is already open. Return to it first.'); return; }
    } catch { toast.error('The saved exercise timer could not load.'); return; }
    const next: ExerciseTimer = { ...input, user_id: user.id, household_id: householdId!, elapsed_ms: 0, running_since: input.caregiver_id ? Date.now() : null, state: input.caregiver_id ? 'running' : 'paused' };
    if (persist(next)) { setNow(Date.now()); setChangingPerson(false); setOpen(true); }
  } }}>
    {children}
    {timer && !open && <button className="fixed bottom-24 left-1/2 z-40 min-h-11 max-w-[90vw] -translate-x-1/2 rounded-full border bg-[#faf7f2] px-4 py-2 shadow-lg" onClick={() => setOpen(true)}>Return to exercise · {timer.item.name}</button>}
    <Dialog open={open && !!timer} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="inset-0 left-0 top-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none border-0 bg-[#faf7f2] p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] [&>button.absolute]:hidden" onEscapeKeyDown={e => { if (busy) e.preventDefault(); }}>
        {timer && <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3" data-exercise-timer>
          <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Back to Today</Button>
          <p className="text-sm text-[#8b8175]">{timer.item.area} · {format(new Date(`${timer.for_date}T00:00:00`), 'MMM d')}</p>
          <DialogTitle className="text-center text-3xl">{timer.item.name}</DialogTitle>
          <div className="relative flex h-40 w-40 flex-none flex-col items-center justify-center rounded-full bg-white sm:h-56 sm:w-56" role="progressbar" aria-label="Exercise target progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#d9e7dc" strokeWidth="5" /><circle data-progress-arc cx="50" cy="50" r="46" fill="none" stroke="#2e7d4f" strokeWidth="5" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 * (1 - progress)} /></svg>
            <output className="text-4xl font-semibold tabular-nums sm:text-5xl" aria-label="Elapsed time">{Math.floor(seconds / 60).toString().padStart(2, '0')}:{(seconds % 60).toString().padStart(2, '0')}</output><p className="mt-2 text-sm text-[#8b8175]">{progress >= 1 ? 'Target reached' : `Target ${timer.item.target_minutes} min`}</p><p role="status" className="mt-1 text-sm">{!timer.caregiver_id ? 'Choose who is doing it first' : timer.state === 'paused' ? 'Paused' : 'Running'}</p>
          </div>
          {timer.caregiver_id && !changingPerson ? <div className="flex items-center gap-1 text-sm text-[#8b8175]">Done by {timer.recorded_by} · <Button variant="ghost" className="px-1 text-[#8a6240]" disabled={busy} onClick={() => setChangingPerson(true)}>Change</Button></div> : <div className="w-full space-y-1"><p className="text-sm font-semibold">Done by</p><CaregiverPicker people={choice.activeCaregivers} value={timer.caregiver_id || undefined} onChange={id => {
            const person = choice.activeCaregivers.find(p => p.caregiver_id === id);
            if (!person || busy) return;
            const next = { ...timer, caregiver_id: id, recorded_by: person.display_name, ...(!timer.caregiver_id ? { state: 'running' as const, running_since: Date.now() } : {}) };
            if (persist(next)) { choice.selectCaregiver(id); setChangingPerson(false); }
          }} /></div>}
          {timer.item.details && <p className="w-full whitespace-pre-wrap break-words rounded-2xl border bg-white p-4">{timer.item.details}</p>}
          <div className="flex w-full gap-3"><Button variant="outline" className="flex-1" disabled={busy || !timer.caregiver_id} onClick={() => persist(timer.state === 'running' ? pauseTimer(timer) : resumeTimer(timer))}>{timer.state === 'running' ? 'Pause' : 'Resume'}</Button><Button className="flex-1" disabled={busy || !timer.caregiver_id} onClick={async () => {
            const finishing = pauseTimer(timer);
            if (!persist(finishing)) return;
            setBusy(true);
            try {
              const next = await finishTimer(finishing, async minutes => {
                const result = await writes.save({ item_id: timer.item.id, for_date: timer.for_date, for_minute: timer.for_minute, caregiver_id: timer.caregiver_id, recorded_by: timer.recorded_by, kind: 'exercise', name: timer.item.name, details: timer.item.details, drink: '', target_minutes: timer.item.target_minutes, minutes, amount: null, done_at: new Date().toISOString() });
                if (result.state === 'existing') toast.info(`Already done by ${result.log.recorded_by}. The existing record was kept.`);
                if (result.state === 'saved') toast.success(`Exercise recorded · ${displayedMinutes(minutes)} min`);
                return result.state !== 'failed';
              });
              if (!next && persist(null)) setOpen(false);
            } finally { setBusy(false); }
          }}>Finish</Button></div>
          <ConfirmDeleteButton variant="ghost" disabled={busy} title="Cancel this exercise?" description="The timer will be cleared without saving a record." confirmLabel="Cancel without saving" onConfirm={() => { if (persist(null)) setOpen(false); }}>Cancel without saving</ConfirmDeleteButton>
          <p className="text-sm text-[#8b8175]">{EXERCISE_SAFETY}</p>
        </div>}
      </DialogContent>
    </Dialog>
  </Context.Provider>;
}
