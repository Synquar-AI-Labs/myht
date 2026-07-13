import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Check, ChevronDown } from 'lucide-react';
import { useMedicines, Medicine } from '@/hooks/useMedicines';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAppointments } from '@/hooks/useAppointments';
import { useWrittenNotes } from '@/hooks/useWrittenNotes';
import { useCustomActions, CustomAction } from '@/hooks/useCustomActions';
import { QuickLogSheet } from '@/components/QuickLogSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppointmentForm } from '@/types/health';
import {
  buildGivenList, buildUpcomingList, previousDay, timeLabel, doseLabel, GivenItem,
} from '@/components/today/todaySchedule';
import { ReadingSection, MedicineSection, ApptNotesSection, TrendsSection } from '@/components/today/TodaySections';
import { ReadingType } from '@/components/today/readingTypes';

const VISIBLE_ROWS = 4;

type SheetState =
  | { type: 'medicine'; medicine: Medicine }
  | { type: 'health'; reading: ReadingType }
  | null;

export function TodayScreen() {
  // Re-evaluate "now" every 30s: drives the clock, the 12h windows and due flags.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = format(now, 'yyyy-MM-dd');
  const yesterdayStr = previousDay(now);

  const { medicines, logs: todayLogs, addMedicineLog, deleteMedicineLog } = useMedicines(todayStr);
  const { logs: yesterdayLogs } = useMedicines(yesterdayStr);
  const { records, bpReadings, updateField, saveBpReading, getRecordByDate } = useHealthRecords();
  const { appointments, addAppointment } = useAppointments();
  const { addNote } = useWrittenNotes();
  const { actions: customActions, logs: customLogs, addAction, addLog: addCustomLog, getLogCountForAction } = useCustomActions();

  const [sheet, setSheet] = useState<SheetState>(null);
  const [customLogSheet, setCustomLogSheet] = useState<CustomAction | null>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [customActionOpen, setCustomActionOpen] = useState(false);
  const [givenExpanded, setGivenExpanded] = useState(false);
  const [upcomingExpanded, setUpcomingExpanded] = useState(false);
  const [undoTarget, setUndoTarget] = useState<GivenItem | null>(null);

  const [apptForm, setApptForm] = useState<AppointmentForm>({ date: todayStr, time: '09:00', doctorName: '', address: '', reason: '', description: '' });
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [newAction, setNewAction] = useState({ name: '', unit: '', color: 'bg-teal-500', default_value: 1, show_graph: false });
  const savedRecorder = localStorage.getItem('ht_recorder') || '';

  const allLogs = useMemo(() => [...todayLogs, ...yesterdayLogs], [todayLogs, yesterdayLogs]);
  const given = useMemo(() => buildGivenList(allLogs, medicines, now), [allLogs, medicines, now]);
  const upcoming = useMemo(() => buildUpcomingList(medicines, allLogs, now), [medicines, allLogs, now]);
  const hasDue = upcoming.some(u => u.state === 'due');

  const todayRecord = getRecordByDate(todayStr);
  // "Next" must respect time-of-day: a 9 AM appointment is not "next" at 4 PM.
  const nowTime = format(now, 'HH:mm');
  const upcomingAppointments = useMemo(
    () =>
      appointments
        .filter(a => a.date > todayStr || (a.date === todayStr && (a.time || '') >= nowTime))
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '')),
    [appointments, todayStr, nowTime],
  );

  const lastBpToday = useMemo(() => {
    const todayBp = bpReadings.filter(r => r.date === todayStr);
    return todayBp.length > 0 ? todayBp[todayBp.length - 1] : null;
  }, [bpReadings, todayStr]);
  const lastBpLabel = lastBpToday
    ? `last BP ${lastBpToday.systolic}/${lastBpToday.diastolic} at ${format(new Date(lastBpToday.created_at), 'h:mm a')}`
    : null;

  const handleHealthSave = (reading: ReadingType) => (values: Record<string, number | boolean>, recordedBy: string, date: string) => {
    if (reading.dbFields.includes('bpSystolic') && reading.dbFields.includes('bpDiastolic')) {
      saveBpReading(date, values['bpSystolic'] as number, values['bpDiastolic'] as number, recordedBy);
      return;
    }
    reading.dbFields.forEach(key => {
      let val: number | boolean = values[key] as number;
      if (key === 'vomiting') val = (values['vomitCount'] as number) > 0;
      else if (key === 'stoolPassed') val = (values['stoolCount'] as number) > 0;
      if (val !== undefined) {
        updateField(date, key, val, recordedBy);
      }
    });
  };

  const givenVisible = givenExpanded ? given : given.slice(0, VISIBLE_ROWS);
  const upcomingVisible = upcomingExpanded ? upcoming : upcoming.slice(0, VISIBLE_ROWS);

  return (
    <div className="mx-auto max-w-[560px]">
      {/* Header: date + live clock */}
      <div className="flex items-baseline justify-between px-5 pt-5">
        <h1 className="text-[26px] font-normal text-[#26201a]">{format(now, 'EEEE, MMMM d')}</h1>
        <span className="text-[17px] font-semibold text-[#8a6240]">{format(now, 'h:mm a')}</span>
      </div>

      {/* GIVEN · LAST 12 HOURS */}
      <div className="px-5 pt-[18px]">
        <div className="mb-2.5 text-sm font-bold uppercase tracking-[0.06em] text-[#2e7d4f]">
          Given · last 12 hours
        </div>
        <div className="rounded-2xl border border-[#e9e2d6] bg-white px-4 py-0.5">
          {given.length === 0 && (
            <p className="py-3 text-center text-[14px] text-[#8b8175]">Nothing given in the last 12 hours.</p>
          )}
          {givenVisible.map((g, i) => (
            <button
              key={g.log.id}
              onClick={() => setUndoTarget(g)}
              className={`flex w-full items-center gap-3 py-3 text-left ${
                i < givenVisible.length - 1 ? 'border-b border-[#f3ede2]' : ''
              }`}
            >
              <Check className="mt-0.5 h-5 w-5 flex-none self-start text-[#2e7d4f]" strokeWidth={3} />
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold leading-snug text-[#26201a]">
                  {g.medicine?.name ?? 'Unknown'}
                </span>
                {doseLabel(g.medicine) && (
                  <span className="block text-[13px] text-[#8b8175]">{doseLabel(g.medicine)}</span>
                )}
              </span>
              <span className="mt-0.5 flex-none self-start text-[13px] text-[#8b8175]">
                {timeLabel(g.at)}{g.log.recorded_by ? ` · ${g.log.recorded_by}` : ''}
              </span>
            </button>
          ))}
          {given.length > VISIBLE_ROWS && (
            <button
              onClick={() => setGivenExpanded(e => !e)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-[#f3ede2] py-[11px] text-[15px] font-semibold text-[#8a6240]"
            >
              {givenExpanded ? 'Show less' : `Show all ${given.length} given`}
              <ChevronDown className={`h-4 w-4 transition-transform ${givenExpanded ? 'rotate-180' : ''}`} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* COMING UP · NEXT 12 HOURS */}
      <div className="px-5 pt-[22px]">
        <div className="mb-2.5 flex items-center gap-2">
          {hasDue && <span className="animate-due-dot h-2.5 w-2.5 rounded-full bg-[#c2410c]" />}
          <span className="text-sm font-bold uppercase tracking-[0.06em] text-[#c2410c]">
            Coming up · next 12 hours
          </span>
        </div>
        <div className="rounded-2xl border-[1.5px] border-[#f0c9ae] bg-white px-4 py-0.5">
          {upcoming.length === 0 && (
            <p className="py-3 text-center text-[14px] text-[#8b8175]">Nothing scheduled in the next 12 hours.</p>
          )}
          {upcomingVisible.map((u, i) => {
            const highlighted = u.state !== 'scheduled';
            return (
              <button
                key={`${u.medicine.id}-${u.at.getTime()}`}
                onClick={() => setSheet({ type: 'medicine', medicine: u.medicine })}
                className={
                  highlighted
                    ? `-mx-2.5 my-0.5 flex w-[calc(100%+20px)] items-center gap-3 rounded-xl px-2.5 py-3 text-left ${
                        u.state === 'due' ? 'animate-due-flash-row' : 'bg-[rgba(194,65,12,0.08)]'
                      }`
                    : `flex w-full items-center gap-3 py-3 text-left ${
                        i < upcomingVisible.length - 1 ? 'border-b border-[#f3ede2]' : ''
                      }`
                }
              >
                <span className={`mt-0.5 w-[70px] flex-none self-start text-sm ${highlighted ? 'font-extrabold text-[#c2410c]' : 'font-bold text-[#8a6240]'}`}>
                  {timeLabel(u.at)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold leading-snug text-[#26201a]">
                    {u.medicine.name}
                  </span>
                  {doseLabel(u.medicine) && (
                    <span className="block text-[13px] text-[#8b8175]">{doseLabel(u.medicine)}</span>
                  )}
                </span>
                {u.state === 'due' && (
                  <span className="animate-due-pulse flex-none rounded-lg bg-[#c2410c] px-2 py-1 text-xs font-extrabold uppercase tracking-[0.05em] text-white">
                    Due
                  </span>
                )}
                {u.state === 'overdue' && (
                  <span className="flex-none rounded-lg border border-[#c2410c] px-2 py-1 text-xs font-extrabold uppercase tracking-[0.05em] text-[#c2410c]">
                    Overdue
                  </span>
                )}
              </button>
            );
          })}
          {upcoming.length > VISIBLE_ROWS && (
            <button
              onClick={() => setUpcomingExpanded(e => !e)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-[#f3ede2] py-[11px] text-[15px] font-semibold text-[#8a6240]"
            >
              {upcomingExpanded ? 'Show less' : `Show all ${upcoming.length} upcoming`}
              <ChevronDown className={`h-4 w-4 transition-transform ${upcomingExpanded ? 'rotate-180' : ''}`} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible sections */}
      <div className="flex flex-col gap-2 px-5 pb-6 pt-[22px]">
        <ReadingSection
          todayRecord={todayRecord}
          lastBpLabel={lastBpLabel}
          customActions={customActions}
          getLogCountForAction={getLogCountForAction}
          todayStr={todayStr}
          onPickReading={rt => setSheet({ type: 'health', reading: rt })}
          onPickCustomAction={ca => setCustomLogSheet(ca)}
          onAddCustomAction={() => {
            setNewAction({ name: '', unit: '', color: 'bg-teal-500', default_value: 1, show_graph: false });
            setCustomActionOpen(true);
          }}
        />
        <MedicineSection
          medicines={medicines}
          todayLogs={todayLogs}
          given={given}
          upcoming={upcoming}
          onPickMedicine={med => setSheet({ type: 'medicine', medicine: med })}
        />
        <ApptNotesSection
          nextAppointments={upcomingAppointments}
          onAddAppointment={() => {
            setApptForm({ date: todayStr, time: '09:00', doctorName: '', address: '', reason: '', description: '' });
            setApptOpen(true);
          }}
          onAddNote={() => { setNoteTitle(''); setNoteContent(''); setNoteOpen(true); }}
        />
        <TrendsSection records={records} customActions={customActions} customLogs={customLogs} />
      </div>

      {/* Log drawers (existing components) */}
      {sheet?.type === 'medicine' && (
        <QuickLogSheet open onOpenChange={o => { if (!o) setSheet(null); }}
          mode={{ type: 'medicine', medicineName: sheet.medicine.name, medicineId: sheet.medicine.id, medicineAmount: sheet.medicine.amount, onSave: addMedicineLog }} />
      )}
      {sheet?.type === 'health' && (
        <QuickLogSheet open onOpenChange={o => { if (!o) setSheet(null); }}
          mode={{ type: 'health', metric: sheet.reading.metric, fields: sheet.reading.fields, onSave: handleHealthSave(sheet.reading) }} />
      )}
      {customLogSheet && (
        <QuickLogSheet
          open
          onOpenChange={o => { if (!o) setCustomLogSheet(null); }}
          mode={{
            type: 'health',
            metric: customLogSheet.name,
            fields: [{ key: 'value', label: customLogSheet.unit || 'Value', defaultValue: customLogSheet.default_value, min: 0 }],
            onSave: (values, recordedBy, date, time) => {
              addCustomLog({
                action_id: customLogSheet.id,
                value: values['value'] as number,
                date,
                recorded_by: recordedBy,
                hour: time.hour,
                am_pm: time.amPm,
              });
            },
          }}
        />
      )}

      {/* Undo a given entry */}
      <AlertDialog open={!!undoTarget} onOpenChange={o => { if (!o) setUndoTarget(null); }}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {undoTarget?.medicine?.name} · {undoTarget ? timeLabel(undoTarget.at) : ''}
              {undoTarget?.log.recorded_by ? ` · by ${undoTarget.log.recorded_by}` : ''}.
              This permanently removes it from the record. To change the time
              or details instead, use History → Record → Medicines.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (undoTarget) deleteMedicineLog(undoTarget.log.id); setUndoTarget(null); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Appointment dialog */}
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

      {/* Note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Recorded By</Label><Input value={savedRecorder} readOnly className="bg-muted text-xs" placeholder="Set when logging" /></div>
            <div className="space-y-1"><Label className="text-xs">Title (optional)</Label><Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="e.g. Doctor visit notes" /></div>
            <div className="space-y-1"><Label className="text-xs">Note</Label><Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write your note here…" rows={4} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!noteContent.trim()} onClick={async () => { await addNote(noteTitle, noteContent, savedRecorder || 'Unknown'); setNoteOpen(false); }}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create custom action dialog */}
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
              <input type="checkbox" id="today-show-graph" checked={newAction.show_graph} onChange={e => setNewAction(p => ({ ...p, show_graph: e.target.checked }))} className="rounded" />
              <Label htmlFor="today-show-graph" className="text-xs">Add a graph for this action?</Label>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button className="w-full" disabled={!newAction.name.trim()} onClick={async () => { await addAction(newAction); setCustomActionOpen(false); }}>Create Action</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
