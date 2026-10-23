import { format } from 'date-fns';
import type { RoutineLog } from '@/lib/routineSchedule';
import { displayedMinutes, MEAL_AMOUNTS, routinePlannedDetail } from '@/lib/routineToday';
import type { Medicine, MedicineLog } from '@/hooks/useMedicines';
import type { CustomAction, CustomActionLog } from '@/hooks/useCustomActions';
import { logDateTime, doseLabel, scheduledDoseDetail, occurrenceTime, visibleSkips, type DoseSkip } from '@/components/today/todaySchedule';

/** One line in the day's diary, newest first. */
export interface DiaryEntry {
  id: string;
  at: Date;
  kind: 'medicine' | 'bp' | 'custom' | 'note' | 'transcript' | 'skip' | 'meal' | 'exercise';
  skipId?: string;
  /**
   * event   → the caregiver chose this time (medicine/custom hour picker)
   * entered → we only know when it was typed in (BP, notes, transcripts)
   */
  timeKind: 'event' | 'entered';
  /** True when it was entered on a DIFFERENT day than the diary day — its
   *  clock time is meaningless for this day's timeline. */
  untimed: boolean;
  title: string;
  detail?: string;
  by?: string;
  /** Raw created_at, used only as a sort tie-breaker. */
  createdAt?: string;
}

export type PeriodKey = 'evening' | 'afternoon' | 'morning' | 'night' | 'untimed';

/** Rendered newest-period-first, matching how a caregiver scans the day. */
export const PERIOD_ORDER: PeriodKey[] = ['evening', 'afternoon', 'morning', 'night', 'untimed'];

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  evening: 'Evening',
  afternoon: 'Afternoon',
  morning: 'Morning',
  night: 'Night',
  untimed: 'Entered on another day',
};

export function periodOf(at: Date): Exclude<PeriodKey, 'untimed'> {
  const h = at.getHours();
  if (h >= 17) return 'evening';
  if (h >= 12) return 'afternoon';
  if (h >= 5) return 'morning';
  return 'night';
}

interface DiaryInputs {
  routineLogs?: RoutineLog[];
  /** The diary day (yyyy-MM-dd); inputs must already be filtered to it. */
  date: string;
  medLogs: MedicineLog[];
  medicines: Medicine[];
  skips?: DoseSkip[];
  resolutionLogs?: MedicineLog[];
  bpReadings: { id: string; date: string; systolic: number; diastolic: number; recorded_by: string; created_at: string }[];
  customActions: CustomAction[];
  customLogs: CustomActionLog[];
  notes: { id: string; date: string; title: string | null; content: string; recorded_by: string; created_at: string }[];
  transcripts: { id: string; title: string | null; summary: string; recorded_by: string; created_at: string }[];
}

/** All of one day's events, newest first. */
export function buildDiaryEntries(inputs: DiaryInputs): DiaryEntry[] {
  const medById = new Map(inputs.medicines.map(m => [m.id, m]));
  const actionById = new Map(inputs.customActions.map(a => [a.id, a]));
  const entries: DiaryEntry[] = [];
  (inputs.routineLogs ?? []).forEach(log => entries.push({ id: `routine-${log.id}`, at: new Date(log.done_at), kind: log.kind as 'meal' | 'exercise', timeKind: 'event', untimed: false, title: log.name, detail: [log.kind === 'meal' ? MEAL_AMOUNTS[log.amount as keyof typeof MEAL_AMOUNTS] : `${displayedMinutes(log.minutes!)} min`, log.details, log.drink, routinePlannedDetail(log), log.note].filter(Boolean).join(' · '), by: log.recorded_by, createdAt: log.done_at }));

  const enteredSameDay = (createdAt: string) =>
    format(new Date(createdAt), 'yyyy-MM-dd') === inputs.date;

  inputs.medLogs.forEach(log => {
    const med = log.medicine ?? medById.get(log.medicine_id);
    // Historical Feed/Flush/Restoralax pseudo-medicines are activities, not
    // medicines — they must not read as "X given" or count as meds.
    const isRealMedicine = !med || med.category === 'medicine' || !med.category;
    entries.push({
      id: `med-${log.id}`,
      at: logDateTime(log),
      kind: isRealMedicine ? 'medicine' : 'custom',
      timeKind: 'event',
      untimed: false,
      title: isRealMedicine ? `${med?.name ?? 'Medicine'} given` : (med?.name ?? 'Activity'),
      detail: [doseLabel(med), scheduledDoseDetail(log)].filter(Boolean).join(' · ') || undefined,
      by: log.recorded_by || undefined,
      createdAt: log.created_at,
    });
  });

  (inputs.skips ?? []).forEach(skip => {
    const at = occurrenceTime(skip);
    if (!visibleSkips([skip], [...inputs.medLogs, ...(inputs.resolutionLogs ?? [])], inputs.medicines, at).length) return;
    entries.push({ id: `skip-${skip.id}`, skipId: skip.id, at, kind: 'skip', timeKind: 'event', untimed: false,
      title: `Skipped: ${medById.get(skip.medicine_id)?.name ?? 'Medicine'} (${format(at, 'h:mm a')})`,
      detail: skip.reason || undefined, by: skip.recorded_by, createdAt: skip.created_at });
  });

  inputs.customLogs.forEach(log => {
    const action = actionById.get(log.action_id);
    const unit = action?.unit ? ` ${action.unit}` : '';
    entries.push({
      id: `custom-${log.id}`,
      at: logDateTime(log),
      kind: 'custom',
      timeKind: 'event',
      untimed: false,
      title: `${action?.name ?? 'Activity'} — ${log.value}${unit}`,
      by: log.recorded_by || undefined,
      createdAt: log.created_at,
    });
  });

  // The remaining sources carry only an entry timestamp (created_at) — that
  // is when someone TYPED it, which is honest to show only as such.
  inputs.bpReadings.forEach(r => {
    entries.push({
      id: `bp-${r.id}`,
      at: new Date(r.created_at),
      kind: 'bp',
      timeKind: 'entered',
      untimed: !enteredSameDay(r.created_at),
      title: `Blood pressure ${r.systolic}/${r.diastolic}`,
      by: r.recorded_by || undefined,
      createdAt: r.created_at,
    });
  });

  inputs.notes.forEach(n => {
    entries.push({
      id: `note-${n.id}`,
      at: new Date(n.created_at),
      kind: 'note',
      timeKind: 'entered',
      untimed: !enteredSameDay(n.created_at),
      title: n.title ? `Note — ${n.title}` : 'Written note',
      detail: n.content,
      by: n.recorded_by || undefined,
      createdAt: n.created_at,
    });
  });

  inputs.transcripts.forEach(t => {
    entries.push({
      id: `transcript-${t.id}`,
      at: new Date(t.created_at),
      kind: 'transcript',
      timeKind: 'entered',
      untimed: !enteredSameDay(t.created_at),
      title: t.title ? `Doctor conversation — ${t.title}` : 'Doctor conversation',
      detail: t.summary,
      by: t.recorded_by || undefined,
      createdAt: t.created_at,
    });
  });

  return entries.sort((a, b) =>
    b.at.getTime() - a.at.getTime() ||
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  );
}

export interface DiaryGroup {
  key: PeriodKey;
  label: string;
  entries: DiaryEntry[];
}

/** Non-empty groups, newest period first; cross-day entries go last under
 *  "Entered on another day" instead of claiming a fake time slot. */
export function groupDiary(entries: DiaryEntry[]): DiaryGroup[] {
  return PERIOD_ORDER.map(key => ({
    key,
    label: PERIOD_LABEL[key],
    entries: entries.filter(e => (e.untimed ? key === 'untimed' : periodOf(e.at) === key)),
  })).filter(g => g.entries.length > 0);
}
