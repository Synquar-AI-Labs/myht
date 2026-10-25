import { useEffect, useMemo, useState } from 'react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { useMedicines, useLinkedDoseLogs, Medicine } from '@/hooks/useMedicines';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAppointments } from '@/hooks/useAppointments';
import { useWrittenNotes } from '@/hooks/useWrittenNotes';
import { useCaregiverChoice } from '@/hooks/useCaregiverChoice';
import { CaregiverPicker } from '@/components/CaregiverPicker';
import { useCustomActions, CustomAction } from '@/hooks/useCustomActions';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { AppointmentDialog } from '@/components/AppointmentDialog';
import {
  buildGivenList, buildUpcomingList, previousDay, timeLabel,
  GivenItem, UpcomingItem,
} from '@/components/today/todaySchedule';
import { ReadingSection, MedicineSection, ApptNotesSection, TranscriptsSection, TrendsSection } from '@/components/today/TodaySections';
import { ReadingType } from '@/components/today/readingTypes';
import { DoseTimeGroups } from '@/components/today/DoseTimeGroups';
import { RoutineTodaySections } from '@/components/routines/RoutineToday';
import { URGENCY_RANK, urgencyFor } from '@/lib/medicineUrgency';
import { MedicineDoseSheet } from '@/components/MedicineDoseSheet';
import { useDoseSkips } from '@/hooks/useDoseSkips';
import { doseCandidates } from '@/lib/doseRecording';
import { occurrenceTime, visibleSkips } from './todaySchedule';
import { TodayAlerts } from '@/components/profile/TodayAlerts';
import { TodayBarsProvider, TodayBarsButton } from '@/hooks/useTodayBars';

type SheetState =
  | { type: 'medicine'; medicine: Medicine; slot?: UpcomingItem }
  | { type: 'health'; reading: ReadingType }
  | null;

export function TodayScreen({ onOpenAbout }: { onOpenAbout?: () => void }) {
  return <TodayBarsProvider><TodayContent onOpenAbout={onOpenAbout} /></TodayBarsProvider>;
}

function TodayContent({ onOpenAbout }: { onOpenAbout?: () => void }) {
  const isMobile = useIsMobile();

  // Re-evaluate "now" every 30s: drives the clock, the 12h windows and due flags.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const todayStr = format(now, 'yyyy-MM-dd');
  const yesterdayStr = previousDay(now);
  const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

  const { medicines, medicinesLoading, medicinesError, logs: todayLogs, loading: todayLoading, loadError: todayError, deleteMedicineLog } = useMedicines(todayStr);
  const { logs: yesterdayLogs, loading: yesterdayLoading, loadError: yesterdayError } = useMedicines(yesterdayStr);
  const linkedQuery = useLinkedDoseLogs(yesterdayStr, tomorrowStr);
  const linkedLogs = linkedQuery.data ?? [];
  const { skips: todaySkips, loading: todaySkipLoading, loadError: todaySkipError, undoSkip } = useDoseSkips(todayStr);
  const { skips: yesterdaySkips, loading: yesterdaySkipLoading, loadError: yesterdaySkipError } = useDoseSkips(yesterdayStr);
  const { skips: tomorrowSkips, loading: tomorrowSkipLoading, loadError: tomorrowSkipError } = useDoseSkips(tomorrowStr);
  const doseLoading = medicinesLoading || todayLoading || yesterdayLoading || linkedQuery.isLoading || todaySkipLoading || yesterdaySkipLoading || tomorrowSkipLoading;
  const doseError = medicinesError || todayError || yesterdayError || linkedQuery.isError || todaySkipError || yesterdaySkipError || tomorrowSkipError;
  const doseReady = !doseLoading && !doseError;
  const { records, bpReadings, updateFields, saveBpReading, getRecordByDate } = useHealthRecords();
  const { appointments, addAppointment } = useAppointments();
  const { addNote } = useWrittenNotes();
  const { actions: customActions, logs: customLogs, addAction, addLog: addCustomLog, getLogCountForAction } = useCustomActions();

  const [sheet, setSheet] = useState<SheetState>(null);
  const [customLogSheet, setCustomLogSheet] = useState<CustomAction | null>(null);
  const [apptOpen, setApptOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [customActionOpen, setCustomActionOpen] = useState(false);
  const [undoTarget, setUndoTarget] = useState<GivenItem | null>(null);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [newAction, setNewAction] = useState({ name: '', unit: '', color: 'bg-teal-500', default_value: 1, show_graph: false });
  const { activeCaregivers, caregiver, selectCaregiver } = useCaregiverChoice();

  const allLogs = useMemo(() => [...new Map([...todayLogs, ...yesterdayLogs, ...linkedLogs].map(log => [log.id, log])).values()], [todayLogs, yesterdayLogs, linkedLogs]);
  const given = useMemo(() => buildGivenList(allLogs, medicines, now), [allLogs, medicines, now]);
  const allSkips = useMemo(() => [...todaySkips, ...yesterdaySkips, ...tomorrowSkips], [todaySkips, yesterdaySkips, tomorrowSkips]);
  const upcoming = useMemo(() => doseReady ? buildUpcomingList(medicines, allLogs, now, allSkips) : [], [medicines, allLogs, now, allSkips, doseReady]);
  const skipped = useMemo(() => visibleSkips(allSkips, allLogs, medicines, now).map(skip => ({ skip, at: occurrenceTime(skip), medicine: medicines.find(m => m.id === skip.medicine_id) }))
    .filter(item => item.at.getTime() >= now.getTime() - 12 * 60 * 60_000 && item.at.getTime() <= now.getTime() + 12 * 60 * 60_000), [allSkips, medicines, now, allLogs]);
  const urgentState = upcoming.reduce((state, item) => URGENCY_RANK[item.state] > URGENCY_RANK[state] ? item.state : state, 'scheduled' as UpcomingItem['state']);
  const urgency = urgencyFor(urgentState);

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

  const handleHealthSave = (reading: ReadingType) => async (values: Record<string, number | boolean>, _recordedBy: string, date: string, _time: { hour: number; amPm: string }, caregiverId?: string) => {
    if (!caregiverId) return false;
    if (reading.dbFields.includes('bpSystolic') && reading.dbFields.includes('bpDiastolic')) {
      const saved = await saveBpReading(date, values['bpSystolic'] as number, values['bpDiastolic'] as number, caregiverId);
      if (saved) {
        toast.success('BP logged');
      }
      return saved;
    }
    const fields: Record<string, number | boolean> = {};
    reading.dbFields.forEach(key => {
      if (values[key] !== undefined) fields[key] = values[key];
    });
    const saved = await updateFields(date, fields, caregiverId);
    if (saved) toast.success(`${reading.label} logged`);
    return saved;
  };

  /* ── Shared building blocks (rendered exactly once per arrangement) ── */

  const givenCard = (
    <section>
      <div className="mb-2.5 text-sm font-bold uppercase tracking-[0.06em] text-[#2e7d4f]">
        Given · last 12 hours
      </div>
      <div className="dose-card rounded-2xl border border-[#e9e2d6] bg-white px-[12px] py-0.5 md:px-4">
        {!doseReady && <p className="py-3 text-center text-sm text-[#8b8175]">{doseError ? 'Dose history unavailable. Check the connection.' : 'Loading dose history…'}</p>}
        {doseReady && given.length === 0 && skipped.length === 0 && (
          <p className="py-3 text-center text-[14px] text-[#8b8175]">Nothing given in the last 12 hours.</p>
        )}
        {doseReady && <DoseTimeGroups given={given} skipped={skipped} now={now} onGiven={setUndoTarget} onUndoSkip={id => void undoSkip(id)} />}
      </div>
    </section>
  );

  const upcomingCard = (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        {urgency && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: urgency.color }} />}
        <span className="text-sm font-bold uppercase tracking-[0.06em] text-[#c2410c]">
          Coming up · next 12 hours
        </span>
      </div>
      <div className="dose-card rounded-2xl border-[1.5px] border-[#f0c9ae] bg-white px-[12px] py-0.5 md:px-4">
        {!doseReady && <p role={doseError ? 'alert' : 'status'} className="py-3 text-center text-sm text-[#8b8175]">{doseError ? "Couldn't load doses. Check the connection." : 'Loading doses…'}</p>}
        {doseReady && upcoming.length === 0 && (
          <p className="py-3 text-center text-[14px] text-[#8b8175]">Nothing scheduled in the next 12 hours.</p>
        )}
        <DoseTimeGroups upcoming={upcoming} now={now} onUpcoming={u => setSheet({ type: 'medicine', medicine: u.medicine, slot: u })} />
      </div>
    </section>
  );

  // Five collapsed pills; charts start closed at every screen size.
  const recordPills = (
    <div className="flex flex-col gap-2">
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
        now={now}
        onPickMedicine={med => {
          if (!doseReady) { toast.error(doseError ? "Couldn't load doses. Check the connection." : 'Still loading doses. Try again.'); return; }
          setSheet({ type: 'medicine', medicine: med });
        }}
      />
      <ApptNotesSection
        nextAppointments={upcomingAppointments}
        onAddAppointment={() => setApptOpen(true)}
        onAddNote={() => { setNoteTitle(''); setNoteContent(''); setNoteOpen(true); }}
      />
      <TranscriptsSection />
      <TrendsSection records={records} customActions={customActions} customLogs={customLogs} />
    </div>
  );

  return (
    <div className={isMobile ? 'mx-auto max-w-[560px]' : 'mx-auto max-w-6xl px-8'}>
      {isMobile ? (
        <>
          {/* Header: date + live clock */}
          <div className="flex items-baseline justify-between gap-3 px-[20px] pt-5">
            <h1 className="min-w-0 text-[26px] font-normal text-[#26201a]">{format(now, 'EEEE, MMMM d')}</h1>
            <span data-today-clock className="flex-none whitespace-nowrap text-[17px] font-semibold text-[#8a6240]">{format(now, 'h:mm a')}</span>
          </div>
          <div className="px-[20px] pt-3"><TodayAlerts onOpen={() => onOpenAbout?.()} /></div>
          <div className="px-[20px]"><TodayBarsButton /></div>
          <div className="px-[20px] pt-[18px]">{givenCard}</div>
          <div className="px-[20px] pt-[22px]">{upcomingCard}</div>
          <div className="px-[20px] [&:has([data-routine-section])]:pt-[22px]"><RoutineTodaySections now={now} /></div>
          <div className="px-[20px] pb-6 pt-[22px]">
            {recordPills}
          </div>
        </>
      ) : (
        <>
          {/* Header row: date + clock left; the floating nav pills sit top-right */}
          <div className="flex flex-wrap items-baseline gap-4 pt-6 pr-[21rem]">
            <h1 className="min-w-0 max-w-full text-[32px] font-normal leading-tight text-[#26201a]">{format(now, 'EEEE, MMMM d')}</h1>
            <span className="text-[19px] font-semibold text-[#8a6240]">{format(now, 'h:mm a')}</span>
          </div>
          {/* Independent columns: schedule and given / record and review */}
          <div className="pt-3"><TodayAlerts onOpen={() => onOpenAbout?.()} /></div>
          <TodayBarsButton />
          <div className="grid grid-cols-2 items-start gap-8 pb-10 pt-7">
            <div className="space-y-8">{upcomingCard}{givenCard}<RoutineTodaySections now={now} stacked /></div>
            <div>
              <div className="mb-2.5 text-sm font-bold uppercase tracking-[0.06em] text-[#8b8175]">
                Record & review
              </div>
              {recordPills}
            </div>
          </div>
        </>
      )}

      {/* Log drawers (existing components) */}
      {sheet?.type === 'medicine' && (
        <MedicineDoseSheet medicine={sheet.medicine} slot={sheet.slot} candidates={doseCandidates(upcoming, sheet.medicine.id, now)} onClose={() => setSheet(null)} />
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
            onSave: (values, _recordedBy, date, time, caregiverId) => {
              if (!caregiverId) return;
              addCustomLog({
                action_id: customLogSheet.id,
                value: values['value'] as number,
                date,
                caregiver_id: caregiverId,
                hour: time.hour,
                am_pm: time.amPm,
              });
            },
          }}
        />
      )}

      {/* Delete a given entry */}
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
      <AppointmentDialog open={apptOpen} onOpenChange={setApptOpen} initialDate={todayStr} appointments={appointments} onSave={addAppointment} title="Add Appointment" />

      {/* Note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label className="text-xs">Recorded By</Label><CaregiverPicker people={activeCaregivers} value={caregiver?.caregiver_id} onChange={selectCaregiver} /></div>
            <div className="space-y-1"><Label className="text-xs">Title (optional)</Label><Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} placeholder="e.g. Doctor visit notes" /></div>
            <div className="space-y-1"><Label className="text-xs">Note</Label><Textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Write your note here…" rows={4} /></div>
          </div>
          <DialogFooter>
            <Button className="w-full" disabled={!noteContent.trim() || !caregiver} onClick={async () => {
              if (!caregiver) return;
              try {
                await addNote(noteTitle, noteContent, caregiver.caregiver_id);
                setNoteOpen(false);
                setNoteTitle('');
                setNoteContent('');
              } catch { /* The hook reports the failure; preserve the typed note. */ }
            }}>Save Note</Button>
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
