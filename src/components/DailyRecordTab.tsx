import { useState, useMemo, useEffect } from 'react';
import { HealthRecord, HealthRecordForm, dbToHealthForm, RECORDER_OPTIONS } from '@/types/health';
import { MedicineTracker } from '@/components/MedicineTracker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { Copy, Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatBp } from '@/lib/utils';

interface DailyRecordTabProps {
  records: HealthRecord[];
  addRecord: (form: HealthRecordForm) => Promise<boolean>;
  deleteRecord: (id: string) => Promise<boolean>;
  getLatestRecord: () => HealthRecord | null;
  getRecordByDate: (date: string) => HealthRecord | null;
  /** Day to open on (yyyy-MM-dd); defaults to today. */
  initialDate?: string;
  /** Edit-one-day mode (History → "Edit this day"): hides the global Past Entries list. */
  dayOnly?: boolean;
  /** Notified while a save is in flight, so parents can lock navigation. */
  onBusyChange?: (busy: boolean) => void;
}

const emptyForm: HealthRecordForm = {
  date: format(new Date(), 'yyyy-MM-dd'),
  feedBags: 0, flushCount: 0, weight: 0, bpSystolic: 0, bpDiastolic: 0,
  foodTaken: false, foodDescription: '', stoolPassed: false,
  stoolCount: 0, vomiting: false, vomitCount: 0, constipation: false,
  recordedBy: '', miscNotes: '',
};

export function DailyRecordTab({ records, addRecord, deleteRecord, getLatestRecord, getRecordByDate, initialDate, dayOnly, onBusyChange }: DailyRecordTabProps) {
  const startDate = initialDate ?? format(new Date(), 'yyyy-MM-dd');
  // ONE authoritative day: viewDate. The form has no separate date — every
  // save targets the day shown in the navigator, and nothing else.
  const [viewDate, setViewDate] = useState(startDate);
  const [form, setForm] = useState<HealthRecordForm>({ ...emptyForm, date: startDate });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // While ANY write is in flight, every competing control locks — a save and
  // a delete of the same record must never race.
  const busy = saving || deleting;
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  const viewRecord = useMemo(() => getRecordByDate(viewDate), [viewDate, records]);

  const update = <K extends keyof HealthRecordForm>(key: K, value: HealthRecordForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const resetFormFor = (date: string) => {
    setForm({ ...emptyForm, date });
    setEditingId(null);
  };

  const handleCopyPrevious = () => {
    // Records are sorted newest-first; copy the closest record BEFORE the
    // day being edited (not the latest overall, which could be today's).
    const previous = records.find(r => r.date < viewDate);
    if (!previous) { toast.error('No earlier record to copy from'); return; }
    setForm({ ...dbToHealthForm(previous), date: viewDate });
    setEditingId(null);
    toast.success(`Copied from ${format(parseISO(previous.date), 'MMM d')}`);
  };

  const handleSubmit = async () => {
    if (!form.recordedBy) { toast.error('Please select who is recording'); return; }
    const wasEditing = !!editingId;
    setSaving(true);
    try {
      const ok = await addRecord({ ...form, date: viewDate });
      if (!ok) return; // keep the form values — nothing was saved
      resetFormFor(viewDate);
      toast.success(wasEditing ? 'Record updated' : 'Record saved');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (record: HealthRecord) => {
    // Editing a record moves the whole screen to that record's day, so the
    // header, form and save target can never disagree.
    setViewDate(record.date);
    setForm(dbToHealthForm(record));
    setEditingId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const ok = await deleteRecord(id);
      if (ok) toast.success('Record deleted');
    } finally {
      setDeleting(false);
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = parseISO(viewDate);
    const newDate = direction === 'prev' ? subDays(current, 1) : addDays(current, 1);
    const newStr = format(newDate, 'yyyy-MM-dd');
    setViewDate(newStr);
    // A new day starts a fresh form — values never carry across days.
    resetFormFor(newStr);
  };

  const isToday = viewDate === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-4 pb-4">
      {/* Date header — in dayOnly mode there are no arrows: this screen
          edits exactly the day it was opened for. */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center justify-between px-4 py-3">
          {!dayOnly ? (
            <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => navigateDate('prev')} disabled={busy}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : <span className="w-10" />}
          <div className="text-center">
            <p className="text-sm font-semibold">{format(parseISO(viewDate), 'EEEE, MMM d, yyyy')}</p>
            {isToday && <p className="text-xs text-muted-foreground">Today</p>}
          </div>
          {!dayOnly ? (
            <Button variant="ghost" size="icon" aria-label="Next day" onClick={() => navigateDate('next')} disabled={isToday || busy}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          ) : <span className="w-10" />}
        </CardContent>
      </Card>

      {/* View existing record for selected date */}
      {viewRecord && !editingId && (
        <Card className="border-none shadow-sm bg-muted/30">
          <CardHeader className="px-4 pb-2 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Record for {format(parseISO(viewRecord.date), 'MMM d')}</CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => handleEdit(viewRecord)} disabled={busy}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" aria-label="Delete record" onClick={() => handleDelete(viewRecord.id)} disabled={busy}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Feed Bags:</span> {viewRecord.feed_bags}</div>
              <div><span className="text-muted-foreground">Flushes:</span> {(viewRecord as any).flush_count ?? 0}</div>
              <div><span className="text-muted-foreground">Weight:</span> {viewRecord.weight} kg</div>
              <div><span className="text-muted-foreground">BP:</span> {formatBp(viewRecord.bp_systolic, viewRecord.bp_diastolic)}</div>
              <div><span className="text-muted-foreground">Food Taken:</span> {viewRecord.food_taken ? 'Yes' : 'No'}</div>
              {viewRecord.food_taken && viewRecord.food_description && (
                <div className="col-span-2"><span className="text-muted-foreground">Food:</span> {viewRecord.food_description}</div>
              )}
              <div><span className="text-muted-foreground">Stool:</span> {viewRecord.stool_passed ? `Yes (×${viewRecord.stool_count})` : 'No'}</div>
              <div><span className="text-muted-foreground">Vomiting:</span> {viewRecord.vomiting ? `Yes (×${(viewRecord as any).vomit_count || 0})` : 'No'}</div>
              <div><span className="text-muted-foreground">Constipation:</span> {viewRecord.constipation ? 'Yes' : 'No'}</div>
              {(viewRecord as any).recorded_by && (
                <div><span className="text-muted-foreground">Recorded by:</span> {(viewRecord as any).recorded_by}</div>
              )}
              {(viewRecord as any).misc_notes && (
                <div className="col-span-2"><span className="text-muted-foreground">Notes:</span> {(viewRecord as any).misc_notes}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry Form */}
      <Card className="border-none shadow-sm">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{editingId ? 'Edit Record' : 'New Entry'} — {format(parseISO(viewDate), 'MMM d')}</CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopyPrevious} className="gap-1.5 text-xs" disabled={busy}>
              <Copy className="h-3.5 w-3.5" /> Copy Previous
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <fieldset disabled={busy} className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Recorded By</Label>
            <Select value={form.recordedBy} onValueChange={v => update('recordedBy', v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select name" />
              </SelectTrigger>
              <SelectContent>
                {RECORDER_OPTIONS.map(name => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Feed Bags</Label>
              <Input type="number" min={0} value={form.feedBags || ''} onChange={e => update('feedBags', Number(e.target.value))} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">No. of Flushes</Label>
              <Input type="number" min={0} value={form.flushCount || ''} onChange={e => update('flushCount', Number(e.target.value))} placeholder="0" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Weight (kg)</Label>
              <Input type="number" min={0} step={0.1} value={form.weight || ''} onChange={e => update('weight', Number(e.target.value))} placeholder="0" className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Blood Pressure</Label>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <Input type="number" min={0} value={form.bpSystolic || ''} onChange={e => update('bpSystolic', Number(e.target.value))} placeholder="Systolic" />
              <Input type="number" min={0} value={form.bpDiastolic || ''} onChange={e => update('bpDiastolic', Number(e.target.value))} placeholder="Diastolic" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Food Taken</Label>
              <Switch checked={form.foodTaken} onCheckedChange={v => update('foodTaken', v)} />
            </div>
            {form.foodTaken && (
              <Textarea value={form.foodDescription} onChange={e => update('foodDescription', e.target.value)} placeholder="What did he eat?" className="min-h-[60px] text-sm" maxLength={500} />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Stool Passed</Label>
              <Switch checked={form.stoolPassed} onCheckedChange={v => update('stoolPassed', v)} />
            </div>
            {form.stoolPassed && (
              <Input type="number" min={0} value={form.stoolCount || ''} onChange={e => update('stoolCount', Number(e.target.value))} placeholder="Number of times" />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Vomiting</Label>
              <Switch checked={form.vomiting} onCheckedChange={v => update('vomiting', v)} />
            </div>
            {form.vomiting && (
              <Input type="number" min={0} value={form.vomitCount || ''} onChange={e => update('vomitCount', Number(e.target.value))} placeholder="Number of vomits" />
            )}
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Constipation</Label>
            <Switch checked={form.constipation} onCheckedChange={v => update('constipation', v)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="flex-1 gap-2" disabled={busy}>
              <Plus className="h-4 w-4" />
              {saving ? 'Saving...' : editingId ? 'Update Record' : 'Save Entry'}
            </Button>
            {editingId && (
              <Button variant="outline" disabled={busy} onClick={() => resetFormFor(viewDate)}>
                Cancel
              </Button>
            )}
          </div>
          </fieldset>
        </CardContent>
      </Card>

      {/* Misc Notes */}
      <Card className="border-none shadow-sm">
        <CardHeader className="px-4 pb-2 pt-4">
          <CardTitle className="text-base">Misc Notes</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <fieldset disabled={busy}>
            <Textarea value={form.miscNotes} onChange={e => update('miscNotes', e.target.value)} placeholder="Any additional notes or observations..." className="min-h-[80px] text-sm" maxLength={1000} />
          </fieldset>
        </CardContent>
      </Card>

      {/* Medicine Tracker */}
      <MedicineTracker key={viewDate} viewDate={viewDate} />

      {/* Past entries list (hidden when editing a single day from History) */}
      {!dayOnly && (
      <div>
        <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">Past Entries</h3>
        {records.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <div className="space-y-2">
            {records.map(record => (
              <Card key={record.id} className="border-none shadow-sm">
                <CardContent className="flex items-center justify-between p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{format(parseISO(record.date), 'EEE, MMM d')}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {record.feed_bags} bags · {record.weight}kg · BP {formatBp(record.bp_systolic, record.bp_diastolic)}
                      {record.stool_passed ? ` · Stool ×${record.stool_count}` : ''}
                      {(record as any).recorded_by ? ` · by ${(record as any).recorded_by}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Edit record" onClick={() => handleEdit(record)} disabled={busy}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" aria-label="Delete record" onClick={() => handleDelete(record.id)} disabled={busy}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
