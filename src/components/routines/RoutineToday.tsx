import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useRoutineSection } from '@/hooks/useRoutineRecords';
import { useCaregiverChoice } from '@/hooks/useCaregiverChoice';
import { useExerciseTimer } from '@/hooks/ExerciseTimerProvider';
import { routineSection, MEAL_AMOUNTS, displayedMinutes } from '@/lib/routineToday';
import type { RoutineOccurrence } from '@/lib/routineSchedule';
import { doseTimeLabel } from '@/lib/doseTime';
import { Button } from '@/components/ui/button';
import { CaregiverPicker } from '@/components/CaregiverPicker';
import { RoutineRecordSheet } from './RoutineRecordSheet';

export function RoutineToday({ kind, now }: { kind: 'meal' | 'exercise'; now: Date }) {
  const date = format(now, 'yyyy-MM-dd');
  const data = useRoutineSection(kind, date);
  const choice = useCaregiverChoice();
  const timer = useExerciseTimer();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<RoutineOccurrence | null>(null);
  const title = kind === 'meal' ? 'Meals' : 'Exercise';
  if (data.loading) return <p data-routine-section={kind} role="status" className="text-sm text-[#8b8175]">Loading {title.toLowerCase()}…</p>;
  if (data.error) return <div data-routine-section={kind} role="alert" className="text-sm text-[#8b8175]">{title} could not load. <Button variant="ghost" onClick={data.retry}>Try again</Button></div>;
  const model = routineSection(data.items, data.logs, date, now);
  if (model.hidden) return null;
  return <section className="min-w-0 space-y-2" data-routine-section={kind}>
    <h2 className="[font-family:inherit] text-sm font-bold uppercase tracking-wider text-[#8b8175]">{title} · {model.done} of {model.planned} done</h2>
    <div className="rounded-2xl border border-[#e9e2d6] bg-white px-3">
      {model.done > 0 && <button className="min-h-11 w-full truncate py-3 text-left text-sm text-[#2e7d4f]" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{model.complete ? `All ${model.done} done` : model.folded} {expanded ? '▴' : '▾'}</button>}
      {expanded && model.doneRows.map(o => <button key={o.minute + o.item.id} className="min-h-11 w-full border-t border-[#f3ede2] py-3 text-left" onClick={() => setSelected(o)}><span className="block break-words font-semibold">{doseTimeLabel(o.minute)} · {o.log!.name}</span><span className="block break-words text-sm text-[#8b8175]">{kind === 'meal' ? MEAL_AMOUNTS[o.log!.amount as keyof typeof MEAL_AMOUNTS] : `${displayedMinutes(o.log!.minutes!)} min`} · {o.log!.recorded_by} · {format(new Date(o.log!.done_at), 'h:mm a')}</span></button>)}
      {model.pending.map(o => <div key={o.minute + o.item.id} className="flex items-center gap-2 border-t border-[#f3ede2] py-3 first:border-0"><span className="w-[68px] flex-none text-sm font-bold">{doseTimeLabel(o.minute)}</span><div className="min-w-0 flex-1"><p className="truncate" title={[o.item.name, o.notDoneYet ? 'not done yet' : '', kind === 'meal' ? [o.item.details,o.item.drink].filter(Boolean).join(' · ') : `${o.item.target_minutes} min`].filter(Boolean).join(' · ')}><span className="font-semibold">{o.item.name}</span><span className="text-sm text-[#8b8175]">{o.notDoneYet && ' · not done yet'} · {kind === 'meal' ? [o.item.details, o.item.drink].filter(Boolean).join(' · ') : `${o.item.target_minutes} min`}</span></p>{kind === 'exercise' && <button className="min-h-11 max-w-full text-left text-xs text-[#8a6240] underline" onClick={() => setSelected(o)}>Already done? Record minutes</button>}</div><Button variant="outline" onClick={() => {
        if (kind === 'meal') setSelected(o);
        else if (!choice.caregiver) toast.info("Choose who's logging first.");
        else timer.start({ item: o.item, for_date: date, for_minute: o.minute, caregiver_id: choice.caregiver.caregiver_id, recorded_by: choice.caregiver.display_name });
      }}>{kind === 'meal' ? 'Done' : 'Start'}</Button></div>)}
    </div>
    {kind === 'exercise' && model.pending.length > 0 && <div className="space-y-1"><p className="text-xs text-[#8b8175]">Done by</p><CaregiverPicker people={choice.activeCaregivers} value={choice.caregiver?.caregiver_id} onChange={choice.selectCaregiver} /></div>}
    {selected && <RoutineRecordSheet occurrence={selected} onClose={() => setSelected(null)} />}
  </section>;
}
export function RoutineTodaySections({ now }: { now: Date }) { return <div className="grid min-w-0 grid-cols-1 items-start gap-6 md:grid-cols-2" data-routine-sections><RoutineToday kind="meal" now={now} /><RoutineToday kind="exercise" now={now} /></div>; }
