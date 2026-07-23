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

const MED_TYPES = ['Pain Killer', 'Pain Relief', 'Blood Thinner', 'Digestive', 'Anti-Nausea', 'Diabetes', 'Nerve Pain', 'Thyroid', 'Psych', 'Cancer', 'Vitamin', 'Antibiotic', 'Other'];
const CATEGORIES = ['medicine', 'non-medicine'];
const FREQUENCIES = ['daily', 'as needed', 'every 2 days', 'every 3 days', 'every 4 days', 'every 5 days', 'every 6 days', 'every 7 days'];

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
};

export function MedicineScheduleTab() {
  const { medicines, loading, addMedicine, updateMedicine } = useMedicineSchedule();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<MedicineScheduleInsert>(emptyForm);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (med: typeof medicines[0]) => {
    setEditId(med.id);
    setForm({ name: med.name, potency: med.potency, amount: med.amount, med_type: med.med_type, category: med.category, schedule_time: med.schedule_time, frequency: med.frequency, schedule_note: med.schedule_note, show_in_quick_log: med.show_in_quick_log });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editId) await updateMedicine(editId, form);
    else await addMedicine(form);
    setOpen(false);
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
      // Auto-toggle quick log: medicine defaults to yes, non-medicine to no (only on category change for new items)
      if (k === 'category' && !editId) {
        updated.show_in_quick_log = v === 'medicine';
      }
      return updated;
    });
  };

  return (
    <div className="pb-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Medicine Schedule</h2>
        <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([type, meds]) => (
        <div key={type} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{type}</h3>
          {meds.map(med => (
            <Card key={med.id} className="overflow-hidden">
              <CardContent className="p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{med.name}</span>
                    {med.category === 'non-medicine' && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Non-med</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {med.potency && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{med.potency}</Badge>}
                    {med.amount && <span className="text-muted-foreground">× {med.amount}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <Badge className={`text-[10px] px-1.5 py-0 border-0 ${TYPE_COLORS[med.med_type] || 'bg-muted text-muted-foreground'}`}>{med.med_type || 'Other'}</Badge>
                    {med.schedule_time && <span className="text-muted-foreground">⏰ {med.schedule_time}</span>}
                    <span className="text-muted-foreground capitalize">({med.frequency})</span>
                  </div>
                  {med.schedule_note && <p className="text-[11px] text-muted-foreground italic">{med.schedule_note}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(med)}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{editId ? 'Edit Medicine' : 'Add Medicine'}</SheetTitle>
            <SheetDescription>Fill in the medicine details below.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Medicine name" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Potency</Label><Input value={form.potency} onChange={e => setField('potency', e.target.value)} placeholder="e.g. 500mg" /></div>
              <div><Label className="text-xs">Amount</Label><Input value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="e.g. 2 pills" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.med_type} onValueChange={v => setField('med_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
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
            <div>
              <Label className="text-xs">Schedule Time</Label>
              <Input value={form.schedule_time} onChange={e => setField('schedule_time', e.target.value)} placeholder="e.g. 10:00 AM / 9:00 PM" />
            </div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={form.frequency} onValueChange={v => setField('frequency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Input value={form.schedule_note} onChange={e => setField('schedule_note', e.target.value)} placeholder="Optional notes" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="show_in_quick_log"
                checked={form.show_in_quick_log}
                onCheckedChange={(checked) => setForm(f => ({ ...f, show_in_quick_log: !!checked }))}
              />
              <Label htmlFor="show_in_quick_log" className="text-xs cursor-pointer">Show in Quick Log</Label>
            </div>
            <Button className="w-full" onClick={handleSave}>{editId ? 'Save Changes' : 'Add Medicine'}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
