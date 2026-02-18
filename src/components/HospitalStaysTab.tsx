import { useState } from 'react';
import { startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, format, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHospitalStays, HospitalStay } from '@/hooks/useHospitalStays';
import { StayFormSheet } from '@/components/StayFormSheet';
import { toast } from 'sonner';

const PERSON_COLORS: Record<string, string> = {
  Fahad: '#3B82F6',
  Shahwar: '#22C55E',
  Umair: '#F97316',
  Affan: '#A855F7',
  Azra: '#EC4899',
  Nayab: '#14B8A6',
  Shaheryar: '#EAB308',
};

const TIMELINE_START = 6;
const TIMELINE_HOURS = 18; // 6 AM to 12 AM

const TIME_LABELS = [6, 9, 12, 15, 18, 21];

function formatHourShort(h: number) {
  if (h === 0 || h === 24) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

export function HospitalStaysTab() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const now = new Date();
  const baseWeekStart = startOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const baseWeekEnd = endOfWeek(addWeeks(now, weekOffset), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: baseWeekStart, end: baseWeekEnd });

  const { stays, isLoading, addStay, deleteStay } = useHospitalStays(baseWeekStart, baseWeekEnd);

  const handleAddStay = (data: Parameters<typeof addStay.mutate>[0]) => {
    addStay.mutate(data, {
      onSuccess: () => toast.success('Stay added'),
      onError: () => toast.error('Failed to add stay'),
    });
  };

  const handleDelete = (id: string) => {
    deleteStay.mutate(id, {
      onSuccess: () => toast.success('Deleted'),
      onError: () => toast.error('Failed to delete'),
    });
  };

  const openSheet = (day: Date) => {
    setSelectedDate(day);
    setSheetOpen(true);
  };

  const staysForDay = (day: Date): HospitalStay[] =>
    stays.filter(s => isSameDay(new Date(s.date + 'T00:00:00'), day));

  return (
    <div className="space-y-3">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium">
          {format(baseWeekStart, 'MMM d')} – {format(baseWeekEnd, 'MMM d, yyyy')}
        </span>
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 px-1">
        {Object.entries(PERSON_COLORS).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1">
            <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-muted-foreground">{name}</span>
          </div>
        ))}
      </div>

      {/* Timeline header */}
      <div className="flex">
        <div className="w-14 shrink-0" />
        <div className="relative flex-1 flex">
          {TIME_LABELS.map(h => (
            <span
              key={h}
              className="absolute text-[9px] text-muted-foreground -translate-x-1/2"
              style={{ left: `${((h - TIMELINE_START) / TIMELINE_HOURS) * 100}%` }}
            >
              {formatHourShort(h)}
            </span>
          ))}
        </div>
      </div>

      {/* Day rows */}
      <div className="space-y-1 mt-2">
        {days.map(day => {
          const dayStays = staysForDay(day);
          const isToday = isSameDay(day, now);

          return (
            <div
              key={day.toISOString()}
              className={`flex rounded-lg border p-1.5 ${isToday ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
            >
              {/* Day label */}
              <button
                className="w-14 shrink-0 flex flex-col items-center justify-center"
                onClick={() => openSheet(day)}
              >
                <span className="text-[10px] text-muted-foreground">{format(day, 'EEE')}</span>
                <span className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                  {format(day, 'd')}
                </span>
              </button>

              {/* Timeline area */}
              <div className="flex-1 min-h-[28px] relative">
                {/* Grid lines */}
                {TIME_LABELS.map(h => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 border-l border-border/40"
                    style={{ left: `${((h - TIMELINE_START) / TIMELINE_HOURS) * 100}%` }}
                  />
                ))}

                {/* Stay bars */}
                {dayStays.length === 0 && (
                  <button
                    className="absolute inset-0 flex items-center justify-center"
                    onClick={() => openSheet(day)}
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </button>
                )}
                {dayStays.map((stay, idx) => {
                  const color = PERSON_COLORS[stay.person_name] || '#888';
                  const left = ((Math.max(stay.start_hour, TIMELINE_START) - TIMELINE_START) / TIMELINE_HOURS) * 100;
                  const width = ((Math.min(stay.end_hour, TIMELINE_START + TIMELINE_HOURS) - Math.max(stay.start_hour, TIMELINE_START)) / TIMELINE_HOURS) * 100;

                  const barStyle: React.CSSProperties = stay.is_unavailable
                    ? {
                        left: `${left}%`,
                        width: `${width}%`,
                        top: `${idx * 24}px`,
                        background: `repeating-linear-gradient(45deg, ${color}33, ${color}33 4px, ${color}66 4px, ${color}66 8px)`,
                        border: `1px dashed ${color}`,
                      }
                    : {
                        left: `${left}%`,
                        width: `${width}%`,
                        top: `${idx * 24}px`,
                        backgroundColor: color,
                      };

                  return (
                    <div
                      key={stay.id}
                      className="absolute h-[22px] rounded-sm flex items-center px-1 group cursor-pointer"
                      style={barStyle}
                    >
                      <span
                        className="text-[9px] font-medium truncate leading-none"
                        style={{ color: stay.is_unavailable ? color : '#fff' }}
                      >
                        {stay.person_name}{stay.is_unavailable ? ' ✕' : ''}
                      </span>
                      <button
                        className="ml-auto opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={(e) => { e.stopPropagation(); handleDelete(stay.id); }}
                      >
                        <X className="h-3 w-3" style={{ color: stay.is_unavailable ? color : '#fff' }} />
                      </button>
                    </div>
                  );
                })}
                {/* Expand row height for stacked bars */}
                {dayStays.length > 0 && (
                  <div style={{ height: `${Math.max(dayStays.length * 24, 28)}px` }} />
                )}
              </div>

              {/* Add button */}
              {dayStays.length > 0 && (
                <button
                  className="shrink-0 w-6 flex items-center justify-center"
                  onClick={() => openSheet(day)}
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {isLoading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}

      <StayFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        defaultDate={selectedDate}
        onSave={handleAddStay}
      />
    </div>
  );
}
