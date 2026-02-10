import { useState } from 'react';
import { HealthRecord } from '@/types/health';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import { Copy, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DailyRecordTabProps {
  records: HealthRecord[];
  onSave: (record: Omit<HealthRecord, 'id' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  getLatestRecord: () => HealthRecord | null;
  getRecordByDate: (date: string) => HealthRecord | null;
}

const emptyForm = {
  date: format(new Date(), 'yyyy-MM-dd'),
  feedBags: 0,
  weight: 0,
  bpSystolic: 0,
  bpDiastolic: 0,
  foodTaken: false,
  foodDescription: '',
  stoolPassed: false,
  stoolCount: 0,
  vomiting: false,
  constipation: false,
};

export function DailyRecordTab({ records, onSave, onDelete, getLatestRecord, getRecordByDate }: DailyRecordTabProps) {
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const update = <K extends keyof typeof emptyForm>(key: K, value: (typeof emptyForm)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCopyPrevious = () => {
    const latest = getLatestRecord();
    if (!latest) {
      toast.error('No previous record to copy from');
      return;
    }
    setForm({
      date: format(new Date(), 'yyyy-MM-dd'),
      feedBags: latest.feedBags,
      weight: latest.weight,
      bpSystolic: latest.bpSystolic,
      bpDiastolic: latest.bpDiastolic,
      foodTaken: latest.foodTaken,
      foodDescription: latest.foodDescription,
      stoolPassed: latest.stoolPassed,
      stoolCount: latest.stoolCount,
      vomiting: latest.vomiting,
      constipation: latest.constipation,
    });
    setEditingId(null);
    toast.success('Copied from previous entry');
  };

  const handleSubmit = () => {
    if (!form.date) {
      toast.error('Please select a date');
      return;
    }
    onSave(form);
    setForm({ ...emptyForm, date: format(new Date(), 'yyyy-MM-dd') });
    setEditingId(null);
    toast.success(editingId ? 'Record updated' : 'Record saved');
  };

  const handleEdit = (record: HealthRecord) => {
    setForm({
      date: record.date,
      feedBags: record.feedBags,
      weight: record.weight,
      bpSystolic: record.bpSystolic,
      bpDiastolic: record.bpDiastolic,
      foodTaken: record.foodTaken,
      foodDescription: record.foodDescription,
      stoolPassed: record.stoolPassed,
      stoolCount: record.stoolCount,
      vomiting: record.vomiting,
      constipation: record.constipation,
    });
    setEditingId(record.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Entry Form */}
      <Card className="border-none shadow-sm">
        <CardHeader className="px-4 pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{editingId ? 'Edit Record' : "Today's Entry"}</CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopyPrevious} className="gap-1.5 text-xs">
              <Copy className="h-3.5 w-3.5" />
              Copy Previous
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          {/* Date */}
          <div>
            <Label className="text-xs text-muted-foreground">Date</Label>
            <Input type="date" value={form.date} onChange={e => update('date', e.target.value)} className="mt-1" />
          </div>

          {/* Feed Bags & Weight */}
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

          {/* Blood Pressure */}
          <div>
            <Label className="text-xs text-muted-foreground">Blood Pressure</Label>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <Input type="number" min={0} value={form.bpSystolic || ''} onChange={e => update('bpSystolic', Number(e.target.value))} placeholder="Systolic" />
              <Input type="number" min={0} value={form.bpDiastolic || ''} onChange={e => update('bpDiastolic', Number(e.target.value))} placeholder="Diastolic" />
            </div>
          </div>

          {/* Food Taken */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Food Taken</Label>
              <Switch checked={form.foodTaken} onCheckedChange={v => update('foodTaken', v)} />
            </div>
            {form.foodTaken && (
              <Textarea
                value={form.foodDescription}
                onChange={e => update('foodDescription', e.target.value)}
                placeholder="Describe food intake..."
                className="min-h-[60px] text-sm"
                maxLength={500}
              />
            )}
          </div>

          {/* Stool */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Stool Passed</Label>
              <Switch checked={form.stoolPassed} onCheckedChange={v => update('stoolPassed', v)} />
            </div>
            {form.stoolPassed && (
              <Input type="number" min={0} value={form.stoolCount || ''} onChange={e => update('stoolCount', Number(e.target.value))} placeholder="Number of times" />
            )}
          </div>

          {/* Vomiting & Constipation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Vomiting</Label>
              <Switch checked={form.vomiting} onCheckedChange={v => update('vomiting', v)} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Constipation</Label>
              <Switch checked={form.constipation} onCheckedChange={v => update('constipation', v)} />
            </div>
          </div>

          <Button onClick={handleSubmit} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {editingId ? 'Update Record' : 'Save Entry'}
          </Button>
        </CardContent>
      </Card>

      {/* History */}
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
                      {record.feedBags} bags · {record.weight}kg · BP {record.bpSystolic}/{record.bpDiastolic}
                      {record.stoolPassed ? ` · Stool ×${record.stoolCount}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(record)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { onDelete(record.id); toast.success('Record deleted'); }}>
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
