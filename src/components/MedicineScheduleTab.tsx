import { useState } from 'react';
import { useMedicineSchedule, MedicineScheduleInsert } from '@/hooks/useMedicineSchedule';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Plus, Pencil } from 'lucide-react';
import { DoseTimePicker } from '@/components/DoseTimePicker';
import { format } from 'date-fns';
import { medicineIntervalDays, nextMedicineDay } from '@/lib/medicineDays';
import { canonicalSchedule, readStoredSchedule, preserveEarlierNote, fillMedicineTimes, medicineReadBack, FREQUENCY_LABELS, MAX_MEDICINE_TIMES, hasPickedMedicineTimes } from '@/lib/medicineForm';
import { PrescriptionPhotoScreen, PrescriptionPhotoViewer, type PhotoFormContext } from '@/components/PrescriptionPhotoScreen';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';

const MED_TYPES = ['Pain Killer', 'Pain Relief', 'Blood Thinner', 'Digestive', 'Anti-Nausea', 'Diabetes', 'Nerve Pain', 'Thyroid', 'Psych', 'Cancer', 'Vitamin', 'Antibiotic', 'Other'];
const CATEGORIES = ['medicine', 'non-medicine'];
const FREQUENCIES = Object.keys(FREQUENCY_LABELS);

const TYPE_COLORS: Record<string, string> = {
  'Pain Killer': 'bg-red-100 text-red-800',
  'Pain Relief': 'bg-orange-100 text-orange-800',
  'Blood Thinner': 'bg-blue-100 text-blue-800',
  'Digestive': 'bg-green-100 text-green-800',
  'Anti-Nausea': 'bg-yellow-100 text-yellow-800',
  'Diabetes': 'bg-purple-100 text-purple-800',
  'Nerve Pain': 'bg-pink-100 text-pink-800',
  'Thyroid': 'bg-teal-100 text-teal-800',
  'Psych': 'bg-indigo-100 text-indigo-800',
  'Cancer': 'bg-rose-100 text-rose-800',
};

const emptyForm: MedicineScheduleInsert = {
  name: '', potency: '', amount: '', med_type: '', category: 'medicine',
  schedule_time: '', frequency: 'daily', schedule_note: '', show_in_quick_log: true,
  start_date: null,
};

export function MedicineScheduleTab() {
  const { medicines, loading, loaded, loadError, addMedicine, updateMedicine, refetch } = useMedicineSchedule();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicineScheduleInsert>(emptyForm);

  const [times, setTimes] = useState<(number | undefined)[]>([]);
  const [earlier, setEarlier] = useState('');
  const [otherType, setOtherType] = useState('');
  const [helperOpen, setHelperOpen] = useState(false);
  const [intervalHours, setIntervalHours] = useState(4);
  const [startTime, setStartTime] = useState(480);
  const [replacePending, setReplacePending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoContext, setPhotoContext] = useState<PhotoFormContext | null>(null);
  const [viewPhotos, setViewPhotos] = useState(false);
  useUpdateBusy(photoOpen || saving);
  const mark = (field: string) => photoContext?.draft.marks.includes(field) ? <span className="ml-2 text-xs font-semibold text-[#8a6240]">Check this</span> : null;

  const resetHelpers = () => { setHelperOpen(false); setReplacePending(false); setIntervalHours(4); setStartTime(480); };
  const openAdd = () => {
    setPhotoContext(null);
    setEditId(null); setForm(emptyForm); setTimes([]); setEarlier(''); setOtherType('');
    resetHelpers(); setOpen(true);
  };
  const openEdit = (med: typeof medicines[0]) => {
    setPhotoContext(null);
    setEditId(med.id);
    setForm({ name: med.name, potency: med.potency, amount: med.amount, med_type: med.med_type, category: med.category, schedule_time: med.schedule_time, frequency: med.frequency, schedule_note: med.schedule_note, show_in_quick_log: med.show_in_quick_log, start_date: med.start_date ?? null, source: med.source });
    const stored = readStoredSchedule(med.schedule_time);
    setTimes(stored.times); setEarlier(stored.earlier);
    setOtherType(MED_TYPES.includes(med.med_type) ? '' : med.med_type);
    resetHelpers(); setOpen(true);
  };
  const openPhotoForm = (context: PhotoFormContext) => {
    setEditId(null); setForm(context.draft.form); setTimes(context.draft.times);
    setEarlier(''); setOtherType(''); resetHelpers();
    if (context.draft.helperHours) { setIntervalHours(context.draft.helperHours); setHelperOpen(true); }
    setPhotoContext(context); setOpen(true);
  };
  const leavePhotos = () => {
    setPhotoOpen(false); setPhotoContext(null); setViewPhotos(false); setOpen(false);
    setForm(emptyForm); setTimes([]); setEarlier(''); setOtherType(''); resetHelpers();
  };

  const handleSave = async () => {
    if (!form.name.trim() || (form.frequency !== 'as needed' && (times.includes(undefined) || times.length > MAX_MEDICINE_TIMES)) || saving) return;
    const input = {
      ...form,
      med_type: MED_TYPES.includes(form.med_type) && form.med_type !== 'Other' ? form.med_type : otherType || 'Other',
      schedule_time: form.frequency === 'as needed' ? '' : canonicalSchedule(times as number[]),
      schedule_note: preserveEarlierNote(form.schedule_note, earlier),
    };
    setSaving(true);
    try {
      const saved = editId ? await updateMedicine(editId, input) : await addMedicine(input, photoContext?.onSaved);
      if (saved) setOpen(false);
    } finally { setSaving(false); }
  };

  const fillTimes = () => {
    setTimes(fillMedicineTimes(intervalHours, startTime));
    setReplacePending(false);
  };

  // Group by med_type
  const grouped = medicines.reduce<Record<string, typeof medicines>>((acc, m) => {
    const key = m.med_type || 'Other';
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  const setField = (k: keyof MedicineScheduleInsert, v: string) => {
    setForm(f => {
      const updated = { ...f, [k]: v };
      if (k === 'frequency' && medicineIntervalDays(v) && !f.start_date) updated.start_date = format(new Date(), 'yyyy-MM-dd');
      // Auto-toggle quick log: medicine defaults to yes, non-medicine to no (only on category change for new items)
      if (k === 'category' && !editId) {
        updated.show_in_quick_log = v === 'medicine';
      }
      return updated;
    });
  };

  return (
    <div className="pb-4 space-y-4">
      {photoOpen ? <PrescriptionPhotoScreen medicines={medicines} loaded={loaded} loadError={loadError} onRetry={() => void refetch()} onAdd={openPhotoForm} onEdit={openEdit} onBack={leavePhotos} /> : <>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Medicine Schedule</h2>
        <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        <Button size="sm" variant="outline" onClick={() => setPhotoOpen(true)}>Add from a photo</Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {loadError && <div role="alert" className="space-y-2"><p>Couldn't load medicines. Check the connection.</p><Button variant="outline" onClick={() => void refetch()}>Try again</Button></div>}

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([type, meds]) => (
        <div key={type} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{type}</h3>
          {meds.map(med => (
            <Card key={med.id} className="overflow-hidden">
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="min-w-0 break-words font-medium text-sm">{med.name}</span>
                    {med.category === 'non-medicine' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Non-med</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {med.potency && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{med.potency}</Badge>}
                    {med.amount && <span className="text-muted-foreground">× {med.amount}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <Badge className={`text-[10px] px-1.5 py-0 border-0 ${TYPE_COLORS[med.med_type] || 'bg-muted text-muted-foreground'}`}>{med.med_type || 'Other'}</Badge>
                    {med.schedule_time && <span className="text-muted-foreground">⏰ {med.schedule_time}</span>}
                    {medicineIntervalDays(med.frequency) ? <span className="text-muted-foreground">
                      {nextMedicineDay(med, readStoredSchedule(med.schedule_time).times) ? `${FREQUENCY_LABELS[med.frequency]} · next ${format(nextMedicineDay(med, readStoredSchedule(med.schedule_time).times)!, 'EEE, MMM d')}` : <>{FREQUENCY_LABELS[med.frequency]} · <span>Pick a start day to see this under Coming up.</span></>}
                    </span> : <span className="text-muted-foreground capitalize">({med.frequency})</span>}
                  </div>
                  {med.schedule_note && <p className="text-[11px] text-muted-foreground italic">{med.schedule_note}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit ${med.name}`} onClick={() => openEdit(med)}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}
      </>}

      <Sheet open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center">
          <SheetHeader>
            <SheetTitle>{editId ? 'Edit Medicine' : 'Add Medicine'}</SheetTitle>
            <SheetDescription>Fill in the medicine details below.</SheetDescription>
          </SheetHeader>
          {photoContext && <div className="mt-3 space-y-2 rounded-xl bg-[#f6eee4] p-3">
            <p className="font-semibold">From the photo. Check every line.</p>
            <p className="break-words text-sm">The prescription says: {photoContext.medicine.source_text}</p>
            <Button variant="outline" onClick={() => setViewPhotos(true)}>View photos</Button>
          </div>}
          <fieldset disabled={saving} className="min-w-0">
          <div className="space-y-3 mt-4">
            <div><Label className="text-xs">Name{mark('name')}</Label><Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Medicine name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Potency{mark('potency')}</Label><Input value={form.potency} onChange={e => setField('potency', e.target.value)} placeholder="e.g. 500mg" /></div>
              <div><Label className="text-xs">Amount{mark('amount')}</Label><Input value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="e.g. 2 pills" /></div>
            </div>
            <div>
              <Label className="text-sm font-semibold">Which days is it given?{mark('frequency')}</Label>
              <Select value={form.frequency || 'daily'} onValueChange={v => { setField('frequency', v); setReplacePending(false); }}>
                <SelectTrigger aria-label="Which days is it given?"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {form.frequency && !FREQUENCIES.includes(form.frequency) && <SelectItem value={form.frequency}>{form.frequency}</SelectItem>}
                  {FREQUENCIES.map(f => <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {medicineIntervalDays(form.frequency) && <div>
              <Label htmlFor="medicine-start-date" className="text-sm font-semibold">Which day does it start?{mark('start_date')}</Label>
              <Input id="medicine-start-date" type="date" value={form.start_date ?? ''} onChange={event => setForm(previous => ({ ...previous, start_date: event.target.value || null }))} />
              {!form.start_date && <p className="text-sm">Pick a start day to see this under Coming up.</p>}
            </div>}
            {form.frequency !== 'as needed' && <div className="space-y-2">
              <Label className="text-sm font-semibold">At what times?{mark('times')}</Label>
              {photoContext?.draft.frequencyNote && <p className="text-sm">{photoContext.draft.frequencyNote}</p>}
              {times.map((time, index) => <div key={index} className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><DoseTimePicker label={`Medicine time ${index + 1}`} value={time} excluded={times.filter((_, i) => i !== index && times[i] !== undefined) as number[]} onChange={value => setTimes(previous => previous.map((old, i) => i === index ? value : old))} /></div>
                <Button variant="ghost" aria-label={`Remove time ${index + 1}`} onClick={() => setTimes(previous => previous.filter((_, i) => i !== index))}>Remove</Button>
              </div>)}
              <Button variant="outline" disabled={times.length >= MAX_MEDICINE_TIMES} onClick={() => setTimes(previous => [...previous, undefined])}>Add another time</Button>
              {times.length > MAX_MEDICINE_TIMES && <p role="alert" className="text-sm">Keep at most 24 times before saving.</p>}
              <Button variant="link" className="h-auto whitespace-normal text-left" onClick={() => setHelperOpen(value => !value)}>Given every few hours? Fill the times in for me.</Button>
              {helperOpen && <div className="space-y-2 rounded-lg border p-3">
                <Label className="text-xs">Every</Label>
                <Select value={String(intervalHours)} onValueChange={value => { setIntervalHours(Number(value)); setReplacePending(false); }}>
                  <SelectTrigger aria-label="Every how many hours"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(hours => <SelectItem key={hours} value={String(hours)}>{hours} {hours === 1 ? 'hour' : 'hours'}</SelectItem>)}</SelectContent>
                </Select>
                <Label className="text-xs">Starting at</Label>
                <DoseTimePicker label="Starting at" value={startTime} onChange={value => { setStartTime(value); setReplacePending(false); }} />
                {24 % intervalHours !== 0 && <p className="text-sm">{intervalHours} hours does not fit evenly into a day, so the gap overnight will be different. Change the times if you need to.</p>}
                {replacePending ? <div className="space-y-2">
                  <p className="text-sm">Replace the times you picked?</p>
                  <div className="flex flex-wrap gap-2"><Button onClick={fillTimes}>Replace times</Button><Button variant="outline" onClick={() => setReplacePending(false)}>Keep my times</Button></div>
                </div> : <Button onClick={() => hasPickedMedicineTimes(times) ? setReplacePending(true) : fillTimes()}>Fill times</Button>}
              </div>}
            </div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={MED_TYPES.includes(form.med_type) ? form.med_type : form.med_type ? 'Other' : ''} onValueChange={v => setField('med_type', v)}>
                  <SelectTrigger aria-label="Type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{MED_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setField('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {(form.med_type === 'Other' || (form.med_type && !MED_TYPES.includes(form.med_type))) && <div>
              <Label htmlFor="other-medicine-type" className="text-xs">What kind of medicine is it?</Label>
              <Input id="other-medicine-type" value={otherType} maxLength={30} onChange={e => setOtherType(e.target.value)} />
            </div>}
            {earlier && <p className="break-words text-sm text-muted-foreground">Earlier entry: {earlier}</p>}
            <div>
              <Label className="text-xs">Notes{mark('schedule_note')}</Label>
              <Input value={form.schedule_note} onChange={e => setField('schedule_note', e.target.value)} placeholder="Optional notes" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show_in_quick_log"
                checked={form.show_in_quick_log}
                onCheckedChange={(checked) => setForm(f => ({ ...f, show_in_quick_log: !!checked }))}
              />
              <Label htmlFor="show_in_quick_log" className="inline-flex min-h-11 min-w-11 items-center text-xs cursor-pointer">Show in Quick Log</Label>
            </div>
            <p role="status" className="text-sm">{medicineReadBack(form.frequency, times.filter(time => time !== undefined) as number[], form.start_date)}</p>
            <Button className="w-full" disabled={saving || !form.name.trim() || (form.frequency !== 'as needed' && (times.includes(undefined) || times.length > MAX_MEDICINE_TIMES))} onClick={handleSave}>{editId ? 'Save Changes' : 'Add Medicine'}</Button>
          </div>
          </fieldset>
        </SheetContent>
      </Sheet>
      {viewPhotos && photoContext && <PrescriptionPhotoViewer photos={photoContext.photos} onClose={() => setViewPhotos(false)} />}
    </div>
  );
}
