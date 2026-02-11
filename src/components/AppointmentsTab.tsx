import { useState, useMemo } from 'react';
import { Appointment, AppointmentForm } from '@/types/health';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format, parseISO, isSameDay } from 'date-fns';
import { Plus, MapPin, Clock, Trash2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

interface AppointmentsTabProps {
  appointments: Appointment[];
  onAdd?: never;
  addAppointment: (form: AppointmentForm) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  getUpcoming: () => Appointment[];
}

const emptyAppt: AppointmentForm = {
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '09:00', doctorName: '', address: '', reason: '', description: '',
};

export function AppointmentsTab({ appointments, addAppointment, deleteAppointment, getUpcoming }: AppointmentsTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<AppointmentForm>(emptyAppt);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const todayAppointments = appointments.filter(a => a.date === todayStr);
  const upcoming = appointments.filter(a => a.date > todayStr);
  const dayAppointments = appointments.filter(a => isSameDay(parseISO(a.date), selectedDate));
  const appointmentDates = appointments.map(a => parseISO(a.date));

  const update = <K extends keyof AppointmentForm>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAdd = async () => {
    if (!form.doctorName.trim() || !form.reason.trim()) { toast.error('Please fill in doctor name and reason'); return; }
    await addAppointment(form);
    setForm({ ...emptyAppt, date: format(selectedDate, 'yyyy-MM-dd') });
    setDialogOpen(false);
    toast.success('Appointment added');
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setForm(prev => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
    }
  };

  // Count appointments per date
  const appointmentCountByDate = appointments.reduce<Record<string, number>>((acc, a) => {
    acc[a.date] = (acc[a.date] || 0) + 1;
    return acc;
  }, {});

  const modifiers = { appointment: appointmentDates };
  const modifiersStyles = {
    appointment: {
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
      borderRadius: '9999px',
      fontWeight: 700,
    } as React.CSSProperties,
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Today's Appointments */}
      <div>
        <h3 className="text-sm font-semibold px-1 mb-2">Today — {format(today, 'MMM d')}</h3>
        {todayAppointments.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No appointments today.</p>
        ) : (
          <div className="space-y-2">
            {todayAppointments.map(appt => (
              <AppointmentCard key={appt.id} appt={appt} onDelete={deleteAppointment} />
            ))}
          </div>
        )}
      </div>

      {/* Calendar */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Calendar</span>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> Add</Button>
              </DialogTrigger>
              <DialogContent className="max-w-[360px]">
                <DialogHeader><DialogTitle>New Appointment</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Date</Label><Input type="date" value={form.date} onChange={e => update('date', e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-xs">Time</Label><Input type="time" value={form.time} onChange={e => update('time', e.target.value)} className="mt-1" /></div>
                  </div>
                  <div><Label className="text-xs">Doctor Name</Label><Input value={form.doctorName} onChange={e => update('doctorName', e.target.value)} placeholder="Dr. Smith" className="mt-1" maxLength={100} /></div>
                  <div><Label className="text-xs">Address</Label><Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Clinic address" className="mt-1" maxLength={300} /></div>
                  <div><Label className="text-xs">Reason</Label><Input value={form.reason} onChange={e => update('reason', e.target.value)} placeholder="Check-up, follow-up..." className="mt-1" maxLength={200} /></div>
                  <div><Label className="text-xs">Notes (optional)</Label><Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Additional notes..." className="mt-1 min-h-[60px]" maxLength={500} /></div>
                  <Button onClick={handleAdd} className="w-full">Save Appointment</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            components={{
              DayContent: ({ date }) => {
                const key = format(date, 'yyyy-MM-dd');
                const count = appointmentCountByDate[key];
                return (
                  <div className="relative flex items-center justify-center w-full h-full">
                    <span>{date.getDate()}</span>
                    {count && (
                      <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                        {count}
                      </span>
                    )}
                  </div>
                );
              },
            }}
          />
          </div>
        </CardContent>
      </Card>


      {/* Upcoming / Filtered by selected date */}
      {(() => {
        const selectedStr = format(selectedDate, 'yyyy-MM-dd');
        const isSelectedToday = isSameDay(selectedDate, today);
        const filtered = isSelectedToday
          ? upcoming
          : upcoming.filter(a => a.date === selectedStr);
        const label = isSelectedToday
          ? 'Upcoming'
          : `Appointments — ${format(selectedDate, 'EEEE, MMM d')}`;
        return filtered.length > 0 ? (
          <div>
            <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">{label}</h3>
            <div className="space-y-2">
              {filtered.map(appt => (
                <AppointmentCard key={appt.id} appt={appt} onDelete={deleteAppointment} showDate />
              ))}
            </div>
          </div>
        ) : !isSelectedToday ? (
          <p className="px-1 text-sm text-muted-foreground">No appointments on {format(selectedDate, 'MMM d')}.</p>
        ) : null;
      })()}
    </div>
  );
}

function AppointmentCard({ appt, onDelete, showDate }: { appt: Appointment; onDelete: (id: string) => Promise<void>; showDate?: boolean }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-sm">{appt.doctor_name}</p>
            <p className="text-xs text-muted-foreground">{appt.reason}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {showDate && <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{format(parseISO(appt.date), 'MMM d')}</span>}
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{appt.time}</span>
              {appt.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{appt.address}</span>}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={async () => { await onDelete(appt.id); toast.success('Appointment deleted'); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
