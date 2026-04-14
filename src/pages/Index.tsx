import { useState, useCallback, useEffect } from 'react';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAppointments } from '@/hooks/useAppointments';
import { useAuth } from '@/hooks/useAuth';
import { DashboardTab } from '@/components/DashboardTab';
import { DailyRecordTab } from '@/components/DailyRecordTab';
import { AppointmentsTab } from '@/components/AppointmentsTab';
import { Button } from '@/components/ui/button';
import { TranscriptsTab } from '@/components/TranscriptsTab';
import { BarChart3, ClipboardList, CalendarDays, Mic, Heart, LogOut, Users, Zap, Maximize, Minimize } from 'lucide-react';
import { HospitalStaysTab } from '@/components/HospitalStaysTab';
import { QuickLogTab } from '@/components/QuickLogTab';

type Tab = 'dashboard' | 'record' | 'calendar' | 'stays' | 'transcripts' | 'quicklog';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'quicklog', label: 'Quick Log', icon: Zap },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'record', label: 'Record', icon: ClipboardList },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'stays', label: 'Stays', icon: Users },
  { id: 'transcripts', label: 'Transcripts', icon: Mic },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('quicklog');
  const [isFullscreen, setIsFullscreen] = useState(false);
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
    <div className="mx-auto flex min-h-screen lg:max-w-none max-w-lg flex-col bg-background">
      {/* Header — hidden in fullscreen */}
      {!isFullscreen && (
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              <h1 className="text-lg">Health Tracker</h1>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 hidden lg:inline-flex" title="Presentation Mode">
                <Maximize className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className={`flex-1 overflow-y-auto lg:overflow-hidden px-4 pt-4 pb-20 lg:pb-4 ${isFullscreen ? 'pt-2 pb-2' : ''}`}>
        {activeTab === 'quicklog' && <QuickLogTab />}
        {activeTab === 'dashboard' && <DashboardTab records={healthRecords.records} />}
        {activeTab === 'record' && <DailyRecordTab {...healthRecords} />}
        {activeTab === 'calendar' && <AppointmentsTab {...appointmentsData} />}
        {activeTab === 'stays' && <HospitalStaysTab />}
        {activeTab === 'transcripts' && <TranscriptsTab />}
      </main>

      {/* Nav — hidden in fullscreen */}
      {!isFullscreen && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm lg:static lg:border-t-0 lg:border-b">
          <div className="mx-auto flex max-w-lg">
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
