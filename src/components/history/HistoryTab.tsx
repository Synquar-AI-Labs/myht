import { lazy, Suspense, useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  Pill, Heart, Zap, StickyNote, Mic, CalendarDays, ChevronDown, ChevronLeft,
  ChevronRight, BarChart3, Pencil, Moon, Sun, Sunrise, MoonStar, Loader2, AlertTriangle,
} from 'lucide-react';
import { useMedicines } from '@/hooks/useMedicines';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useCustomActions } from '@/hooks/useCustomActions';
import { useWrittenNotes } from '@/hooks/useWrittenNotes';
import { fetchTranscriptsForDate } from '@/hooks/useTranscripts';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { domainKeys } from '@/lib/domainKeys';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatBp, cn } from '@/lib/utils';
import { timeLabel } from '@/components/today/todaySchedule';
import { TrendsCharts } from '@/components/today/TrendsCharts';
import { buildDiaryEntries, groupDiary, DiaryEntry, PeriodKey } from '@/components/history/diary';

const DailyRecordTab = lazy(() => import('@/components/DailyRecordTab').then(m => ({ default: m.DailyRecordTab })));

const KIND_STYLE: Record<DiaryEntry['kind'], { icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>; chip: string }> = {
  medicine: { icon: Pill, chip: 'bg-[#eaf3ec] text-[#2e7d4f]' },
  bp: { icon: Heart, chip: 'bg-[#fdecec] text-[#c0392b]' },
  custom: { icon: Zap, chip: 'bg-[#fdf0e6] text-[#c2740c]' },
  note: { icon: StickyNote, chip: 'bg-[#eef1f9] text-[#4f6bd6]' },
  transcript: { icon: Mic, chip: 'bg-[#e6f4f1] text-[#0f766e]' },
};

const PERIOD_ICON: Record<PeriodKey, React.ComponentType<{ className?: string; strokeWidth?: number | string }>> = {
  evening: Moon,
  afternoon: Sun,
  morning: Sunrise,
  night: MoonStar,
  untimed: Pencil,
};

type View = 'diary' | 'charts' | 'editday';

interface HistoryTabProps {
  /** Mirrors the day-editor's in-flight save so the app can lock global nav. */
  onBusyChange?: (busy: boolean) => void;
}

export function HistoryTab({ onBusyChange }: HistoryTabProps) {
  const { householdId } = useHousehold();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [view, setView] = useState<View>('diary');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);

  const handleEditorBusy = (busy: boolean) => {
    setEditorBusy(busy);
    onBusyChange?.(busy);
  };

  const healthRecords = useHealthRecords();
  const { records, bpReadings, loading: recordsLoading, bpLoading, loadError: recordsBpError } = healthRecords;
  const { medicines, logs: medLogs, loading: medLogsLoading, loadError: medLogsError } = useMedicines(selectedDate);
  const { actions: customActions, logs: customLogs, loading: customLoading, loadError: customError } = useCustomActions();
  const { notes, loading: notesLoading, loadError: notesError } = useWrittenNotes();

  // Shares useTranscripts' cache key AND fetcher, so the shapes can't drift.
  const { data: transcripts = [], isLoading: transcriptsLoading, isError: transcriptsError } = useQuery({
    queryKey: [...domainKeys.transcripts(householdId), selectedDate],
    queryFn: () => fetchTranscriptsForDate(selectedDate, householdId!),
    enabled: !!householdId,
  });

  // Never present "nothing recorded" (or zeros) while any source is pending.
  const diaryLoading = medLogsLoading || customLoading || notesLoading || transcriptsLoading || recordsLoading || bpLoading;
  const diaryError = medLogsError || customError || notesError || transcriptsError || recordsBpError;

  const dayRecord = useMemo(() => records.find(r => r.date === selectedDate) ?? null, [records, selectedDate]);
  const dayBp = useMemo(() => bpReadings.filter(r => r.date === selectedDate), [bpReadings, selectedDate]);
  const dayCustomLogs = useMemo(() => customLogs.filter(l => l.date === selectedDate), [customLogs, selectedDate]);
  const dayNotes = useMemo(
    () => notes.filter(n => n.date === selectedDate),
    [notes, selectedDate],
  );

  const entries = useMemo(
    () => buildDiaryEntries({
      date: selectedDate,
      medLogs, medicines,
      bpReadings: dayBp,
      customActions, customLogs: dayCustomLogs,
      notes: dayNotes,
      transcripts,
    }),
    [selectedDate, medLogs, medicines, dayBp, customActions, dayCustomLogs, dayNotes, transcripts],
  );
  const groups = useMemo(() => groupDiary(entries), [entries]);

  // "Meds given" counts real medicines only. The joined log.medicine row
  // carries the category, so this can't miscount while the medicines-list
  // query is loading or failed.
  const medsGivenCount = useMemo(
    () => medLogs.filter(l => (l.medicine?.category ?? 'medicine') !== 'non-medicine').length,
    [medLogs],
  );

  // Day chips: today plus the three previous days, then the free date picker.
  const dayChips = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => {
      const d = subDays(new Date(), i);
      const str = format(d, 'yyyy-MM-dd');
      return {
        str,
        top: format(d, 'EEE'),
        num: format(d, 'd'),
        sub: i === 0 ? 'Today' : i === 1 ? 'Yesterday' : format(d, 'MMM'),
      };
    });
  }, [todayStr]); // eslint-disable-line react-hooks/exhaustive-deps

  const isCustomDate = !dayChips.some(c => c.str === selectedDate);

  // Loading shows "…", a failed query shows "—". A zero only ever means a
  // confirmed zero — this strip is read as medical fact.
  const medsValue = medLogsLoading ? '…' : medLogsError ? '—' : String(medsGivenCount);
  const recValue = (v: string) => (recordsLoading ? '…' : recordsBpError ? '—' : v);
  const summary = [
    { value: medsValue, label: medsGivenCount === 1 && !medLogsError ? 'med given' : 'meds given', tone: 'text-[#2e7d4f]' },
    { value: recValue(String(dayRecord?.feed_bags ?? 0)), label: 'feeds', tone: 'text-[#26201a]' },
    { value: recValue(formatBp(dayRecord?.bp_systolic, dayRecord?.bp_diastolic)), label: 'BP', tone: 'text-[#26201a]' },
    { value: recValue(String(dayRecord?.vomit_count ?? 0)), label: 'vomit', tone: (dayRecord?.vomit_count ?? 0) > 0 ? 'text-[#c2410c]' : 'text-[#26201a]' },
    { value: recValue(dayRecord?.weight && Number(dayRecord.weight) > 0 ? String(dayRecord.weight) : '—'), label: 'kg', tone: 'text-[#26201a]' },
  ];

  // The complete untimed daily record — "No" and 0 are medical information
  // (no food, no stool), so nothing is filtered out.
  const flushParts = [
    dayRecord?.flush_ml ? `${dayRecord.flush_ml} ml` : null,
    dayRecord?.flush_count ? `${dayRecord.flush_count}×` : null,
  ].filter(Boolean);
  const dayTotals: { label: string; value: string }[] = dayRecord ? [
    { label: 'Bile bags', value: String(dayRecord.bile_bags ?? 0) },
    { label: 'Stool', value: String(dayRecord.stool_count ?? 0) },
    { label: 'Urine', value: String(dayRecord.urine_count ?? 0) },
    { label: 'Flush', value: flushParts.length ? flushParts.join(' · ') : '0' },
    { label: 'Food', value: dayRecord.food_taken ? `Yes${dayRecord.food_description ? ` — ${dayRecord.food_description}` : ''}` : 'No' },
    { label: 'Constipation', value: dayRecord.constipation ? 'Yes' : 'No' },
    ...(dayRecord.misc_notes ? [{ label: 'Notes', value: dayRecord.misc_notes }] : []),
  ] : [];

  if (view === 'charts') {
    return (
      <div className="mx-auto max-w-[560px]">
        <button onClick={() => setView('diary')} className="mb-3 flex items-center gap-1 text-[15px] font-semibold text-[#8a6240]">
          <ChevronLeft className="h-4 w-4" /> Back to the diary
        </button>
        <TrendsCharts records={records} customActions={customActions} customLogs={customLogs} />
      </div>
    );
  }

  if (view === 'editday') {
    return (
      <div className="mx-auto max-w-[560px]">
        <button
          onClick={() => setView('diary')}
          disabled={editorBusy}
          className="mb-3 flex items-center gap-1 text-[15px] font-semibold text-[#8a6240] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> {editorBusy ? 'Saving…' : 'Back to the diary'}
        </button>
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          <DailyRecordTab {...healthRecords} initialDate={selectedDate} dayOnly onBusyChange={handleEditorBusy} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="pb-4 text-[26px] font-normal text-[#26201a]">What happened</h1>

      {/* Day chips */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {dayChips.map(chip => {
          const active = selectedDate === chip.str;
          return (
            <button
              key={chip.str}
              onClick={() => setSelectedDate(chip.str)}
              className={cn(
                'flex w-[72px] flex-none flex-col items-center rounded-2xl border px-2 py-2.5',
                active ? 'border-[#26201a] bg-[#26201a] text-white' : 'border-[#e9e2d6] bg-white text-[#26201a]',
              )}
            >
              <span className={cn('text-[12px] font-semibold', active ? 'text-white/80' : 'text-[#8b8175]')}>{chip.top}</span>
              <span className="text-[20px] font-bold leading-6">{chip.num}</span>
              <span className={cn('text-[11px] font-medium', active ? 'text-white/80' : 'text-[#8b8175]')}>{chip.sub}</span>
            </button>
          );
        })}
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'flex w-[86px] flex-none flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2.5',
                isCustomDate ? 'border-[#26201a] bg-[#26201a] text-white' : 'border-[#e9e2d6] bg-white text-[#26201a]',
              )}
            >
              <CalendarDays className="h-5 w-5" />
              <span className="text-[11px] font-semibold">
                {isCustomDate ? format(parseISO(selectedDate), 'MMM d') : 'Pick a day'}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={parseISO(selectedDate)}
              onSelect={d => {
                if (d) {
                  setSelectedDate(format(d, 'yyyy-MM-dd'));
                  setPickerOpen(false);
                }
              }}
              disabled={d => d > new Date()}
              className="pointer-events-auto p-3"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Five-number summary */}
      <div className="mt-3 grid grid-cols-5 rounded-2xl border border-[#e9e2d6] bg-white px-2 py-3">
        {summary.map(s => (
          <div key={s.label} className="text-center">
            <div className={`text-[18px] font-bold ${s.tone}`}>{s.value}</div>
            <div className="text-[11px] text-[#8b8175]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Day totals — real data that has no timestamps, shown as totals */}
      {!recordsLoading && dayTotals.length > 0 && (
        <div className="mt-3 rounded-2xl border border-[#e9e2d6] bg-white p-3.5">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#8b8175]">Day totals</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {dayTotals.map(t => (
              <span key={t.label} className="text-[13px] text-[#26201a]">
                <span className="text-[#8b8175]">{t.label}: </span>
                <span className="font-semibold">{t.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Diary, grouped by time of day (newest first) */}
      <div key={selectedDate} className="mt-5 space-y-5">
        {diaryError && (
          <div className="flex items-center gap-2 rounded-2xl border border-[#f0c9ae] bg-[#fdf0e6] p-3 text-[13px] font-medium text-[#c2740c]">
            <AlertTriangle className="h-4 w-4 flex-none" />
            Couldn't load the full diary — check the connection and try again.
          </div>
        )}
        {diaryLoading && groups.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {diaryLoading && groups.length > 0 && (
          <div className="flex items-center justify-center gap-2 text-[13px] text-[#8b8175]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Still loading the rest of the day…
          </div>
        )}
        {!diaryLoading && !diaryError && groups.length === 0 && (
          <p className="py-6 text-center text-[14px] text-[#8b8175]">
            Nothing recorded on {format(parseISO(selectedDate), 'EEE, MMM d')}.
          </p>
        )}
        {groups.map((group, gi) => {
          const PeriodIcon = PERIOD_ICON[group.key];
          const defaultOpen = gi < 2;
          return (
            <Collapsible key={group.key} defaultOpen={defaultOpen}>
              <CollapsibleTrigger className="group flex w-full items-center gap-2 pb-2">
                <PeriodIcon className="h-4 w-4 text-[#8b8175]" />
                <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-[#8b8175]">
                  {group.label}
                  <span className="font-semibold normal-case tracking-normal"> — {group.entries.length} {group.entries.length === 1 ? 'entry' : 'entries'}</span>
                </span>
                <span className="mx-1 h-px flex-1 bg-[#e9e2d6]" />
                <ChevronDown className="h-4 w-4 text-[#8b8175] transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="collapsible-content">
                <div className="space-y-2">
                  {group.entries.map(entry => {
                    const style = KIND_STYLE[entry.kind];
                    const Icon = style.icon;
                    return (
                      <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-[#e9e2d6] bg-white p-3">
                        <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${style.chip}`}>
                          <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[16px] font-bold leading-snug text-[#26201a]">{entry.title}</div>
                          <div className="text-[13px] text-[#8b8175]">
                            {entry.untimed
                              ? `time not recorded · entered ${format(entry.at, 'MMM d')}`
                              : entry.timeKind === 'entered'
                                ? `entered ${timeLabel(entry.at)}`
                                : timeLabel(entry.at)}
                            {entry.by ? ` · by ${entry.by}` : ''}
                          </div>
                          {entry.detail && (
                            <div className="mt-0.5 line-clamp-2 text-[13px] text-[#8b8175]">{entry.detail}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {/* Footer rows */}
      <div className="mt-6 space-y-2 pb-4">
        <button
          onClick={() => setView('charts')}
          className="flex w-full items-center gap-3.5 rounded-2xl border border-[#e9e2d6] bg-white p-3.5 text-left"
        >
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#fdf0e6] text-[#c2740c]">
            <BarChart3 className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </span>
          <span className="flex-1 text-[16px] font-bold text-[#26201a]">See this week as charts</span>
          <ChevronRight className="h-5 w-5 flex-none text-[#8b8175]" />
        </button>
        <button
          onClick={() => setView('editday')}
          className="flex w-full items-center gap-3.5 rounded-2xl border border-[#e9e2d6] bg-white p-3.5 text-left"
        >
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#eef1f9] text-[#4f6bd6]">
            <Pencil className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold text-[#26201a]">Edit this day</span>
            <span className="block text-[13px] text-[#8b8175]">Fix totals, weight or notes for {format(parseISO(selectedDate), 'MMM d')}</span>
          </span>
          <ChevronRight className="h-5 w-5 flex-none text-[#8b8175]" />
        </button>
      </div>
    </div>
  );
}
