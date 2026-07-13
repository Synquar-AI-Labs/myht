import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAppointments } from '@/hooks/useAppointments';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { Button } from '@/components/ui/button';
import {
  Heart, LogOut, Maximize, Minimize, Loader2, Clock, BarChart3, MoreHorizontal,
  ClipboardList, CalendarDays, Mic, Pill, Users, ChevronLeft, ChevronRight, FileText,
} from 'lucide-react';
import { QuickLogTab } from '@/components/QuickLogTab';
import { TodayScreen } from '@/components/today/TodayScreen';
import { useIsMobile } from '@/hooks/use-mobile';

// Heavy screens (PDF/report tooling, extra charts) load on first open.
const DashboardTab = lazy(() => import('@/components/DashboardTab').then(m => ({ default: m.DashboardTab })));
const DailyRecordTab = lazy(() => import('@/components/DailyRecordTab').then(m => ({ default: m.DailyRecordTab })));
const AppointmentsTab = lazy(() => import('@/components/AppointmentsTab').then(m => ({ default: m.AppointmentsTab })));
const TranscriptsTab = lazy(() => import('@/components/TranscriptsTab').then(m => ({ default: m.TranscriptsTab })));
const HospitalStaysTab = lazy(() => import('@/components/HospitalStaysTab').then(m => ({ default: m.HospitalStaysTab })));
const MedicineScheduleTab = lazy(() => import('@/components/MedicineScheduleTab').then(m => ({ default: m.MedicineScheduleTab })));

type Tab = 'today' | 'history' | 'more';
type HistorySub = 'record' | 'calendar' | 'reports' | 'transcripts';
type MoreView = null | 'meds' | 'stays';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'today', label: 'Today', icon: Clock },
  { id: 'history', label: 'History', icon: BarChart3 },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

const historySubs: { id: HistorySub; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'record', label: 'Record', icon: ClipboardList },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'transcripts', label: 'Transcripts', icon: Mic },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [historySub, setHistorySub] = useState<HistorySub>('record');
  const [moreView, setMoreView] = useState<MoreView>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useIsMobile();
  useRealtimeSync();
  const healthRecords = useHealthRecords();
  const appointmentsData = useAppointments();
  const { signOut } = useAuth();

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div className="mx-auto flex min-h-screen flex-col bg-[#faf7f2]">
      {/* Header — hidden on phones (the Today screen has its own date header) */}
      {!isFullscreen && (
        <header className="sticky top-0 z-10 hidden border-b bg-background/80 px-4 py-3 backdrop-blur-sm md:block">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <h1 className="text-lg">Health Tracker</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8" title="Presentation Mode">
                <Maximize className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className={`flex-1 overflow-y-auto pb-24 md:overflow-hidden md:px-4 md:pt-4 md:pb-2 ${isFullscreen ? 'pt-2 pb-2' : ''}`}>
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          {/* Mount ONLY the active layout — running both alert engines at once
              (one merely CSS-hidden) risks the two disagreeing. */}
          {activeTab === 'today' && (
            isMobile
              ? <TodayScreen />
              : <QuickLogTab appointmentsData={appointmentsData} />
          )}

          {activeTab === 'history' && (
            <div className="px-4 pt-4 md:px-0 md:pt-0">
              <div className="mb-4 flex gap-1.5 overflow-x-auto">
                {historySubs.map(sub => {
                  const SubIcon = sub.icon;
                  const active = historySub === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setHistorySub(sub.id)}
                      className={`flex flex-none items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                        active
                          ? 'border-[#26201a] bg-[#26201a] text-white'
                          : 'border-[#e9e2d6] bg-white text-[#8b8175]'
                      }`}
                    >
                      <SubIcon className="h-4 w-4" />
                      {sub.label}
                    </button>
                  );
                })}
              </div>
              {historySub === 'record' && <DailyRecordTab {...healthRecords} />}
              {historySub === 'calendar' && <AppointmentsTab {...appointmentsData} />}
              {historySub === 'reports' && <DashboardTab records={healthRecords.records} bpReadings={healthRecords.bpReadings} />}
              {historySub === 'transcripts' && <TranscriptsTab />}
            </div>
          )}

          {activeTab === 'more' && (
            <div className="px-4 pt-4 md:px-0 md:pt-0">
              {moreView === null ? (
                <div className="mx-auto flex max-w-[560px] flex-col gap-2">
                  <button
                    onClick={() => setMoreView('meds')}
                    className="flex min-h-[68px] items-center gap-3.5 rounded-2xl border border-[#e9e2d6] bg-white p-3.5 text-left"
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#f3ecfb] text-[#8b5cf6]">
                      <Pill className="h-[22px] w-[22px]" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-bold text-[#26201a]">Medicine schedule</span>
                      <span className="block text-[13px] text-[#8b8175]">Add or edit medicines, doses & times</span>
                    </span>
                    <ChevronRight className="h-5 w-5 flex-none text-[#8b8175]" />
                  </button>
                  <button
                    onClick={() => setMoreView('stays')}
                    className="flex min-h-[68px] items-center gap-3.5 rounded-2xl border border-[#e9e2d6] bg-white p-3.5 text-left"
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[#eef1f9] text-[#4f6bd6]">
                      <Users className="h-[22px] w-[22px]" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-bold text-[#26201a]">Hospital stays</span>
                      <span className="block text-[13px] text-[#8b8175]">Who's with Dad, and when</span>
                    </span>
                    <ChevronRight className="h-5 w-5 flex-none text-[#8b8175]" />
                  </button>
                  <button
                    onClick={signOut}
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
              ) : (
                <div className="mx-auto max-w-[560px] md:max-w-none">
                  <button
                    onClick={() => setMoreView(null)}
                    className="mb-3 flex items-center gap-1 text-[15px] font-semibold text-[#8a6240]"
                  >
                    <ChevronLeft className="h-4 w-4" /> Back
                  </button>
                  {moreView === 'meds' && <MedicineScheduleTab />}
                  {moreView === 'stays' && <HospitalStaysTab />}
                </div>
              )}
            </div>
          )}
        </Suspense>
      </main>

      {/* Nav — hidden in fullscreen */}
      {!isFullscreen && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#e9e2d6] bg-white md:static md:border-b md:border-t-0">
          <div className="mx-auto flex">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    if (tab.id === 'more') setMoreView(null);
                  }}
                  className={`flex flex-1 flex-col items-center gap-[3px] py-3 transition-colors ${
                    active ? 'text-[#26201a]' : 'text-[#a49a8c]'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className={`text-[13px] ${active ? 'font-bold' : 'font-semibold'}`}>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Floating exit button in fullscreen */}
      {isFullscreen && (
        <button
          onClick={toggleFullscreen}
          className="fixed top-3 right-3 z-50 rounded-full border bg-background/80 p-2 shadow-lg transition-colors hover:bg-muted"
          title="Exit Presentation Mode"
        >
          <Minimize className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default Index;
