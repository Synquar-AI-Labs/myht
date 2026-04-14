import { useState, useMemo, useRef } from 'react';
import { format, subDays } from 'date-fns';
import { useMedicines, Medicine } from '@/hooks/useMedicines';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAppointments } from '@/hooks/useAppointments';
import { useTranscripts } from '@/hooks/useTranscripts';
import { QuickLogSheet, HealthField } from '@/components/QuickLogSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Droplets, Heart, Activity, CircleDot, Weight, Waves, Pill, CalendarPlus, Upload, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { AppointmentForm } from '@/types/health';

const today = () => format(new Date(), 'yyyy-MM-dd');

type SheetState =
  | { type: 'medicine'; medicine: Medicine }
  | { type: 'health'; metric: string; fields: HealthField[]; dbFields: string[] }
  | null;

const HEALTH_BUTTONS: {
  label: string;
  metric: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  fields: HealthField[];
  dbFields: string[];
}[] = [
  { label: 'Feed', metric: 'Feed Bags', icon: Droplets, color: 'bg-blue-500', fields: [{ key: 'feedBags', label: 'Bag count', defaultValue: 1, min: 0 }], dbFields: ['feedBags'] },
  { label: 'BP', metric: 'Blood Pressure', icon: Heart, color: 'bg-red-500', fields: [{ key: 'bpSystolic', label: 'Systolic', defaultValue: 120, min: 50, max: 250 }, { key: 'bpDiastolic', label: 'Diastolic', defaultValue: 80, min: 30, max: 150 }], dbFields: ['bpSystolic', 'bpDiastolic'] },
  { label: 'Vomit', metric: 'Vomiting', icon: Activity, color: 'bg-orange-500', fields: [{ key: 'vomitCount', label: 'Count', defaultValue: 1, min: 0 }], dbFields: ['vomitCount', 'vomiting'] },
  { label: 'Poop', metric: 'Stool', icon: CircleDot, color: 'bg-amber-700', fields: [{ key: 'stoolCount', label: 'Count', defaultValue: 1, min: 0 }], dbFields: ['stoolCount', 'stoolPassed'] },
  { label: 'Weight', metric: 'Weight', icon: Weight, color: 'bg-green-500', fields: [{ key: 'weight', label: 'Weight (kg)', defaultValue: 0, min: 0 }], dbFields: ['weight'] },
  { label: 'Flush', metric: 'Flush', icon: Waves, color: 'bg-cyan-500', fields: [{ key: 'flushCount', label: 'Flush count', defaultValue: 1, min: 0 }], dbFields: ['flushCount'] },
];

export function QuickLogTab() {
  const todayStr = today();
  const { medicines, logs, addMedicineLog } = useMedicines(todayStr);
  const { records, updateField, getRecordByDate } = useHealthRecords();
  const { addAppointment } = useAppointments();
  const { processAudio, processing } = useTranscripts();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [apptForm, setApptForm] = useState<AppointmentForm>({ date: todayStr, time: '09:00', doctorName: '', address: '', reason: '', description: '' });
  const [voiceTitle, setVoiceTitle] = useState('');
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const savedRecorder = localStorage.getItem('ht_recorder') || '';

  const todayRecord = getRecordByDate(todayStr);

  // Count medicine logs per medicine for today
  const medLogCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => { counts[l.medicine_id] = (counts[l.medicine_id] || 0) + 1; });
    return counts;
  }, [logs]);

  // Weekly chart data (last 7 days)
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
      const r = records.find(rec => rec.date === d);
      return {
        day: format(subDays(new Date(), 6 - i), 'EEE'),
        feeds: r?.feed_bags ?? 0,
        vomit: r?.vomit_count ?? 0,
        stool: r?.stool_count ?? 0,
        flush: r?.flush_count ?? 0,
      };
    });
  }, [records]);

  const handleHealthSave = (dbFieldKeys: string[]) => (values: Record<string, number | boolean>, recordedBy: string) => {
    dbFieldKeys.forEach(key => {
      let val: number | boolean = values[key] as number;
      // Auto-set boolean flags
      if (key === 'vomiting') val = (values['vomitCount'] as number) > 0;
      else if (key === 'stoolPassed') val = (values['stoolCount'] as number) > 0;
      if (val !== undefined) {
        updateField(todayStr, key, val, recordedBy);
      }
    });
  };

  return (
    <div className="space-y-5 pb-4">
      {/* Today's Summary */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Feeds', value: todayRecord?.feed_bags ?? 0 },
          { label: 'BP', value: todayRecord ? `${todayRecord.bp_systolic}/${todayRecord.bp_diastolic}` : '—' },
          { label: 'Vomit', value: todayRecord?.vomit_count ?? 0 },
          { label: 'Poop', value: todayRecord?.stool_count ?? 0 },
          { label: 'Flush', value: todayRecord?.flush_count ?? 0 },
        ].map(s => (
          <div key={s.label} className="rounded-lg border bg-card p-2 text-center">
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
            <div className="text-sm font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Health Event Buttons */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-2">
          {HEALTH_BUTTONS.map(btn => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={() => setSheet({ type: 'health', metric: btn.metric, fields: btn.fields, dbFields: btn.dbFields })}
                className={`${btn.color} text-white rounded-xl p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-xs font-medium">{btn.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Medicine Buttons */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">Medicines</h3>
        <div className="grid grid-cols-3 gap-2">
          {medicines.map(med => {
            const count = medLogCounts[med.id] || 0;
            return (
              <button
                key={med.id}
                onClick={() => setSheet({ type: 'medicine', medicine: med })}
                className="relative rounded-xl border bg-card p-2.5 text-left active:scale-95 transition-transform"
              >
                <Pill className="h-3.5 w-3.5 text-muted-foreground mb-1" />
                <div className="text-xs font-medium leading-tight truncate">{med.name}</div>
                {med.schedule_note && (
                  <div className="text-[9px] text-muted-foreground truncate">{med.schedule_note}</div>
                )}
                {count > 0 && (
                  <Badge variant="secondary" className="absolute top-1.5 right-1.5 h-5 min-w-5 text-[10px] px-1 justify-center">
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Weekly Mini Chart */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">7-Day Overview</h3>
        <div className="rounded-xl border bg-card p-3 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="feeds" fill="hsl(200, 40%, 50%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="vomit" fill="hsl(15, 70%, 55%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="stool" fill="hsl(145, 35%, 45%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="flush" fill="hsl(185, 50%, 45%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sheet */}
      {sheet?.type === 'medicine' && (
        <QuickLogSheet
          open
          onOpenChange={o => { if (!o) setSheet(null); }}
          mode={{
            type: 'medicine',
            medicineName: sheet.medicine.name,
            medicineId: sheet.medicine.id,
            onSave: addMedicineLog,
          }}
        />
      )}
      {sheet?.type === 'health' && (
        <QuickLogSheet
          open
          onOpenChange={o => { if (!o) setSheet(null); }}
          mode={{
            type: 'health',
            metric: sheet.metric,
            fields: sheet.fields,
            onSave: handleHealthSave(sheet.dbFields),
          }}
        />
      )}
    </div>
  );
}
