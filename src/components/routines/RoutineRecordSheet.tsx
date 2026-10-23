import { useState } from 'react';
import { format } from 'date-fns';
import { useCaregiverChoice } from '@/hooks/useCaregiverChoice';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { useCareProfile } from '@/hooks/useCareProfile';
import { useRoutineWrites } from '@/hooks/useRoutineRecords';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import { MEAL_AMOUNTS } from '@/lib/routineToday';
import type { RoutineOccurrence, RoutineLog } from '@/lib/routineSchedule';
import { CaregiverPicker } from '@/components/CaregiverPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { profileDialog } from '@/components/profile/ProfileParts';

export function RoutineRecordSheet({ occurrence, onClose }: { occurrence: RoutineOccurrence; onClose: () => void }) {
  const { item, log } = occurrence;
  const choice = useCaregiverChoice();
  const { caregivers } = useHousehold();
  const care = useCareProfile();
  const writes = useRoutineWrites();
  const [amount, setAmount] = useState(log?.amount ?? 'all');
  const [minutes, setMinutes] = useState(log?.minutes ?? item.target_minutes ?? 10);
  const [caregiverId, setCaregiverId] = useState(log?.caregiver_id ?? choice.caregiver?.caregiver_id);
  const [time, setTime] = useState(format(log ? new Date(log.done_at) : new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [note, setNote] = useState(log?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [collision, setCollision] = useState<RoutineLog | null>(null);
  useUpdateBusy(true);
  const people = caregivers.filter(p => p.is_active || p.caregiver_id === log?.caregiver_id);
  const caregiver = people.find(p => p.caregiver_id === caregiverId);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className={`${profileDialog} bottom-0 top-auto translate-y-0 rounded-b-none sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl`} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
    <DialogHeader className="pr-10"><DialogTitle>{item.kind === 'meal' ? log?.name ?? item.name : log ? 'Change record' : 'Record exercise minutes'}</DialogTitle></DialogHeader>
    {item.kind !== 'meal' && <p className="break-words font-semibold">{log?.name ?? item.name}</p>}
    {item.kind === 'meal' && <div className="space-y-2">{care.loading ? <p>Loading cautions…</p> : care.error ? <p role="alert">Cautions could not load. <Button type="button" variant="ghost" onClick={care.retry}>Try again</Button></p> : <div className="flex flex-wrap gap-2">{care.alerts.filter(a => a.kind === 'allergy' || a.kind === 'diet').map(a => <span className={`max-w-full break-words rounded-full px-3 py-2 text-sm ${a.kind === 'allergy' ? 'bg-[#fdf0ef] text-[#7f1d1d]' : 'bg-[#fdf6e7] text-[#7a4a06]'}`} key={a.id}>{a.kind === 'allergy' ? 'Allergy: ' : ''}{a.text}{a.note && ` · ${a.note}`}</span>)}{!care.alerts.some(a => a.kind === 'allergy' || a.kind === 'diet') && <p className="text-sm text-[#8b8175]">Allergies: {care.profile?.none_known.includes('allergy') ? 'None known' : 'Not recorded'} · Diet: {care.profile?.none_known.includes('diet') ? 'None known' : 'Not recorded'}</p>}</div>}</div>}
    {collision ? <><p role="status">Done by {collision.recorded_by}, {format(new Date(collision.done_at), 'h:mm a')}. The existing record was kept.</p><Button onClick={onClose}>Done</Button></> : <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); if (!caregiver || !time) return;
      setBusy(true);
      try {
        const result = await writes.save({ item_id: item.id, for_date: occurrence.date, for_minute: occurrence.minute, caregiver_id: caregiver.caregiver_id, recorded_by: caregiver.display_name, kind: log?.kind ?? item.kind, name: log?.name ?? item.name, details: log?.details ?? item.details, drink: log?.drink ?? item.drink, target_minutes: log?.target_minutes ?? item.target_minutes, amount: item.kind === 'meal' ? amount : null, minutes: item.kind === 'exercise' ? minutes : null, note, done_at: new Date(time).toISOString() }, log);
        if (result.state === 'existing') setCollision(result.log);
        if (result.state === 'saved') onClose();
      } finally { setBusy(false); }
    }}><fieldset disabled={busy} className="space-y-4">
      {item.kind === 'meal' ? <div className="space-y-2"><p className="font-semibold">How much was eaten?</p><div className="flex flex-wrap gap-2">{Object.entries(MEAL_AMOUNTS).map(([value, label]) => <Button type="button" key={value} variant="outline" aria-pressed={amount === value} className={amount === value ? 'border-2 border-[#8a6240] bg-[#f3ede2]' : ''} onClick={() => setAmount(value)}>{label}</Button>)}</div></div> : <div className="space-y-1"><Label htmlFor="routine-minutes">Minutes</Label><Input id="routine-minutes" type="number" min="0" max="1440" step="0.1" value={minutes} required onChange={e => setMinutes(Number(e.target.value))} /></div>}
      <div className="space-y-1"><Label>Done by</Label><CaregiverPicker people={people} value={caregiverId} onChange={id => { setCaregiverId(id); if (!log) choice.selectCaregiver(id); }} /></div>
      <div className="space-y-1"><Label htmlFor="routine-done-at">When was it done?</Label><Input id="routine-done-at" className="min-w-0 max-w-full" type="datetime-local" required value={time} onChange={e => setTime(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="routine-note">Note (optional)</Label><Textarea id="routine-note" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></div>
      <Button type="submit" className="w-full" disabled={!caregiver || !time}>Save</Button>
      {log && <ConfirmDeleteButton type="button" variant="outline" title="Undo this record?" description={`${log.name} will be not done again.`} confirmLabel="Undo" disabled={busy} onConfirm={async () => { setBusy(true); try { if (await writes.undo(log.id)) onClose(); } finally { setBusy(false); } }}>Undo record</ConfirmDeleteButton>}
    </fieldset></form>}
  </DialogContent></Dialog>;
}
