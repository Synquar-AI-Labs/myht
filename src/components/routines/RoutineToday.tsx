import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useRoutineSection } from '@/hooks/useRoutineRecords';
import { useCaregiverChoice } from '@/hooks/useCaregiverChoice';
import { useTodayBarGroup } from '@/hooks/useTodayBars';
import { useExerciseTimer } from '@/hooks/ExerciseTimerProvider';
import { routineSection, routineBarText, MEAL_AMOUNTS, displayedMinutes } from '@/lib/routineToday';
import type { RoutineOccurrence } from '@/lib/routineSchedule';
import { doseTimeLabel } from '@/lib/doseTime';
import { urgencyFor, urgencyStyle } from '@/lib/medicineUrgency';
import { UrgencyBadge } from '@/components/today/UrgencyBadge';
import { Button } from '@/components/ui/button';
import { RoutineRecordSheet } from './RoutineRecordSheet';

export function RoutineToday({ kind, now }: { kind: 'meal' | 'exercise'; now: Date }) {
  const date = format(now, 'yyyy-MM-dd');
  const data = useRoutineSection(kind, date);
  const choice = useCaregiverChoice();
  const timer = useExerciseTimer();
  const [selected, setSelected] = useState<RoutineOccurrence | null>(null);
  const title = kind === 'meal' ? 'Meals' : 'Exercise';
  const model = routineSection(data.items, data.logs, date, now);
  const bars = useTodayBarGroup(`routine:${kind}`, !data.loading && !data.error && !model.hidden ? ['section', ...(model.done ? ['done'] : [])] : []);
  const open = bars.isOpen('section');
  const expanded = bars.isOpen('done');
  const urgency = urgencyFor(model.state);
  if (data.loading) return <p data-routine-section={kind} role="status" className="text-sm text-[#8b8175]">Loading {title.toLowerCase()}…</p>;
  if (data.error) return <div data-routine-section={kind} role="alert" className="text-sm text-[#8b8175]">{title} could not load. <Button variant="ghost" onClick={data.retry}>Try again</Button></div>;
  if (model.hidden) return null;
  return <section className="min-w-0 space-y-2" data-routine-section={kind}>
    <h2 className="[font-family:inherit] text-sm font-bold uppercase tracking-wider text-[#8b8175]">{title} · {model.done} of {model.planned} done</h2>
    <div className="rounded-2xl border border-[#e9e2d6] bg-white px-3">
      <button data-routine-bar style={urgencyStyle(model.state)} className={`my-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-1 py-3 text-left text-sm text-[#8b8175] ${urgency?.motion ?? ''}`} aria-expanded={open} onClick={() => bars.toggle('section')}><span className="min-w-0 flex-1 break-words">{routineBarText(model)}</span><UrgencyBadge state={model.state} /><ChevronDown aria-hidden="true" className={`h-4 w-4 flex-none transition-transform ${open ? 'rotate-180' : ''}`} /></button>
      {open && <div data-routine-content>
      {model.done > 0 && <button data-routine-done-bar className="min-h-11 w-full truncate py-3 text-left text-sm text-[#2e7d4f]" aria-expanded={expanded} onClick={() => bars.toggle('done')}>{model.complete ? `All ${model.done} done` : model.folded} {expanded ? '▴' : '▾'}</button>}
      {expanded && model.doneRows.map(o => <button key={o.minute + o.item.id} className="min-h-11 w-full border-t border-[#f3ede2] py-3 text-left" onClick={() => setSelected(o)}><span className="block break-words font-semibold">{doseTimeLabel(o.minute)} · {o.log!.name}</span><span className="block break-words text-sm text-[#8b8175]">{kind === 'meal' ? MEAL_AMOUNTS[o.log!.amount as keyof typeof MEAL_AMOUNTS] : `${displayedMinutes(o.log!.minutes!)} min`} · {o.log!.recorded_by} · {format(new Date(o.log!.done_at), 'h:mm a')}</span></button>)}
      {model.pending.map(o => <div key={o.minute + o.item.id} data-routine-pending style={urgencyStyle(o.state)} className={`my-1 flex items-center gap-2 rounded-xl border-t border-[#f3ede2] px-1 py-3 first:border-0 ${urgencyFor(o.state)?.motion ?? ''}`}><span className="w-[68px] flex-none text-sm font-bold">{doseTimeLabel(o.minute)}</span><div className="min-w-0 flex-1"><p className="truncate" title={[o.item.name, o.notDoneYet ? 'not done yet' : '', kind === 'meal' ? [o.item.details,o.item.drink].filter(Boolean).join(' · ') : `${o.item.target_minutes} min`].filter(Boolean).join(' · ')}><span className="font-semibold">{o.item.name}</span><span className="text-sm text-[#8b8175]">{o.notDoneYet && ' · not done yet'} · {kind === 'meal' ? [o.item.details, o.item.drink].filter(Boolean).join(' · ') : `${o.item.target_minutes} min`}</span></p><UrgencyBadge state={o.state} />{kind === 'exercise' && <button className="min-h-11 max-w-full text-left text-xs text-[#8a6240] underline" onClick={() => setSelected(o)}>Already done? Record minutes</button>}</div><Button variant="outline" onClick={() => {
        if (kind === 'meal') setSelected(o);
        else timer.start({ item: o.item, for_date: date, for_minute: o.minute, caregiver_id: choice.caregiver?.caregiver_id ?? '', recorded_by: choice.caregiver?.display_name ?? '' });
      }}>{kind === 'meal' ? 'Done' : 'Start'}</Button></div>)}
      </div>}
    </div>
    {selected && <RoutineRecordSheet occurrence={selected} onClose={() => setSelected(null)} />}
  </section>;
}
export function RoutineTodaySections({ now, stacked = false }: { now: Date; stacked?: boolean }) { return <div className={`grid min-w-0 grid-cols-1 items-start ${stacked ? 'gap-8' : 'gap-6 md:grid-cols-2'}`} data-routine-sections><RoutineToday kind="meal" now={now} /><RoutineToday kind="exercise" now={now} /></div>; }
