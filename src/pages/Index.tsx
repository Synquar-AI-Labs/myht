import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { Minimize, Loader2, Clock, BarChart3, MoreHorizontal } from 'lucide-react';
import { TodayScreen } from '@/components/today/TodayScreen';

const HistoryTab = lazy(() => import('@/components/history/HistoryTab').then(m => ({ default: m.HistoryTab })));
const MoreShelf = lazy(() => import('@/components/more/MoreShelf').then(m => ({ default: m.MoreShelf })));

type Tab = 'today' | 'history' | 'more';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'today', label: 'Today', icon: Clock },
  { id: 'history', label: 'History', icon: BarChart3 },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [isFullscreen, setIsFullscreen] = useState(false);
  useRealtimeSync();
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
    <div className="relative mx-auto flex min-h-screen flex-col bg-[#faf7f2]">
      {/* Floating pill nav — tablet & desktop */}
      {!isFullscreen && (
        <nav className="absolute right-6 top-5 z-30 hidden items-center gap-1 rounded-2xl border border-[#e9e2d6] bg-white p-1.5 shadow-sm md:flex">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-[15px] transition-colors ${
                  active ? 'bg-[#26201a] font-bold text-white' : 'font-semibold text-[#8b8175] hover:bg-[#f3ede2]'
                }`}
              >
                <Icon className="h-[18px] w-[18px]" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      )}

      <main className={`flex-1 overflow-y-auto pb-24 md:pb-10 ${isFullscreen ? 'pt-2' : ''}`}>
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
          {activeTab === 'today' && <TodayScreen />}
          {activeTab === 'history' && (
            <div className="px-4 pt-5 md:px-8 md:pt-24">
              <HistoryTab />
            </div>
          )}
          {activeTab === 'more' && (
            <div className="px-4 pt-5 md:px-8 md:pt-24">
              <MoreShelf onPresentationMode={toggleFullscreen} onSignOut={signOut} />
            </div>
          )}
        </Suspense>
      </main>

      {/* Bottom nav — phones only */}
      {!isFullscreen && (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#e9e2d6] bg-white md:hidden">
          <div className="mx-auto flex">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
