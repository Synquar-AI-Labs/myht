import { useState, useMemo } from 'react';
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

interface DailyRecordTabProps {
  records: HealthRecord[];
  addRecord: (form: HealthRecordForm) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getLatestRecord: () => HealthRecord | null;
  getRecordByDate: (date: string) => HealthRecord | null;
}

const emptyForm: HealthRecordForm = {
  date: format(new Date(), 'yyyy-MM-dd'),
  feedBags: 0, weight: 0, bpSystolic: 0, bpDiastolic: 0,
  foodTaken: false, foodDescription: '', stoolPassed: false,
  stoolCount: 0, vomiting: false, vomitCount: 0, constipation: false,
  recordedBy: '',
};

export function DailyRecordTab({ records, addRecord, deleteRecord, getLatestRecord, getRecordByDate }: DailyRecordTabProps) {
  const [form, setForm] = useState<HealthRecordForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewDate, setViewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const viewRecord = useMemo(() => getRecordByDate(viewDate), [viewDate, records]);

  const update = <K extends keyof HealthRecordForm>(key: K, value: HealthRecordForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCopyPrevious = () => {
    const latest = getLatestRecord();
    if (!latest) { toast.error('No previous record to copy from'); return; }
    setForm({ ...dbToHealthForm(latest), date: format(new Date(), 'yyyy-MM-dd') });
    setEditingId(null);
    toast.success('Copied from previous entry');
  };

  const handleSubmit = async () => {
    if (!form.date) { toast.error('Please select a date'); return; }
    if (!form.recordedBy) { toast.error('Please select who is recording'); return; }
    setSaving(true);
    await addRecord(form);
    setForm({ ...emptyForm, date: format(new Date(), 'yyyy-MM-dd') });
    setEditingId(null);
    setSaving(false);
    toast.success(editingId ? 'Record updated' : 'Record saved');
  };

  const handleEdit = (record: HealthRecord) => {
    setForm(dbToHealthForm(record));
    setEditingId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = parseISO(viewDate);
    const newDate = direction === 'prev' ? subDays(current, 1) : addDays(current, 1);
    setViewDate(format(newDate, 'yyyy-MM-dd'));
  };

  const isToday = viewDate === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-4 pb-4">
      {/* Date Navigator */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-semibold">{format(parseISO(viewDate), 'EEEE, MMM d, yyyy')}</p>
            {isToday && <p className="text-xs text-muted-foreground">Today</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigateDate('next')} disabled={isToday}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>

      {/* View existing record for selected date */}
      {viewRecord && !editingId && (
        <Card className="border-none shadow-sm bg-muted/30">
          <CardHeader className="px-4 pb-2 pt-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Record for {format(parseISO(viewRecord.date), 'MMM d')}</CardTitle>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => handleEdit(viewRecord)}>
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={async () => { await deleteRecord(viewRecord.id); toast.success('Record deleted'); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Feed Bags:</span> {viewRecord.feed_bags}</div>
              <div><span className="text-muted-foreground">Weight:</span> {viewRecord.weight} kg</div>
              <div><span className="text-muted-foreground">BP:</span> {viewRecord.bp_systolic}/{viewRecord.bp_diastolic}</div>
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry Form */}
      <Card className="border-none shadow-sm">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{editingId ? 'Edit Record' : 'New Entry'}</CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopyPrevious} className="gap-1.5 text-xs">
              <Copy className="h-3.5 w-3.5" /> Copy Previous
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div>
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input type="date" value={form.date} onChange={e => update('date', e.target.value)} className="mt-1" />
          </div>
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
          <Button onClick={handleSubmit} className="w-full gap-2" disabled={saving}>
            <Plus className="h-4 w-4" />
            {saving ? 'Saving...' : editingId ? 'Update Record' : 'Save Entry'}
          </Button>
        </CardContent>
      </Card>

      {/* Medicine Tracker */}
      <MedicineTracker viewDate={viewDate} />

      {/* Past entries list */}
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
                      {record.feed_bags} bags · {record.weight}kg · BP {record.bp_systolic}/{record.bp_diastolic}
                      {record.stool_passed ? ` · Stool ×${record.stool_count}` : ''}
                      {(record as any).recorded_by ? ` · by ${(record as any).recorded_by}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(record)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={async () => { await deleteRecord(record.id); toast.success('Record deleted'); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
