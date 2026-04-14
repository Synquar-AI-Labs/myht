import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RECORDER_OPTIONS } from '@/types/health';

type MedicineMode = {
  type: 'medicine';
  medicineName: string;
  medicineId: string;
  onSave: (data: { medicine_id: string; hour: number; am_pm: string; recorded_by: string; date: string }) => void;
};

type HealthMode = {
  type: 'health';
  metric: string;
  fields: HealthField[];
  onSave: (values: Record<string, number | boolean>, recordedBy: string, date: string) => void;
};

export interface HealthField {
  key: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: MedicineMode | HealthMode;
};

export function QuickLogSheet({ open, onOpenChange, mode }: Props) {
  const savedRecorder = localStorage.getItem('ht_recorder') || '';
  const [recorder, setRecorder] = useState(savedRecorder);
  const [editingTime, setEditingTime] = useState(false);

  const now = new Date();
  const currentHour = now.getHours();
  const [hour, setHour] = useState(currentHour > 12 ? currentHour - 12 : currentHour === 0 ? 12 : currentHour);
  const [amPm, setAmPm] = useState<string>(currentHour >= 12 ? 'PM' : 'AM');
  const [selectedDate, setSelectedDate] = useState(format(now, 'yyyy-MM-dd'));
  const [fieldValues, setFieldValues] = useState<Record<string, number>>({});

  const displayTime = `${hour}:00 ${amPm}`;
  const parsedDate = selectedDate ? new Date(selectedDate + 'T00:00') : null;
  const displayDate = parsedDate && !isNaN(parsedDate.getTime()) ? format(parsedDate, 'EEE, MMM d') : '—';

  useEffect(() => {
    if (open) {
      const n = new Date();
      const h = n.getHours();
      setHour(h > 12 ? h - 12 : h === 0 ? 12 : h);
      setAmPm(h >= 12 ? 'PM' : 'AM');
      setSelectedDate(format(n, 'yyyy-MM-dd'));
      setEditingTime(false);
      if (mode.type === 'health') {
        const init: Record<string, number> = {};
        mode.fields.forEach(f => { init[f.key] = f.defaultValue; });
        setFieldValues(init);
      }
    }
  }, [open, mode]);

  const handleSave = () => {
    if (!recorder) return;
    localStorage.setItem('ht_recorder', recorder);
    if (mode.type === 'medicine') {
      mode.onSave({ medicine_id: mode.medicineId, hour, am_pm: amPm, recorded_by: recorder, date: selectedDate });
    } else {
      mode.onSave(fieldValues, recorder, selectedDate);
    }
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {mode.type === 'medicine' ? `Log ${mode.medicineName}` : `Log ${mode.metric}`}
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-2 space-y-4">
          {/* Recorder */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Recorded by</Label>
            <Select value={recorder} onValueChange={setRecorder}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {RECORDER_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Date & Time display */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-muted-foreground">Date & Time</Label>
                <div className="text-sm font-medium">{displayDate} · {displayTime}</div>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setEditingTime(!editingTime)}>
                {editingTime ? 'Done' : 'Change'}
              </Button>
            </div>
            {editingTime && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">Hour</Label>
                    <Select value={String(hour)} onValueChange={v => setHour(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                          <SelectItem key={h} value={String(h)}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">AM/PM</Label>
                    <Select value={amPm} onValueChange={setAmPm}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AM">AM</SelectItem>
                        <SelectItem value="PM">PM</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {mode.type === 'health' && mode.fields.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                type="number"
                min={f.min ?? 0}
                max={f.max}
                value={fieldValues[f.key] ?? f.defaultValue}
                onChange={e => setFieldValues(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>

        <DrawerFooter>
          <Button onClick={handleSave} disabled={!recorder} className="w-full">Save</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
