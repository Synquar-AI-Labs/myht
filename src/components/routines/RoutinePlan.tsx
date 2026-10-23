import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChevronRight, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useRoutines, type RoutineDraft } from '@/hooks/useRoutines';
import { useCareProfile } from '@/hooks/useCareProfile';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import { useNativeBack } from '@/native/back';
import { routineMinutes, scheduleForDate, type RoutineItem } from '@/lib/routineSchedule';
import { EXERCISE_GUIDE, EXERCISE_SAFETY } from '@/lib/exerciseGuide';
import { doseTimeLabel } from '@/lib/doseTime';
import { DoseTimePicker } from '@/components/DoseTimePicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { ProfileLoad } from '@/components/profile/ProfileParts';

const blank = (kind: 'meal' | 'exercise'): RoutineDraft => ({ kind, name: '', details: '', drink: '', target_minutes: kind === 'exercise' ? 10 : null, area: '', move_type: '', times: [], start_date: format(new Date(), 'yyyy-MM-dd') });
export function RoutinePlan({ kind, onAbout, onEditingChange }: { kind: 'meal' | 'exercise'; onAbout: () => void; onEditingChange?: (editing: boolean) => void }) {
  const data = useRoutines();
  const care = useCareProfile();
  const [editing, setEditing] = useState<RoutineItem | null | undefined>();
  const [draft, setDraft] = useState<RoutineDraft>(() => blank('meal'));
  const [busy, setBusy] = useState(false);
  const [stopDate, setStopDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [stopping, setStopping] = useState(false);
  const [templateIds, setTemplateIds] = useState<string[]>([]);
  useEffect(() => { onEditingChange?.(editing !== undefined); return () => onEditingChange?.(false); }, [editing, onEditingChange]);
  useUpdateBusy(busy || editing !== undefined);
  useNativeBack(useCallback(() => {
    if (busy || editing !== undefined) { toast.info('Save or cancel your changes first.'); return true; }
    return false;
  }, [busy, editing]), 10, true);
  const open = (kind: 'meal' | 'exercise', item?: RoutineItem) => {
    setDraft(item ? { kind, name: item.name, details: item.details, drink: item.drink, target_minutes: item.target_minutes, area: item.area, move_type: item.move_type, start_date: item.start_date, times: routineMinutes(item.schedule_time) } : blank(kind));
    setEditing(item ?? null); setStopping(false); setStopDate(format(new Date(), 'yyyy-MM-dd'));
  };
  const run = async (action: () => Promise<{ ok: boolean }>, close = false) => {
    setBusy(true); try { const result = await action(); if (result.ok && close) setEditing(undefined); return result.ok; } finally { setBusy(false); }
  };
  if (data.loading || data.error) return <ProfileLoad error={data.error} retry={data.retry} />;
  if (editing !== undefined) {
    const exercise = draft.kind === 'exercise';
    const selectedArea = EXERCISE_GUIDE.find(a => a.name === draft.area);
    const timesChanged = editing && routineMinutes(editing.schedule_time).join(',') !== [...draft.times].sort((a, b) => a - b).join(',');
    return <div className="space-y-5 text-[#26201a]" data-routine-form>
      <Button variant="ghost" className="justify-start px-0" disabled={busy} onClick={() => setEditing(undefined)}>Cancel</Button>
      <h1 className="text-[30px] font-normal">{editing ? 'Edit' : 'Add'} {exercise ? 'exercise' : 'meal'}</h1>
      <form className="space-y-5" onSubmit={async e => { e.preventDefault(); if (await run(() => data.save(draft, editing?.id), true)) toast.success('Plan saved'); }}>
        <fieldset className="min-w-0 space-y-5" disabled={busy}>
          {exercise && <section className="space-y-3"><h2 className="[font-family:inherit] text-lg font-bold">1. Which area?</h2><div className="flex flex-wrap gap-2">{EXERCISE_GUIDE.map(area => <Button type="button" key={area.name} variant="outline" aria-pressed={draft.area === area.name} className={`rounded-full ${draft.area === area.name ? 'border-2 border-[#8a6240] bg-[#f3ede2]' : ''}`} onClick={() => setDraft(p => ({ ...p, area: area.name, name: '', move_type: '' }))}>{area.name}</Button>)}</div></section>}
          <section className="space-y-3">
            <h2 className="[font-family:inherit] text-lg font-bold">{exercise ? '2. Which move?' : 'What is the meal?'}</h2>
            {exercise && selectedArea?.groups.map(group => <div className="space-y-2" key={group.name}><h3 className="[font-family:inherit] text-xs font-bold uppercase text-[#8b8175]">{group.name}</h3><div className="flex flex-wrap gap-2">{group.moves.map(move => <Button type="button" key={move} variant="outline" aria-pressed={draft.name === move && draft.move_type === group.name} className={`max-w-full rounded-full ${draft.name === move && draft.move_type === group.name ? 'border-2 border-[#8a6240] bg-[#f3ede2]' : ''}`} onClick={() => setDraft(p => ({ ...p, name: move, move_type: group.name }))}>{move}</Button>)}</div></div>)}
            <div className="space-y-1"><Label htmlFor="routine-name">{exercise ? 'Or type your own' : 'Meal name'}</Label><Input id="routine-name" maxLength={80} required value={draft.name} onChange={e => setDraft(p => ({ ...p, name: e.target.value, ...(exercise ? { move_type: '' } : {}) }))} /></div>
          </section>
          <section className="space-y-3"><h2 className="[font-family:inherit] text-lg font-bold">{exercise ? '3. When and how long?' : 'At what times?'}</h2><p className="text-sm text-[#8b8175]">Every day at</p>
            {draft.times.map((time, i) => <div className="flex gap-2" key={i}><div className="min-w-0 flex-1"><DoseTimePicker label={`Plan time ${i + 1}`} value={time} excluded={draft.times.filter((_, n) => n !== i)} onChange={value => setDraft(p => ({ ...p, times: p.times.map((old, n) => i === n ? value : old) }))} /></div><Button type="button" variant="ghost" aria-label={`Remove time ${i + 1}`} onClick={() => setDraft(p => ({ ...p, times: p.times.filter((_, n) => n !== i) }))}>Remove</Button></div>)}
            <Button type="button" variant="outline" disabled={draft.times.length >= 24} onClick={() => setDraft(p => ({ ...p, times: [...p.times, Array.from({ length: 96 }, (_, i) => i * 15).find(t => !p.times.includes(t) && t >= 480) ?? Array.from({ length: 96 }, (_, i) => i * 15).find(t => !p.times.includes(t))!] }))}>+ Add a time</Button>
            {(timesChanged || (editing?.schedule_from && editing.schedule_from > format(new Date(), 'yyyy-MM-dd'))) && <p className="text-sm text-[#8a6240]">New times start tomorrow</p>}
            {exercise && <div className="flex flex-wrap items-center justify-between gap-3"><Label>Minutes</Label><div className="flex items-center gap-3"><Button type="button" variant="outline" size="icon" aria-label="Fewer minutes" disabled={(draft.target_minutes ?? 1) <= 1} onClick={() => setDraft(p => ({ ...p, target_minutes: Math.max(1, (p.target_minutes ?? 10) - 1) }))}><Minus /></Button><output className="min-w-14 text-center font-bold">{draft.target_minutes} min</output><Button type="button" variant="outline" size="icon" aria-label="More minutes" disabled={(draft.target_minutes ?? 10) >= 1440} onClick={() => setDraft(p => ({ ...p, target_minutes: (p.target_minutes ?? 10) + 1 }))}><Plus /></Button></div></div>}
          </section>
          <div className="space-y-1"><Label htmlFor="routine-details">{exercise ? 'How to do it (optional)' : 'Food'}</Label><Textarea id="routine-details" maxLength={2000} value={draft.details} onChange={e => setDraft(p => ({ ...p, details: e.target.value }))} /></div>
          {!exercise && <div className="space-y-1"><Label htmlFor="routine-drink">Drink</Label><Input id="routine-drink" maxLength={500} value={draft.drink} onChange={e => setDraft(p => ({ ...p, drink: e.target.value }))} /></div>}
          {exercise && <p className="text-sm text-[#8b8175]">{EXERCISE_SAFETY}</p>}
          <Button type="submit" className="w-full" disabled={!draft.name.trim() || !draft.times.length || (exercise && !draft.area)}>Save</Button>
          {editing && <section className="space-y-3 border-t border-[#e9e2d6] pt-4"><div className="flex flex-wrap items-center gap-3"><Button type="button" variant="outline" onClick={() => setStopping(true)}>Stop from a date</Button>
            {!data.logs.some(log => log.item_id === editing.id) && <ConfirmDeleteButton type="button" variant="outline" className="text-destructive" title="Delete this plan item?" description={editing.name} onConfirm={async () => { await run(() => data.remove([editing.id]), true); }}>Delete</ConfirmDeleteButton>}</div>
            {stopping && <div className="space-y-2"><Label htmlFor="routine-stop">Stop from</Label><Input id="routine-stop" className="min-w-0 max-w-full" type="date" min={editing.start_date} required value={stopDate} onChange={e => setStopDate(e.target.value)} /><p className="text-sm text-[#8b8175]">Nothing planned on or after this date. What was recorded stays.</p><Button type="button" disabled={!stopDate} onClick={() => void run(() => data.stop(editing.id, stopDate), true)}>Save stop date</Button></div>}
            {data.logs.some(log => log.item_id === editing.id) && <p className="text-sm text-[#8b8175]">This item has records. It can be stopped, not deleted.</p>}
          </section>}
        </fieldset>
      </form>
    </div>;
  }
  const date = format(new Date(), 'yyyy-MM-dd');
  return <div className="space-y-5 text-[#26201a]">
    <header><h1 className="text-[30px] font-normal">{kind === 'meal' ? 'Meals' : 'Exercise'}</h1><p className="text-sm text-[#8b8175]">The daily plan.</p></header>
    {templateIds.length > 0 && <div role="status" className="flex items-center gap-3 rounded-xl border border-[#c9e6d2] bg-[#ecf6ef] p-3 text-sm text-[#1d4d2c]"><span className="flex-1">Started from a typical day: 6 meals filled in. Change any row.</span><Button variant="ghost" className="px-0" disabled={busy} onClick={async () => { if (await run(() => data.remove(templateIds))) setTemplateIds([]); }}>Undo</Button></div>}
    {[kind].map(kind => {
      const items = data.items.filter(item => item.kind === kind);
      const rows = items.flatMap(item => routineMinutes(scheduleForDate(item, date)).map(minute => ({ item, minute }))).sort((a, b) => a.minute - b.minute || a.item.name.localeCompare(b.item.name));
      return <section className="space-y-2" key={kind}><div className="flex items-center justify-between gap-2"><h2 className="[font-family:inherit] text-xs font-bold uppercase tracking-wider text-[#8b8175]">{kind === 'meal' ? 'Meals' : 'Exercises'} · {rows.length}</h2><Button variant="ghost" className="px-0 text-[#8a6240]" onClick={() => open(kind)}>Add {kind}</Button></div>
        <div className="rounded-2xl border border-[#e9e2d6] bg-white px-3">{!rows.length && <p className="py-4 text-sm text-[#8b8175]">Nothing planned</p>}{rows.map(({ item, minute }) => <button key={`${item.id}:${minute}`} className="flex min-h-14 w-full items-center gap-2 border-b border-[#f3ede2] py-3 text-left last:border-0" onClick={() => open(kind, item)}><span className="w-[72px] flex-none text-sm font-bold">{doseTimeLabel(minute)}</span><span className="min-w-0 flex-1"><span className="block break-words font-semibold">{item.name}</span><span className="block break-words text-sm text-[#8b8175]">{kind === 'meal' ? [item.details, item.drink].filter(Boolean).join(' · ') : `${item.target_minutes} min · ${item.details || item.area}`}</span>{item.end_date && <span className="block text-xs text-[#8b8175]">Stopped from {item.end_date}</span>}{item.schedule_from && item.schedule_from > date && <span className="block text-xs text-[#8a6240]">New times start tomorrow</span>}</span><ChevronRight className="h-4 w-4 flex-none text-[#8b8175]" /></button>)}</div>
        {kind === 'meal' && items.length === 0 && <Button variant="outline" className="w-full" disabled={busy} onClick={async () => { setBusy(true); try { const result = await data.typical(); if (result.ok) setTemplateIds(result.data.map(row => row.id)); } finally { setBusy(false); } }}>Start from a typical day</Button>}
      </section>;
    })}
    {kind === 'meal' && <section className="space-y-2 rounded-2xl border border-[#e9e2d6] bg-white p-4"><h2 className="[font-family:inherit] text-xs font-bold uppercase text-[#8b8175]">Diet cautions from About</h2>{care.error ? <p className="text-sm">Diet cautions could not load. <Button variant="ghost" className="px-0" onClick={care.retry}>Try again</Button></p> : care.loading ? <p>Loading diet cautions…</p> : <p className="break-words text-sm">{care.alerts.filter(a => a.kind === 'diet').map(a => [a.text, a.note].filter(Boolean).join(' · ')).join('; ') || (care.profile?.none_known.includes('diet') ? 'None known' : 'Not recorded')}</p>}<Button variant="ghost" className="justify-start px-0 text-[#8a6240]" onClick={onAbout}>Open About</Button></section>}
  </div>;
}
