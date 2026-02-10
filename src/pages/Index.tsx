import { useState } from 'react';
import { useHealthRecords } from '@/hooks/useHealthRecords';
import { useAppointments } from '@/hooks/useAppointments';
import { DashboardTab } from '@/components/DashboardTab';
import { DailyRecordTab } from '@/components/DailyRecordTab';
import { AppointmentsTab } from '@/components/AppointmentsTab';
import { BarChart3, ClipboardList, CalendarDays, Heart } from 'lucide-react';

type Tab = 'dashboard' | 'record' | 'calendar';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'record', label: 'Record', icon: ClipboardList },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('record');
  const { records, addRecord, deleteRecord, getLatestRecord, getRecordByDate } = useHealthRecords();
  const { appointments, addAppointment, deleteAppointment, getUpcoming } = useAppointments();

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-primary" />
          <h1 className="text-lg">Health Tracker</h1>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-20">
        {activeTab === 'dashboard' && <DashboardTab records={records} />}
        {activeTab === 'record' && (
          <DailyRecordTab
            records={records}
            onSave={addRecord}
            onDelete={deleteRecord}
            getLatestRecord={getLatestRecord}
            getRecordByDate={getRecordByDate}
          />
        )}
        {activeTab === 'calendar' && (
          <AppointmentsTab
            appointments={appointments}
            onAdd={addAppointment}
            onDelete={deleteAppointment}
            getUpcoming={getUpcoming}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-background/95 backdrop-blur-sm">
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
    </div>
  );
};

export default Index;
