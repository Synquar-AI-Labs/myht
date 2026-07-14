import { lazy, Suspense, useMemo, useState } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import {
  Pill, Heart, Zap, StickyNote, Mic, CalendarDays, ChevronDown, ChevronLeft,
  ChevronRight, BarChart3, Pencil, Moon, Sun, Sunrise, MoonStar, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMedicines } from '@/hooks/useMedicines';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useCustomActions } from '@/hooks/useCustomActions';
import { useWrittenNotes } from '@/hooks/useWrittenNotes';
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
};

type View = 'diary' | 'charts' | 'editday';

export function HistoryTab() {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [view, setView] = useState<View>('diary');
  const [pickerOpen, setPickerOpen] = useState(false);

  const healthRecords = useHealthRecords();
  const { records, bpReadings } = healthRecords;
  const { medicines, logs: medLogs } = useMedicines(selectedDate);
  const { actions: customActions, logs: customLogs } = useCustomActions();
  const { notes } = useWrittenNotes();

  // Same query key shape as useTranscripts so the caches are shared.
  const { data: transcripts = [] } = useQuery({
    queryKey: ['audio_transcripts', selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audio_transcripts')
        .select('*')
        .eq('date', selectedDate)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const dayRecord = useMemo(() => records.find(r => r.date === selectedDate) ?? null, [records, selectedDate]);
  const dayBp = useMemo(() => bpReadings.filter(r => r.date === selectedDate), [bpReadings, selectedDate]);
  const dayCustomLogs = useMemo(() => customLogs.filter(l => l.date === selectedDate), [customLogs, selectedDate]);
  const dayNotes = useMemo(
    () => notes.filter(n => n.date === selectedDate),
    [notes, selectedDate],
  );

  const entries = useMemo(
    () => buildDiaryEntries({
      medLogs, medicines,
      bpReadings: dayBp,
      customActions, customLogs: dayCustomLogs,
      notes: dayNotes,
      transcripts,
    }),
    [medLogs, medicines, dayBp, customActions, dayCustomLogs, dayNotes, transcripts],
  );
  const groups = useMemo(() => groupDiary(entries), [entries]);

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

  const summary = [
    { value: String(medLogs.length), label: medLogs.length === 1 ? 'med given' : 'meds given', tone: 'text-[#2e7d4f]' },
    { value: String(dayRecord?.feed_bags ?? 0), label: 'feeds', tone: 'text-[#26201a]' },
    { value: formatBp(dayRecord?.bp_systolic, dayRecord?.bp_diastolic), label: 'BP', tone: 'text-[#26201a]' },
    { value: String(dayRecord?.vomit_count ?? 0), label: 'vomit', tone: (dayRecord?.vomit_count ?? 0) > 0 ? 'text-[#c2410c]' : 'text-[#26201a]' },
    { value: dayRecord?.weight && Number(dayRecord.weight) > 0 ? String(dayRecord.weight) : '—', label: 'kg', tone: 'text-[#26201a]' },
  ];

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
        <button onClick={() => setView('diary')} className="mb-3 flex items-center gap-1 text-[15px] font-semibold text-[#8a6240]">
          <ChevronLeft className="h-4 w-4" /> Back to the diary
        </button>
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          <DailyRecordTab {...healthRecords} initialDate={selectedDate} />
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

      {/* Diary, grouped by time of day (newest first) */}
      <div key={selectedDate} className="mt-5 space-y-5">
        {groups.length === 0 && (
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
                            {timeLabel(entry.at)}{entry.by ? ` · by ${entry.by}` : ''}
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
