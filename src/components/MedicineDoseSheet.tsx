import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { format } from 'date-fns';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CaregiverPicker } from './CaregiverPicker';
import { DoseTimePicker } from './DoseTimePicker';
import { useCaregiverChoice } from '@/hooks/useCaregiverChoice';
import { useMedicines, type Medicine } from '@/hooks/useMedicines';
import { useDoseSkips } from '@/hooks/useDoseSkips';
import { automaticDose } from '@/lib/doseRecording';
import { currentQuarter, doseTimeFields, doseTimeLabel } from '@/lib/doseTime';
import { toast } from 'sonner';
import { relativeDoseTime } from '@/lib/doseGroups';
import { occurrenceLink, occurrenceTime, timeLabel, doseLabel, type UpcomingItem } from './today/todaySchedule';

function DoseAnswer({ selected, children, onClick }: { selected: boolean; children: ReactNode; onClick: () => void }) {
  return <Button variant="outline" aria-pressed={selected} onClick={onClick}
    className={`relative w-full whitespace-normal border-2 px-10 ${selected ? 'border-[#8a6240] bg-[#f6eee4] text-[#5b3d25] hover:bg-[#f6eee4]' : ''}`}>
    {selected && <Check aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />}{children}
  </Button>;
}

export function MedicineDoseSheet({ medicine, slot, candidates, onClose }: {
  medicine: Medicine; slot?: UpcomingItem; candidates: UpcomingItem[]; onClose: () => void;
}) {
  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const { addMedicineLog } = useMedicines(today);
  const { addSkip } = useDoseSkips(today);
  const { activeCaregivers, caregiver, selectCaregiver } = useCaregiverChoice();
  // Pin the question and its choices at open; clock ticks must not add a
  // second question or clear the person's selection halfway through a record.
  const [choices] = useState(candidates);
  const [askWhen] = useState(!!slot && (slot.state === 'late' || slot.state === 'missed'));
  const [selected, setSelected] = useState<UpcomingItem | undefined>(slot ?? automaticDose(choices));
  const [extra, setExtra] = useState(false);
  const [answered, setAnswered] = useState(!!slot || choices.length === 0 || !!automaticDose(choices));
  const [when, setWhen] = useState('');
  const [date, setDate] = useState(today);
  const [time, setTime] = useState(() => currentQuarter(now));
  const [change, setChange] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [busy, setBusy] = useState(false);
  const parsedDate = new Date(date + 'T00:00');
  const dateLabel = Number.isNaN(parsedDate.getTime()) ? 'Choose a date' : format(parsedDate, 'MMM d');
  // Keep the same five-minute clock-skew allowance as Given. A future
  // administration must not clear a slot while being invisible in Given.
  const futureTime = occurrenceTime({ for_date: date, for_minute: time }).getTime() > now.getTime() + 5 * 60_000;
  const chooseWhen = (value: string) => {
    setWhen(value); setChange(value === 'other');
    const at = value === 'on-time' && slot ? slot.at : new Date();
    setDate(format(at, 'yyyy-MM-dd'));
    setTime(value === 'on-time' ? at.getHours() * 60 + at.getMinutes() : currentQuarter(at));
  };
  const save = async () => {
    if (!caregiver || busy) return;
    setBusy(true);
    try {
      const success = skipping && slot
        ? await addSkip({ medicine_id: medicine.id, ...occurrenceLink(slot.at), caregiver_id: caregiver.caregiver_id, reason: reason === 'Other' ? other : reason })
        : await addMedicineLog({ medicine_id: medicine.id, date, ...doseTimeFields(time), caregiver_id: caregiver.caregiver_id, recorded_by: caregiver.display_name, ...(selected ? occurrenceLink(selected.at) : {}), is_extra: extra });
      if (success) onClose();
    } catch { toast.error('Could not save. Try again.'); }
    finally { setBusy(false); }
  };
  return <Drawer open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DrawerContent className="max-h-[90dvh] overflow-y-auto">
      <DrawerHeader><DrawerTitle>{skipping ? 'Why is it skipped?' : `Log ${medicine.name}`}</DrawerTitle>
        {skipping && <p className="break-words font-semibold">{medicine.name}</p>}
        {doseLabel(medicine) && <p className="break-words text-sm font-semibold text-muted-foreground">{doseLabel(medicine)}</p>}
      </DrawerHeader>
      <fieldset disabled={busy} className="space-y-4 px-4">
        <div className="space-y-1"><Label>Recorded by</Label><CaregiverPicker people={activeCaregivers} value={caregiver?.caregiver_id} onChange={selectCaregiver} /></div>
        {skipping ? <div className="space-y-2">
          {["Doctor's advice", 'Not needed', 'Refused', 'None left', 'Other'].map(value => <DoseAnswer selected={reason === value} key={value} onClick={() => setReason(reason === value ? '' : value)}>{value}</DoseAnswer>)}
          {reason === 'Other' && <Input aria-label="Other reason" maxLength={80} value={other} onChange={e => setOther(e.target.value)} />}
        </div> : <>
          {askWhen && slot && <div className="space-y-2"><p className="font-semibold">This dose was due at {timeLabel(slot.at)}. When was it given?</p>
            {[[`At ${timeLabel(slot.at)}, on time`, 'on-time'], ['Just now', 'now'], ['At another time', 'other']].map(([label, value]) => <DoseAnswer key={value} selected={when === value} onClick={() => chooseWhen(value)}>{label}</DoseAnswer>)}
          </div>}
          {!slot && choices.length > 0 && !automaticDose(choices) && <div className="space-y-2"><p className="font-semibold">Which dose is this?</p>
            {choices.map(candidate => <DoseAnswer key={candidate.at.getTime()} selected={selected === candidate} onClick={() => { setSelected(candidate); setExtra(false); setAnswered(true); }}>The {timeLabel(candidate.at)} dose, {relativeDoseTime(candidate.at, now)}</DoseAnswer>)}
            <DoseAnswer selected={extra} onClick={() => { setSelected(undefined); setExtra(true); setAnswered(true); }}>An extra dose, not on the schedule</DoseAnswer>
          </div>}
          {!askWhen && <div className="flex items-center justify-between gap-2"><span>{dateLabel} · {doseTimeLabel(time)}</span><Button variant="ghost" onClick={() => setChange(!change)}>Change</Button></div>}
          {change && <div className="space-y-2"><Input aria-label="Date" type="date" max={format(new Date(now.getTime() + 5 * 60_000), 'yyyy-MM-dd')} value={date} onChange={e => setDate(e.target.value)} /><DoseTimePicker value={time} onChange={setTime} /></div>}
          {futureTime && <p role="alert" className="text-sm">Choose a time that has already passed.</p>}
        </>}
      </fieldset>
      <DrawerFooter>
        <Button onClick={save} disabled={busy || !caregiver || (!skipping && (!answered || (askWhen && !when) || futureTime || !date))}>{skipping ? 'Save skip' : 'Save'}</Button>
        {slot && <Button variant="ghost" disabled={busy} onClick={() => setSkipping(!skipping)}>{skipping ? 'Back to recording' : 'Skip this dose'}</Button>}
      </DrawerFooter>
    </DrawerContent>
  </Drawer>;
}
