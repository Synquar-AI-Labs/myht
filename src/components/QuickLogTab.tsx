import { useState, useMemo, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { useMedicines, Medicine } from '@/hooks/useMedicines';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAppointments } from '@/hooks/useAppointments';
import { useWrittenNotes } from '@/hooks/useWrittenNotes';
import { useCustomActions } from '@/hooks/useCustomActions';
import { CalendarDays } from 'lucide-react';
import { QuickLogSheet, HealthField } from '@/components/QuickLogSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Droplets, Heart, Activity, CircleDot, Weight, Waves, Pill, CalendarPlus, StickyNote, Beaker, FlaskConical, ChevronLeft, ChevronRight, Clock, Plus, Trash2, Zap } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
  { label: 'Bile', metric: 'Bile Bags', icon: FlaskConical, color: 'bg-yellow-600', fields: [{ key: 'bileBags', label: 'Bag count', defaultValue: 1, min: 0 }], dbFields: ['bileBags'] },
  { label: 'BP', metric: 'Blood Pressure', icon: Heart, color: 'bg-red-500', fields: [{ key: 'bpSystolic', label: 'Systolic', defaultValue: 120, min: 50, max: 250 }, { key: 'bpDiastolic', label: 'Diastolic', defaultValue: 80, min: 30, max: 150 }], dbFields: ['bpSystolic', 'bpDiastolic'] },
  { label: 'Vomit', metric: 'Vomiting', icon: Activity, color: 'bg-orange-500', fields: [{ key: 'vomitCount', label: 'Count', defaultValue: 1, min: 0 }], dbFields: ['vomitCount', 'vomiting'] },
  { label: 'Stool', metric: 'Stool', icon: CircleDot, color: 'bg-amber-700', fields: [{ key: 'stoolCount', label: 'Count', defaultValue: 1, min: 0 }], dbFields: ['stoolCount', 'stoolPassed'] },
  { label: 'Urine', metric: 'Urine', icon: Beaker, color: 'bg-yellow-500', fields: [{ key: 'urineCount', label: 'Count', defaultValue: 1, min: 0 }], dbFields: ['urineCount'] },
  { label: 'Weight', metric: 'Weight', icon: Weight, color: 'bg-green-500', fields: [{ key: 'weight', label: 'Weight (kg)', defaultValue: 0, min: 0 }], dbFields: ['weight'] },
  { label: 'Flush', metric: 'Flush', icon: Waves, color: 'bg-cyan-500', fields: [{ key: 'flushMl', label: 'Water (ml)', defaultValue: 500, min: 0 }], dbFields: ['flushMl'] },
];

const CATEGORIES: { name: string; keys: string[]; color: string; borderColor: string; bgColor: string; darkBg: string; darkBorder: string; iconColor: string }[] = [
  { name: 'Pain Killers', keys: ['hydromorphone', 'pregabalin', 'acetaminophen'], color: 'text-red-500', borderColor: 'border-red-200', bgColor: 'bg-red-50', darkBg: 'dark:bg-red-950/20', darkBorder: 'dark:border-red-900', iconColor: 'text-red-400' },
  { name: 'Anti-Nausea', keys: ['metoclopramide', 'ondansetron', 'olanzapine'], color: 'text-orange-500', borderColor: 'border-orange-200', bgColor: 'bg-orange-50', darkBg: 'dark:bg-orange-950/20', darkBorder: 'dark:border-orange-900', iconColor: 'text-orange-400' },
  { name: 'Cancer', keys: ['lenvima'], color: 'text-purple-500', borderColor: 'border-purple-200', bgColor: 'bg-purple-50', darkBg: 'dark:bg-purple-950/20', darkBorder: 'dark:border-purple-900', iconColor: 'text-purple-400' },
  { name: 'Diabetes', keys: ['jardiance', 'jordiance', 'trajenta', 'trijenta'], color: 'text-blue-500', borderColor: 'border-blue-200', bgColor: 'bg-blue-50', darkBg: 'dark:bg-blue-950/20', darkBorder: 'dark:border-blue-900', iconColor: 'text-blue-400' },
  { name: 'Blood Thinner', keys: ['apixaban'], color: 'text-rose-500', borderColor: 'border-rose-200', bgColor: 'bg-rose-50', darkBg: 'dark:bg-rose-950/20', darkBorder: 'dark:border-rose-900', iconColor: 'text-rose-400' },
  { name: 'Thyroid', keys: ['apo-levo', 'apolevo'], color: 'text-teal-500', borderColor: 'border-teal-200', bgColor: 'bg-teal-50', darkBg: 'dark:bg-teal-950/20', darkBorder: 'dark:border-teal-900', iconColor: 'text-teal-400' },
  { name: 'Pancreas', keys: ['cotazym'], color: 'text-amber-500', borderColor: 'border-amber-200', bgColor: 'bg-amber-50', darkBg: 'dark:bg-amber-950/20', darkBorder: 'dark:border-amber-900', iconColor: 'text-amber-400' },
  { name: 'Digestion', keys: ['sennoside', 'sennocide', 'restoralax', 'restrolax'], color: 'text-green-500', borderColor: 'border-green-200', bgColor: 'bg-green-50', darkBg: 'dark:bg-green-950/20', darkBorder: 'dark:border-green-900', iconColor: 'text-green-400' },
  { name: 'Diarrhea', keys: ['loperamide', 'teva-loperamide'], color: 'text-indigo-500', borderColor: 'border-indigo-200', bgColor: 'bg-indigo-50', darkBg: 'dark:bg-indigo-950/20', darkBorder: 'dark:border-indigo-900', iconColor: 'text-indigo-400' },
];

interface QuickLogTabProps {
  appointmentsData: ReturnType<typeof useAppointments>;
}

export function QuickLogTab({ appointmentsData }: QuickLogTabProps) {
  const todayStr = today();
  const { medicines, logs, addMedicineLog } = useMedicines(todayStr);
  const { records, updateField, getRecordByDate, saveBpReading } = useHealthRecords();
  const { appointments, addAppointment, getUpcoming } = appointmentsData;
  const { addNote } = useWrittenNotes();
  const { actions: customActions, logs: customLogs, addAction, deleteAction, addLog: addCustomLog, getLogCountForAction } = useCustomActions();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [customActionOpen, setCustomActionOpen] = useState(false);
  const [customLogSheet, setCustomLogSheet] = useState<{ actionId: string; name: string; unit: string; defaultValue: number } | null>(null);
  const [newAction, setNewAction] = useState({ name: '', unit: '', color: 'bg-teal-500', default_value: 1, show_graph: false });
  const [apptForm, setApptForm] = useState<AppointmentForm>({ date: todayStr, time: '09:00', doctorName: '', address: '', reason: '', description: '' });
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const savedRecorder = localStorage.getItem('ht_recorder') || '';
  const [weekOffset, setWeekOffset] = useState(0);

  const todayRecord = getRecordByDate(todayStr);

  const medLogCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(l => { counts[l.medicine_id] = (counts[l.medicine_id] || 0) + 1; });
    return counts;
  }, [logs]);

  const chartData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // days since Monday
    const thisMonday = subDays(today, mondayOffset);
    const weekStart = subDays(thisMonday, weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(weekStart, -i);
      const d = format(date, 'yyyy-MM-dd');
      const r = records.find(rec => rec.date === d);
      return {
        label: `${format(date, 'EEE')}\n${format(date, 'd/M')}`,
        feeds: r?.feed_bags ?? 0,
        vomit: r?.vomit_count ?? 0,
        stool: r?.stool_count ?? 0,
        flush: (r as any)?.flush_ml ?? r?.flush_count ?? 0,
        bpSys: r?.bp_systolic ?? null,
        bpDia: r?.bp_diastolic ?? null,
        weight: r?.weight ?? null,
      };
    });
  }, [records, weekOffset]);

  const weekRangeLabel = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const thisMonday = subDays(today, mondayOffset);
    const weekStart = subDays(thisMonday, weekOffset * 7);
    const weekEnd = subDays(weekStart, -6);
    return `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;
  }, [weekOffset]);

  const handleHealthSave = (dbFieldKeys: string[]) => (values: Record<string, number | boolean>, recordedBy: string, date: string) => {
    // Handle BP separately — save individual reading & average
    if (dbFieldKeys.includes('bpSystolic') && dbFieldKeys.includes('bpDiastolic')) {
      const sys = values['bpSystolic'] as number;
      const dia = values['bpDiastolic'] as number;
      saveBpReading(date, sys, dia, recordedBy);
      return;
    }
    dbFieldKeys.forEach(key => {
      let val: number | boolean = values[key] as number;
      if (key === 'vomiting') val = (values['vomitCount'] as number) > 0;
      else if (key === 'stoolPassed') val = (values['stoolCount'] as number) > 0;
      if (val !== undefined) {
        updateField(date, key, val, recordedBy);
      }
    });
  };

  // Categorize medicines
  const medWithCat = useMemo(() => {
    const categorized = new Set<string>();
    const result: { med: Medicine; cat: typeof CATEGORIES[0] | null }[] = [];
    CATEGORIES.forEach(cat => {
      const meds = medicines.filter(m => cat.keys.some(k => m.name.toLowerCase().includes(k)));
      meds.forEach(m => { categorized.add(m.id); result.push({ med: m, cat }); });
    });
    medicines.filter(m => !categorized.has(m.id)).forEach(m => result.push({ med: m, cat: null }));
    return result;
  }, [medicines]);

  const summaryItems = [
    { label: 'Feed', value: todayRecord?.feed_bags ?? 0 },
    { label: 'Bile', value: (todayRecord as any)?.bile_bags ?? 0 },
    { label: 'BP (avg)', value: todayRecord ? `${todayRecord.bp_systolic}/${todayRecord.bp_diastolic}` : '—' },
    { label: 'Vomit', value: todayRecord?.vomit_count ?? 0 },
    { label: 'Stool', value: todayRecord?.stool_count ?? 0 },
    { label: 'Urine', value: (todayRecord as any)?.urine_count ?? 0 },
    { label: 'Flush', value: `${(todayRecord as any)?.flush_ml ?? 0}ml` },
    { label: 'Weight', value: todayRecord?.weight ? `${todayRecord.weight}kg` : '—' },
  ];

  const currentTime = format(new Date(), 'h:mm a');
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  // ─── MOBILE LAYOUT (default, stacked) ───
  const mobileLayout = (
    <div className="space-y-5 pb-4 md:hidden">
      {/* Date header */}
      <div className="text-center">
        <div className="text-sm font-semibold">{currentDate}</div>
        <div className="text-xs text-muted-foreground">{currentTime}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {summaryItems.map(s => (
          <div key={s.label} className="rounded-lg border bg-card p-2 text-center">
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
            <div className="text-sm font-semibold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Upcoming Appointments (next 5 days) */}
      {(() => {
        const fiveDaysOut = format(new Date(Date.now() + 5 * 86400000), 'yyyy-MM-dd');
        const todayDate = today();
        const upcoming = appointments.filter(a => a.date >= todayDate && a.date <= fiveDaysOut);
        if (upcoming.length === 0) return null;
        return (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Upcoming Appointments</h3>
            <div className="space-y-1.5">
              {upcoming.map(a => (
                <div key={a.id} className="rounded-lg border bg-card p-2 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{a.doctor_name}</div>
                    <div className="text-[10px] text-muted-foreground">{format(new Date(a.date + 'T00:00'), 'EEE, MMM d')} · {a.time} — {a.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
          {/* Custom action buttons */}
          {customActions.map(ca => {
            const count = getLogCountForAction(ca.id, todayStr);
            return (
              <button
                key={ca.id}
                onClick={() => setCustomLogSheet({ actionId: ca.id, name: ca.name, unit: ca.unit, defaultValue: ca.default_value })}
                className={`${ca.color} text-white rounded-xl p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform relative`}
              >
                <Zap className="h-5 w-5" />
                <span className="text-xs font-medium">{ca.name}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="absolute top-1 right-1 h-4 min-w-4 text-[9px] px-0.5 justify-center">{count}</Badge>
                )}
              </button>
            );
          })}
          {/* Add new action button */}
          <button
            onClick={() => { setNewAction({ name: '', unit: '', color: 'bg-teal-500', default_value: 1, show_graph: false }); setCustomActionOpen(true); }}
            className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform text-muted-foreground"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-medium">Add New</span>
          </button>
        </div>
      </div>

      {/* Medicine Buttons */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">Medicines</h3>
        <div className="grid grid-cols-3 gap-2">
          {medWithCat.map(({ med, cat }) => {
            const count = medLogCounts[med.id] || 0;
            return (
              <button
                key={med.id}
                onClick={() => setSheet({ type: 'medicine', medicine: med })}
                className={`relative rounded-xl border p-2 text-left active:scale-95 transition-transform ${cat ? `${cat.borderColor} ${cat.bgColor} ${cat.darkBg} ${cat.darkBorder}` : 'bg-card'}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <Pill className={`h-3 w-3 ${cat ? cat.iconColor : 'text-muted-foreground'}`} />
                  {cat && <span className={`text-[7px] font-bold uppercase tracking-wider ${cat.color}`}>{cat.name}</span>}
                </div>
                <div className="text-[10px] font-medium leading-tight truncate">{med.name}</div>
                {med.schedule_note && <div className="text-[8px] text-muted-foreground truncate">{med.schedule_note}</div>}
                {count > 0 && (
                  <Badge variant="secondary" className="absolute top-1 right-1 h-4 min-w-4 text-[9px] px-0.5 justify-center">{count}</Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* More Actions */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground mb-2">More Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => { setApptForm({ date: todayStr, time: '09:00', doctorName: '', address: '', reason: '', description: '' }); setApptOpen(true); }}
            className="bg-purple-500 text-white rounded-xl p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <CalendarPlus className="h-5 w-5" /><span className="text-xs font-medium">Appointment</span>
          </button>
          <button onClick={() => { setNoteTitle(''); setNoteContent(''); setNoteOpen(true); }}
            className="bg-indigo-500 text-white rounded-xl p-3 flex flex-col items-center gap-1 active:scale-95 transition-transform">
            <StickyNote className="h-5 w-5" /><span className="text-xs font-medium">Written Note</span>
          </button>
        </div>
      </div>

      {/* Weekly Charts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-1 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <h3 className="text-xs font-medium text-muted-foreground">{weekRangeLabel}</h3>
          <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>

        {/* Main metrics chart */}
        <div className="rounded-xl border bg-card p-3 h-44 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={25} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Bar dataKey="feeds" name="Feeds" fill="hsl(200, 40%, 50%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="vomit" name="Vomit" fill="hsl(15, 70%, 55%)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="stool" name="Stool" fill="hsl(145, 35%, 45%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Flush chart */}
        <div className="rounded-xl border bg-card p-3 h-36 mb-3">
          <h4 className="text-[10px] font-medium text-muted-foreground mb-1">Flush (ml)</h4>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="flush" name="Flush (ml)" fill="hsl(185, 50%, 45%)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* BP chart */}
        <div className="rounded-xl border bg-card p-3 h-36">
          <h4 className="text-[10px] font-medium text-muted-foreground mb-1">Blood Pressure (avg)</h4>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} domain={[40, 200]} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
              <Line type="monotone" dataKey="bpSys" name="Systolic" stroke="hsl(0, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              <Line type="monotone" dataKey="bpDia" name="Diastolic" stroke="hsl(220, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Weight chart */}
        <div className="rounded-xl border bg-card p-3 h-36">
          <h4 className="text-[10px] font-medium text-muted-foreground mb-1">Weight (kg)</h4>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={chartData}>
              <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="weight" name="Weight" stroke="hsl(145, 50%, 45%)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Custom action charts */}
        {customActions.filter(ca => ca.show_graph).map(ca => {
          const today = new Date();
          const dayOfWeek = today.getDay();
          const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const thisMonday = subDays(today, mondayOffset);
          const weekStart = subDays(thisMonday, weekOffset * 7);
          const caChartData = Array.from({ length: 7 }, (_, i) => {
            const date = subDays(weekStart, -i);
            const d = format(date, 'yyyy-MM-dd');
            const dayLogs = customLogs.filter(l => l.action_id === ca.id && l.date === d);
            const total = dayLogs.reduce((sum, l) => sum + Number(l.value), 0);
            return { label: `${format(date, 'EEE')}\n${format(date, 'd/M')}`, value: total };
          });
          return (
            <div key={ca.id} className="rounded-xl border bg-card p-3 h-36">
              <h4 className="text-[10px] font-medium text-muted-foreground mb-1">{ca.name}{ca.unit ? ` (${ca.unit})` : ''}</h4>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={caChartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" name={ca.name} fill="hsl(180, 50%, 45%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );

  const upcomingAppts = getUpcoming().slice(0, 5);

  // ─── TABLET LANDSCAPE LAYOUT (single screen, no scroll) ───
  const tabletLayout = (
    <div className="hidden md:grid md:grid-cols-[260px_1fr] md:gap-3 md:h-[calc(100dvh-6rem)] md:overflow-hidden">
      {/* LEFT COLUMN: Time + Summary + Quick Actions + Appt/Notes + Recorder */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        {/* Date & Time */}
        <div className="rounded-xl border bg-card p-2 text-center">
          <div className="flex items-center justify-center gap-1.5 text-primary">
            <Clock className="h-4 w-4" />
            <span className="text-lg font-bold">{currentTime}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{currentDate}</div>
        </div>

        {/* Today's Summary */}
        <div className="rounded-xl border bg-card p-2">
          <h3 className="text-[10px] font-medium text-muted-foreground mb-1 px-1">Today's Summary</h3>
          <div className="grid grid-cols-2 gap-1">
            {summaryItems.map(s => (
              <div key={s.label} className="rounded-lg bg-muted/50 p-1 text-center">
                <div className="text-[9px] text-muted-foreground">{s.label}</div>
                <div className="text-xs font-semibold">{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border bg-card p-2">
          <h3 className="text-[10px] font-medium text-muted-foreground mb-1.5 px-1">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {HEALTH_BUTTONS.map(btn => {
              const Icon = btn.icon;
              return (
                <button
                  key={btn.label}
                  onClick={() => setSheet({ type: 'health', metric: btn.metric, fields: btn.fields, dbFields: btn.dbFields })}
                  className={`${btn.color} text-white rounded-lg p-2 flex flex-col items-center gap-0.5 active:scale-95 transition-transform`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-medium">{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Appointment & Note */}
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={() => { setApptForm({ date: todayStr, time: '09:00', doctorName: '', address: '', reason: '', description: '' }); setApptOpen(true); }}
            className="bg-purple-500 text-white rounded-lg p-2 flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
            <CalendarPlus className="h-4 w-4" /><span className="text-[10px] font-medium">Appointment</span>
          </button>
          <button onClick={() => { setNoteTitle(''); setNoteContent(''); setNoteOpen(true); }}
            className="bg-indigo-500 text-white rounded-lg p-2 flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
            <StickyNote className="h-4 w-4" /><span className="text-[10px] font-medium">Written Note</span>
          </button>
        </div>

        {/* Recorder Info */}
        <div className="rounded-xl border bg-card p-1.5 mt-auto">
          <div className="text-[9px] text-muted-foreground">Logged by</div>
          <div className="text-xs font-medium">{savedRecorder || 'Not set'}</div>
        </div>
      </div>

      {/* RIGHT COLUMN: Row1 = Medicines, Row2 = [Chart | Upcoming] */}
      <div className="flex flex-col gap-3 overflow-hidden">
        {/* Row 1: Medicines */}
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border bg-card p-2">
          <h3 className="text-[10px] font-medium text-muted-foreground mb-2 px-1">Medicines</h3>
          <div className="grid grid-cols-4 gap-1.5">
            {medWithCat.map(({ med, cat }) => {
              const count = medLogCounts[med.id] || 0;
              return (
                <button
                  key={med.id}
                  onClick={() => setSheet({ type: 'medicine', medicine: med })}
                  className={`relative rounded-lg border p-1.5 text-left active:scale-95 transition-transform ${cat ? `${cat.borderColor} ${cat.bgColor} ${cat.darkBg} ${cat.darkBorder}` : 'bg-background'}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <Pill className={`h-2.5 w-2.5 ${cat ? cat.iconColor : 'text-muted-foreground'}`} />
                    {cat && <span className={`text-[8px] font-bold uppercase tracking-wider ${cat.color}`}>{cat.name}</span>}
                  </div>
                  <div className="text-xs font-medium leading-tight truncate">{med.name}</div>
                  {med.schedule_note && <div className="text-[9px] text-muted-foreground truncate">{med.schedule_note}</div>}
                  {count > 0 && (
                    <Badge variant="secondary" className="absolute top-0.5 right-0.5 h-3.5 min-w-3.5 text-[8px] px-0.5 justify-center">{count}</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Weekly Chart + Upcoming Appointments side by side */}
        <div className="grid grid-cols-[1fr_240px] gap-3 flex-1 min-h-0">
          {/* Weekly Chart */}
          <div className="rounded-xl border bg-card p-2 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <button onClick={() => setWeekOffset(w => w + 1)} className="p-0.5 rounded hover:bg-muted"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <span className="text-[10px] font-medium text-muted-foreground">{weekRangeLabel}</span>
              <button onClick={() => setWeekOffset(w => Math.max(0, w - 1))} disabled={weekOffset === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={25} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Legend iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 2 }} />
                  <Bar dataKey="feeds" name="Feeds" fill="hsl(200, 40%, 50%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="vomit" name="Vomit" fill="hsl(15, 70%, 55%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="stool" name="Stool" fill="hsl(145, 35%, 45%)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="flush" name="Flush (ml)" fill="hsl(185, 50%, 45%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Upcoming Appointments */}
          <div className="rounded-xl border bg-card p-2 flex flex-col overflow-hidden">
            <h3 className="text-[10px] font-medium text-muted-foreground mb-1.5 px-1 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Upcoming
            </h3>
            <div className="flex-1 overflow-y-auto space-y-1">
              {upcomingAppts.length === 0 ? (
                <div className="text-[10px] text-muted-foreground text-center py-4">No upcoming appointments</div>
              ) : (
                upcomingAppts.map(appt => (
                  <div key={appt.id} className="rounded-lg bg-muted/50 p-1.5">
                    <div className="text-[9px] font-semibold truncate">{appt.doctor_name}</div>
                    <div className="text-[8px] text-muted-foreground">{format(new Date(appt.date + 'T00:00'), 'MMM d')} · {appt.time}</div>
                    <div className="text-[8px] text-muted-foreground truncate">{appt.reason}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mobileLayout}
      {tabletLayout}

      {/* Sheet */}
      {sheet?.type === 'medicine' && (
        <QuickLogSheet open onOpenChange={o => { if (!o) setSheet(null); }}
          mode={{ type: 'medicine', medicineName: sheet.medicine.name, medicineId: sheet.medicine.id, onSave: addMedicineLog }} />
      )}
      {sheet?.type === 'health' && (
        <QuickLogSheet open onOpenChange={o => { if (!o) setSheet(null); }}
          mode={{ type: 'health', metric: sheet.metric, fields: sheet.fields, onSave: handleHealthSave(sheet.dbFields) }} />
      )}

      {/* Appointment Dialog */}
      <Dialog open={apptOpen} onOpenChange={setApptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Appointment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Date</Label><Input type="date" value={apptForm.date} onChange={e => setApptForm(p => ({ ...p, date: e.target.value }))} /></div>
              <div className="space-y-1"><Label className="text-xs">Time</Label><Input type="time" value={apptForm.time} onChange={e => setApptForm(p => ({ ...p, time: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Doctor Name</Label><Input value={apptForm.doctorName} onChange={e => setApptForm(p => ({ ...p, doctorName: e.target.value }))} placeholder="Dr. Smith" /></div>
            <div className="space-y-1"><Label className="text-xs">Reason</Label><Input value={apptForm.reason} onChange={e => setApptForm(p => ({ ...p, reason: e.target.value }))} placeholder="Check-up" /></div>
            <div className="space-y-1"><Label className="text-xs">Address</Label><Input value={apptForm.address} onChange={e => setApptForm(p => ({ ...p, address: e.target.value }))} placeholder="Optional" /></div>
            <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={apptForm.description} onChange={e => setApptForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional notes" rows={2} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!apptForm.doctorName || !apptForm.reason} onClick={async () => { await addAppointment(apptForm); setApptOpen(false); }}>Save Appointment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Written Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Recorded By</Label><Input value={savedRecorder} readOnly className="bg-muted text-xs" placeholder="Set in settings" /></div>
            <div className="space-y-1"><Label className="text-xs">Title (optional)</Label><Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="e.g. Doctor visit notes" /></div>
            <div className="space-y-1"><Label className="text-xs">Note</Label><Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write your note here…" rows={4} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!noteContent.trim()} onClick={async () => { await addNote(noteTitle, noteContent, savedRecorder || 'Unknown'); setNoteOpen(false); }}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Custom Action Dialog */}
      <Dialog open={customActionOpen} onOpenChange={setCustomActionOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Quick Action</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Name</Label><Input value={newAction.name} onChange={e => setNewAction(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Temperature" /></div>
            <div className="space-y-1"><Label className="text-xs">Unit (optional)</Label><Input value={newAction.unit} onChange={e => setNewAction(p => ({ ...p, unit: e.target.value }))} placeholder="e.g. °C, ml, count" /></div>
            <div className="space-y-1"><Label className="text-xs">Default Value</Label><Input type="number" value={newAction.default_value} onChange={e => setNewAction(p => ({ ...p, default_value: Number(e.target.value) }))} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="grid grid-cols-5 gap-1.5">
                {['bg-teal-500', 'bg-pink-500', 'bg-lime-500', 'bg-violet-500', 'bg-sky-500', 'bg-rose-500', 'bg-emerald-500', 'bg-fuchsia-500', 'bg-amber-500', 'bg-slate-500'].map(c => (
                  <button key={c} onClick={() => setNewAction(p => ({ ...p, color: c }))} className={`${c} h-8 rounded-lg ${newAction.color === c ? 'ring-2 ring-offset-2 ring-foreground' : ''}`} />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="show-graph" checked={newAction.show_graph} onChange={e => setNewAction(p => ({ ...p, show_graph: e.target.checked }))} className="rounded" />
              <Label htmlFor="show-graph" className="text-xs">Add a graph for this action?</Label>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button className="w-full" disabled={!newAction.name.trim()} onClick={async () => { await addAction(newAction); setCustomActionOpen(false); }}>Create Action</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Action Log Sheet */}
      {customLogSheet && (
        <QuickLogSheet
          open
          onOpenChange={o => { if (!o) setCustomLogSheet(null); }}
          mode={{
            type: 'health',
            metric: customLogSheet.name,
            fields: [{ key: 'value', label: customLogSheet.unit || 'Value', defaultValue: customLogSheet.defaultValue, min: 0 }],
            onSave: (values, recordedBy, date) => {
              addCustomLog({
                action_id: customLogSheet.actionId,
                value: values['value'] as number,
                date,
                recorded_by: recordedBy,
                hour: new Date().getHours() > 12 ? new Date().getHours() - 12 : new Date().getHours() === 0 ? 12 : new Date().getHours(),
                am_pm: new Date().getHours() >= 12 ? 'PM' : 'AM',
              });
            },
          }}
        />
      )}
    </>
  );
}
