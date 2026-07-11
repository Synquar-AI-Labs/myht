import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAppointments } from '@/hooks/useAppointments';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { Button } from '@/components/ui/button';
import { BarChart3, ClipboardList, CalendarDays, Mic, Heart, LogOut, Users, Zap, Maximize, Minimize, Pill, Loader2 } from 'lucide-react';
import { QuickLogTab } from '@/components/QuickLogTab';

// Quick Log is the default/home tab, so it loads eagerly. The rest — and their
// heavy dependencies (jsPDF, extra charts) — load only when first opened.
const DashboardTab = lazy(() => import('@/components/DashboardTab').then(m => ({ default: m.DashboardTab })));
const DailyRecordTab = lazy(() => import('@/components/DailyRecordTab').then(m => ({ default: m.DailyRecordTab })));
const AppointmentsTab = lazy(() => import('@/components/AppointmentsTab').then(m => ({ default: m.AppointmentsTab })));
const TranscriptsTab = lazy(() => import('@/components/TranscriptsTab').then(m => ({ default: m.TranscriptsTab })));
const HospitalStaysTab = lazy(() => import('@/components/HospitalStaysTab').then(m => ({ default: m.HospitalStaysTab })));
const MedicineScheduleTab = lazy(() => import('@/components/MedicineScheduleTab').then(m => ({ default: m.MedicineScheduleTab })));

type Tab = 'dashboard' | 'record' | 'calendar' | 'stays' | 'transcripts' | 'quicklog' | 'meds';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'quicklog', label: 'Quick Log', icon: Zap },
  { id: 'meds', label: 'Meds', icon: Pill },
  { id: 'dashboard', label: 'Reports', icon: BarChart3 },
  { id: 'record', label: 'Record', icon: ClipboardList },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'stays', label: 'Stays', icon: Users },
  { id: 'transcripts', label: 'Transcripts', icon: Mic },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('quicklog');
  const [isFullscreen, setIsFullscreen] = useState(false);
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
    <div className="mx-auto flex min-h-screen flex-col bg-background">
      {/* Header — hidden in fullscreen */}
      {!isFullscreen && (
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <h1 className="text-lg">Health Tracker</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 hidden md:inline-flex" title="Presentation Mode">
                <Maximize className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className={`flex-1 overflow-y-auto md:overflow-hidden px-4 pt-4 pb-20 md:pb-2 ${isFullscreen ? 'pt-2 pb-2' : ''}`}>
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          {activeTab === 'quicklog' && <QuickLogTab appointmentsData={appointmentsData} />}
          {activeTab === 'dashboard' && <DashboardTab records={healthRecords.records} bpReadings={healthRecords.bpReadings} />}
          {activeTab === 'record' && <DailyRecordTab {...healthRecords} />}
          {activeTab === 'calendar' && <AppointmentsTab {...appointmentsData} />}
          {activeTab === 'stays' && <HospitalStaysTab />}
          {activeTab === 'meds' && <MedicineScheduleTab />}
          {activeTab === 'transcripts' && <TranscriptsTab />}
        </Suspense>
      </main>

      {/* Nav — hidden in fullscreen */}
      {!isFullscreen && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm md:static md:border-t-0 md:border-b">
          <div className="mx-auto flex">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-2 transition-colors ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
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
          className="fixed top-3 right-3 z-50 rounded-full bg-background/80 border shadow-lg p-2 hover:bg-muted transition-colors"
          title="Exit Presentation Mode"
        >
          <Minimize className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default Index;
