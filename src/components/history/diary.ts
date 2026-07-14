import type { Medicine, MedicineLog } from '@/hooks/useMedicines';
import type { CustomAction, CustomActionLog } from '@/hooks/useCustomActions';
import { logDateTime, doseLabel } from '@/components/today/todaySchedule';

/** One line in the day's diary, newest first. */
export interface DiaryEntry {
  id: string;
  at: Date;
  kind: 'medicine' | 'bp' | 'custom' | 'note' | 'transcript';
  title: string;
  detail?: string;
  by?: string;
}

export type PeriodKey = 'evening' | 'afternoon' | 'morning' | 'night';

/** Rendered newest-period-first, matching how a caregiver scans the day. */
export const PERIOD_ORDER: PeriodKey[] = ['evening', 'afternoon', 'morning', 'night'];

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  evening: 'Evening',
  afternoon: 'Afternoon',
  morning: 'Morning',
  night: 'Night',
};

export function periodOf(at: Date): PeriodKey {
  const h = at.getHours();
  if (h >= 17) return 'evening';
  if (h >= 12) return 'afternoon';
  if (h >= 5) return 'morning';
  return 'night';
}

interface DiaryInputs {
  medLogs: MedicineLog[];
  medicines: Medicine[];
  bpReadings: { id: string; date: string; systolic: number; diastolic: number; recorded_by: string; created_at: string }[];
  customActions: CustomAction[];
  customLogs: CustomActionLog[];
  notes: { id: string; date: string; title: string | null; content: string; recorded_by: string; created_at: string }[];
  transcripts: { id: string; title: string | null; summary: string; recorded_by: string; created_at: string }[];
}

/** All of one day's timestamped events, newest first. Inputs must already be filtered to the day. */
export function buildDiaryEntries(inputs: DiaryInputs): DiaryEntry[] {
  const medById = new Map(inputs.medicines.map(m => [m.id, m]));
  const actionById = new Map(inputs.customActions.map(a => [a.id, a]));
  const entries: DiaryEntry[] = [];

  inputs.medLogs.forEach(log => {
    const med = log.medicine ?? medById.get(log.medicine_id);
    entries.push({
      id: `med-${log.id}`,
      at: logDateTime(log),
      kind: 'medicine',
      title: `${med?.name ?? 'Medicine'} given`,
      detail: doseLabel(med) || undefined,
      by: log.recorded_by || undefined,
    });
  });

  inputs.bpReadings.forEach(r => {
    entries.push({
      id: `bp-${r.id}`,
      at: new Date(r.created_at),
      kind: 'bp',
      title: `Blood pressure ${r.systolic}/${r.diastolic}`,
      by: r.recorded_by || undefined,
    });
  });

  inputs.customLogs.forEach(log => {
    const action = actionById.get(log.action_id);
    const unit = action?.unit ? ` ${action.unit}` : '';
    entries.push({
      id: `custom-${log.id}`,
      at: logDateTime(log),
      kind: 'custom',
      title: `${action?.name ?? 'Activity'} — ${log.value}${unit}`,
      by: log.recorded_by || undefined,
    });
  });

  inputs.notes.forEach(n => {
    entries.push({
      id: `note-${n.id}`,
      at: new Date(n.created_at),
      kind: 'note',
      title: n.title ? `Note — ${n.title}` : 'Written note',
      detail: n.content,
      by: n.recorded_by || undefined,
    });
  });

  inputs.transcripts.forEach(t => {
    entries.push({
      id: `transcript-${t.id}`,
      at: new Date(t.created_at),
      kind: 'transcript',
      title: t.title ? `Doctor conversation — ${t.title}` : 'Doctor conversation',
      detail: t.summary,
      by: t.recorded_by || undefined,
    });
  });

  return entries.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export interface DiaryGroup {
  key: PeriodKey;
  label: string;
  entries: DiaryEntry[];
}

/** Non-empty time-of-day groups, newest period first, entries newest first. */
export function groupDiary(entries: DiaryEntry[]): DiaryGroup[] {
  return PERIOD_ORDER.map(key => ({
    key,
    label: PERIOD_LABEL[key],
    entries: entries.filter(e => periodOf(e.at) === key),
  })).filter(g => g.entries.length > 0);
}
