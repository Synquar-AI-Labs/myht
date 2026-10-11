import { ReactNode, Suspense, lazy } from 'react';
import { format, parseISO } from 'date-fns';
import { formatAppointmentTime } from '@/lib/reportHelpers';
import { Heart, Pill, Calendar, BarChart3, ChevronDown, Plus, StickyNote, CalendarDays, Clock, MapPin, Mic, Loader2 } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import type { Medicine, MedicineLog } from '@/hooks/useMedicines';
import type { CustomAction } from '@/hooks/useCustomActions';
import type { HealthRecord, Appointment } from '@/types/health';
import type { GivenItem, UpcomingItem } from '@/components/today/todaySchedule';
import { timeLabel, doseLabel, logDateTime } from '@/components/today/todaySchedule';
import { READING_TYPES, ReadingType } from '@/components/today/readingTypes';
import { TrendsCharts, TrendsOpenPanel } from '@/components/today/TrendsCharts';
import type { CustomActionLog } from '@/hooks/useCustomActions';

// Loaded on first expand — keeps the recorder code out of the initial bundle.
const TranscriptsTab = lazy(() => import('@/components/TranscriptsTab').then(m => ({ default: m.TranscriptsTab })));

/* ── Shared collapsible card shell ─────────────────────────────── */

interface SectionCardProps {
  icon: ReactNode;
  chipClass: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}

function SectionCard({ icon, chipClass, title, subtitle, children }: SectionCardProps) {
  return (
    <Collapsible>
      <div className="bg-white border border-[#e9e2d6] rounded-2xl">
        <CollapsibleTrigger className="group flex w-full items-center gap-3.5 p-3.5 text-left min-h-[68px]">
          <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${chipClass}`}>
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold text-[#26201a]">{title}</span>
            <span className="block truncate text-[13px] text-[#8b8175]">{subtitle}</span>
          </span>
          <ChevronDown className="h-5 w-5 flex-none text-[#8b8175] transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="collapsible-content">
          <div className="border-t border-[#f3ede2] p-3.5">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/* ── 1. Record a reading ───────────────────────────────────────── */

interface ReadingSectionProps {
  todayRecord: HealthRecord | null;
  lastBpLabel: string | null;
  customActions: CustomAction[];
  getLogCountForAction: (id: string, date?: string) => number;
  todayStr: string;
  onPickReading: (rt: ReadingType) => void;
  onPickCustomAction: (ca: CustomAction) => void;
  onAddCustomAction: () => void;
}

export function ReadingSection({
  todayRecord, lastBpLabel, customActions, getLogCountForAction, todayStr,
  onPickReading, onPickCustomAction, onAddCustomAction,
}: ReadingSectionProps) {
  const subtitle = lastBpLabel
    ? `BP, feed, vomit, stool, weight… · ${lastBpLabel}`
    : 'BP, feed, vomit, stool, weight…';

  return (
    <SectionCard
      icon={<Heart className="h-[22px] w-[22px]" strokeWidth={2.2} />}
      chipClass="bg-[#eaf3ec] text-[#2e7d4f]"
      title="Record a reading"
      subtitle={subtitle}
    >
      <div className="grid grid-cols-2 gap-2">
        {READING_TYPES.map(rt => (
          <button
            key={rt.key}
            onClick={() => onPickReading(rt)}
            className="flex min-h-[52px] items-center gap-2.5 rounded-xl border border-[#e9e2d6] bg-white px-3 py-2 text-left active:scale-95 transition-transform"
          >
            <span className={`h-3 w-3 flex-none rounded-full ${rt.dot}`} />
            <span className="min-w-0">
              <span className="block text-[16px] font-bold text-[#26201a]">{rt.label}</span>
              <span className="block break-words text-xs text-[#8b8175]">{rt.todaySoFar(todayRecord)}</span>
            </span>
          </button>
        ))}
        {customActions.map(ca => {
          const count = getLogCountForAction(ca.id, todayStr);
          return (
            <button
              key={ca.id}
              onClick={() => onPickCustomAction(ca)}
              className="flex min-h-[52px] items-center gap-2.5 rounded-xl border border-[#e9e2d6] bg-white px-3 py-2 text-left active:scale-95 transition-transform"
            >
              <span className={`h-3 w-3 flex-none rounded-full ${ca.color}`} />
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-bold text-[#26201a]">{ca.name}</span>
                <span className="block text-xs text-[#8b8175]">{count} today</span>
              </span>
            </button>
          );
        })}
        <button
          onClick={onAddCustomAction}
          className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-[#e9e2d6] px-3 py-2 text-[#8b8175] active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4" />
          <span className="text-[14px] font-semibold">Add new</span>
        </button>
      </div>
    </SectionCard>
  );
}

/* ── 2. Record a medicine ──────────────────────────────────────── */

interface MedicineSectionProps {
  medicines: Medicine[];
  /** ALL of today's medicine logs (not the 12-hour presentation window). */
  todayLogs: MedicineLog[];
  given: GivenItem[];
  upcoming: UpcomingItem[];
  onPickMedicine: (med: Medicine) => void;
}

export function MedicineSection({ medicines, todayLogs, given, upcoming, onPickMedicine }: MedicineSectionProps) {
  const visible = medicines.filter(m => m.show_in_quick_log !== false);
  const last = given[0];
  const subtitle = last?.medicine
    ? `All ${visible.length} medicines · last: ${last.medicine.name.split(' ')[0]}, ${timeLabel(last.at)}`
    : `All ${visible.length} medicines`;

  // Per-day status: how many times given TODAY and when last, plus the
  // medicine's next unadministered slot (already one-to-one matched upstream).
  const todayByMed = new Map<string, Date[]>();
  todayLogs.forEach(log => {
    const list = todayByMed.get(log.medicine_id) ?? [];
    list.push(logDateTime(log));
    todayByMed.set(log.medicine_id, list);
  });
  const nextSlotByMed = new Map<string, UpcomingItem>();
  upcoming.forEach(u => {
    if (!nextSlotByMed.has(u.medicine.id)) nextSlotByMed.set(u.medicine.id, u);
  });

  return (
    <SectionCard
      icon={<Pill className="h-[22px] w-[22px]" strokeWidth={2.2} />}
      chipClass="bg-[#f3ecfb] text-[#8b5cf6]"
      title="Record a medicine"
      subtitle={subtitle}
    >
      <div className="-mx-1">
        {visible.map((med, i) => {
          const todayTimes = (todayByMed.get(med.id) ?? []).sort((a, b) => a.getTime() - b.getTime());
          const lastToday = todayTimes[todayTimes.length - 1];
          const next = nextSlotByMed.get(med.id);
          const dose = doseLabel(med);
          return (
            <button
              key={med.id}
              onClick={() => onPickMedicine(med)}
              className={`flex w-full items-center gap-3 rounded-xl px-1 py-3 text-left ${
                i < visible.length - 1 ? 'border-b border-[#f3ede2]' : ''
              } ${next?.state === 'due' ? 'animate-due-flash-row' : next?.state === 'overdue' ? 'bg-[rgba(194,65,12,0.08)]' : ''}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-bold text-[#26201a]">{med.name}</span>
                <span className="block text-[13px] text-[#8b8175]">
                  {dose}
                  {lastToday && (
                    <span className="font-semibold text-[#2e7d4f]">
                      {dose ? ' · ' : ''}✓ {timeLabel(lastToday)}{todayTimes.length > 1 ? ` ×${todayTimes.length}` : ''}
                    </span>
                  )}
                  {next && next.state === 'scheduled' && ` · next ${timeLabel(next.at)}`}
                  {!lastToday && !next && !med.schedule_time && `${dose ? ' · ' : ''}as needed`}
                </span>
              </span>
              {next?.state === 'due' && (
                <span className="animate-due-pulse flex-none rounded-lg bg-[#c2410c] px-2 py-1 text-xs font-extrabold uppercase tracking-wide text-white">
                  Due
                </span>
              )}
              {next?.state === 'overdue' && (
                <span className="flex-none rounded-lg border border-[#c2410c] px-2 py-1 text-xs font-extrabold uppercase tracking-wide text-[#c2410c]">
                  Overdue
                </span>
              )}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ── 3. Appointments & notes ───────────────────────────────────── */

interface ApptNotesSectionProps {
  nextAppointments: Appointment[];
  onAddAppointment: () => void;
  onAddNote: () => void;
}

export function ApptNotesSection({ nextAppointments, onAddAppointment, onAddNote }: ApptNotesSectionProps) {
  const next = nextAppointments[0];
  const subtitle = next
    ? `Next: ${next.doctor_name} — ${format(parseISO(next.date), 'EEE, MMM d')} · ${formatAppointmentTime(next.time)}`
    : 'No upcoming appointments';

  return (
    <SectionCard
      icon={<Calendar className="h-[22px] w-[22px]" strokeWidth={2.2} />}
      chipClass="bg-[#eef1f9] text-[#4f6bd6]"
      title="Appointments & notes"
      subtitle={subtitle}
    >
      <div className="space-y-2">
        {nextAppointments.slice(0, 3).map(appt => (
          <div key={appt.id} className="rounded-xl border border-[#e9e2d6] bg-white p-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 flex-none text-[#4f6bd6]" />
              <span className="text-[15px] font-bold text-[#26201a] truncate">{appt.doctor_name}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] text-[#8b8175]">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(parseISO(appt.date), 'EEE, MMM d')} · {formatAppointmentTime(appt.time)}
              </span>
              {appt.address && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{appt.address}</span>
              )}
            </div>
            {appt.reason && <div className="mt-0.5 text-[13px] text-[#8b8175]">{appt.reason}</div>}
          </div>
        ))}
        {nextAppointments.length === 0 && (
          <p className="py-1 text-center text-[13px] text-[#8b8175]">Nothing scheduled.</p>
        )}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button variant="outline" className="h-11 rounded-xl border-[#e9e2d6] text-[15px] font-semibold" onClick={onAddAppointment}>
            <Plus className="mr-1 h-4 w-4" /> Appointment
          </Button>
          <Button variant="outline" className="h-11 rounded-xl border-[#e9e2d6] text-[15px] font-semibold" onClick={onAddNote}>
            <StickyNote className="mr-1 h-4 w-4" /> Note
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

/* ── 4. Transcribe a visit ─────────────────────────────────────── */

export function TranscriptsSection() {
  return (
    <SectionCard
      icon={<Mic className="h-[22px] w-[22px]" strokeWidth={2.2} />}
      chipClass="bg-[#e6f4f1] text-[#0f766e]"
      title="Transcribe a visit"
      subtitle="Record & summarize doctor conversations"
    >
      <Suspense fallback={<div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
        <TranscriptsTab />
      </Suspense>
    </SectionCard>
  );
}

/* ── 5. Visuals & trends ───────────────────────────────────────── */

interface TrendsSectionProps {
  records: HealthRecord[];
  customActions: CustomAction[];
  customLogs: CustomActionLog[];
  /** Wide layout: BP & weight charts stay visible; the rest collapse inside. */
  alwaysShowVitals?: boolean;
}

export function TrendsSection({ records, customActions, customLogs, alwaysShowVitals }: TrendsSectionProps) {
  if (alwaysShowVitals) {
    return (
      <div className="rounded-2xl border border-[#e9e2d6] bg-white">
        <div className="flex min-h-[68px] items-center gap-3.5 p-3.5">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#fdf0e6] text-[#c2740c]">
            <BarChart3 className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold text-[#26201a]">Visuals & trends</span>
            <span className="block truncate text-[13px] text-[#8b8175]">Blood pressure this week</span>
          </span>
        </div>
        <div className="border-t border-[#f3ede2] p-3.5">
          <TrendsOpenPanel records={records} customActions={customActions} customLogs={customLogs} />
        </div>
      </div>
    );
  }

  return (
    <SectionCard
      icon={<BarChart3 className="h-[22px] w-[22px]" strokeWidth={2.2} />}
      chipClass="bg-[#fdf0e6] text-[#c2740c]"
      title="Visuals & trends"
      subtitle="Feeds, vomit, BP, weight, flush — weekly charts"
    >
      <TrendsCharts records={records} customActions={customActions} customLogs={customLogs} />
    </SectionCard>
  );
}
