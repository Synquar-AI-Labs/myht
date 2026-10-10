import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { formatAppointmentTime } from '@/lib/reportHelpers';
import { useQuery } from '@tanstack/react-query';
import {
  Pill, CalendarDays, Users, Mic, FileText, Maximize, LogOut, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAppointments } from '@/hooks/useAppointments';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { MEDICINES_QUERY_KEY, fetchMedicinesList } from '@/hooks/useMedicines';

const MedicineScheduleTab = lazy(() => import('@/components/MedicineScheduleTab').then(m => ({ default: m.MedicineScheduleTab })));
const AppointmentsTab = lazy(() => import('@/components/AppointmentsTab').then(m => ({ default: m.AppointmentsTab })));
const HospitalStaysTab = lazy(() => import('@/components/HospitalStaysTab').then(m => ({ default: m.HospitalStaysTab })));
const TranscriptsTab = lazy(() => import('@/components/TranscriptsTab').then(m => ({ default: m.TranscriptsTab })));
const DashboardTab = lazy(() => import('@/components/DashboardTab').then(m => ({ default: m.DashboardTab })));

/** Fetches the full health/BP history only when Reports is actually opened.
 *  Gated hard on load state — a half-loaded dataset must never become a
 *  plausible-looking all-zero medical PDF. */
function ReportsView() {
  const { records, bpReadings, loading, bpLoading, loadError } = useHealthRecords();
  if (loadError) {
    return (
      <div className="rounded-2xl border border-[#f0c9ae] bg-[#fdf0e6] p-4 text-[14px] font-medium text-[#c2740c]">
        Couldn't load the records — check the connection and try again.
      </div>
    );
  }
  if (loading || bpLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-[13px] text-[#8b8175]">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading all records…
      </div>
    );
  }
  return <DashboardTab records={records} bpReadings={bpReadings} />;
}

type ShelfView = null | 'meds' | 'visits' | 'stays' | 'conversations' | 'reports';

interface MoreShelfProps {
  onPresentationMode: () => void;
  onSignOut: () => void;
}

interface RowSpec {
  view: ShelfView;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  chip: string;
}

export function MoreShelf({ onPresentationMode, onSignOut }: MoreShelfProps) {
  const [view, setView] = useState<ShelfView>(null);

  // Minute tick so "next appointment" can't stay stale on a mounted shelf.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const appointmentsData = useAppointments();

  const { data: medicines = [], isLoading: medsLoading } = useQuery({ queryKey: MEDICINES_QUERY_KEY, queryFn: fetchMedicinesList });

  // Rows are caregiver coverage blocks (incl. unavailability), NOT "stays" —
  // so the subtitle talks about coverage, and skips unavailable blocks.
  const { data: staysSummary } = useQuery({
    queryKey: ['hospital-stays-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hospital_stays')
        .select('date')
        .eq('is_unavailable', false)
        .order('date', { ascending: false })
        .limit(1);
      if (error) throw error;
      return { latest: (data?.[0]?.date as string | undefined) ?? null };
    },
  });

  const { data: transcriptCount } = useQuery({
    queryKey: ['audio_transcripts-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('audio_transcripts')
        .select('id', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const nextAppointment = useMemo(() => {
    const todayStr = format(now, 'yyyy-MM-dd');
    const nowTime = format(now, 'HH:mm');
    return appointmentsData.appointments
      .filter(a => a.date > todayStr || (a.date === todayStr && (a.time || '') >= nowTime))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))[0];
  }, [appointmentsData.appointments, now]);

  const rows: RowSpec[] = [
    {
      view: 'meds',
      title: 'Medicine cabinet',
      subtitle: medsLoading
        ? 'Schedules, doses, old & new'
        : `${medicines.length} medicines · schedules, doses, old & new`,
      icon: Pill,
      chip: 'bg-[#f3ecfb] text-[#8b5cf6]',
    },
    {
      view: 'visits',
      title: 'Doctor visits',
      subtitle: appointmentsData.loading
        ? 'Upcoming appointments'
        : nextAppointment
          ? `Next: ${nextAppointment.doctor_name} — ${format(parseISO(nextAppointment.date), 'EEE, MMM d')} · ${formatAppointmentTime(nextAppointment.time)}`
          : 'No upcoming appointments',
      icon: CalendarDays,
      chip: 'bg-[#eef1f9] text-[#4f6bd6]',
    },
    {
      view: 'stays',
      title: 'Hospital stays',
      subtitle: staysSummary?.latest
        ? `Coverage scheduled through ${format(parseISO(staysSummary.latest), 'MMM d')}`
        : "Who's with Dad, and when",
      icon: Users,
      chip: 'bg-[#eaf3ec] text-[#2e7d4f]',
    },
    {
      view: 'conversations',
      title: 'Doctor conversations',
      subtitle: `Recordings & transcripts${typeof transcriptCount === 'number' ? ` · ${transcriptCount} saved` : ''}`,
      icon: Mic,
      chip: 'bg-[#e6f4f1] text-[#0f766e]',
    },
    {
      view: 'reports',
      title: 'Reports & downloads',
      subtitle: 'Weekly & monthly PDFs for the doctor',
      icon: FileText,
      chip: 'bg-[#fdecec] text-[#c0392b]',
    },
  ];

  if (view !== null) {
    return (
      <div className={view === 'stays' || view === 'reports' ? 'mx-auto max-w-4xl' : 'mx-auto max-w-[640px]'}>
        <button onClick={() => setView(null)} className="mb-3 flex items-center gap-1 text-[15px] font-semibold text-[#8a6240]">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          {view === 'meds' && <MedicineScheduleTab />}
          {view === 'visits' && <AppointmentsTab {...appointmentsData} />}
          {view === 'stays' && <HospitalStaysTab />}
          {view === 'conversations' && <TranscriptsTab />}
          {view === 'reports' && <ReportsView />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="pb-4 text-[26px] font-normal text-[#26201a]">Everything else</h1>
      <div className="flex flex-col gap-2">
        {rows.map(row => {
          const Icon = row.icon;
          return (
            <button
              key={row.title}
              onClick={() => setView(row.view)}
              className="flex min-h-[68px] items-center gap-3.5 rounded-2xl border border-[#e9e2d6] bg-white p-3.5 text-left"
            >
              <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${row.chip}`}>
                <Icon className="h-[22px] w-[22px]" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold text-[#26201a]">{row.title}</span>
                <span className="block truncate text-[13px] text-[#8b8175]">{row.subtitle}</span>
              </span>
              <ChevronRight className="h-5 w-5 flex-none text-[#8b8175]" />
            </button>
          );
        })}

        <button
          onClick={onPresentationMode}
          className="hidden min-h-[68px] items-center gap-3.5 rounded-2xl border border-[#e9e2d6] bg-white p-3.5 text-left md:flex"
        >
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#fdf0e6] text-[#c2740c]">
            <Maximize className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold text-[#26201a]">Presentation mode</span>
            <span className="block text-[13px] text-[#8b8175]">Fullscreen for a bedside display</span>
          </span>
        </button>

        <button
          onClick={onSignOut}
          className="flex min-h-[68px] items-center gap-3.5 rounded-2xl border border-[#e9e2d6] bg-white p-3.5 text-left"
        >
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#fdecec] text-[#c0392b]">
            <LogOut className="h-[22px] w-[22px]" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-bold text-[#26201a]">Sign out</span>
          </span>
        </button>
      </div>
    </div>
  );
}
