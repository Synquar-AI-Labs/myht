import { useState } from 'react';
import { Appointment } from '@/types/health';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  onAdd: (appt: Omit<Appointment, 'id' | 'createdAt'>) => void;
  onDelete: (id: string) => void;
  getUpcoming: () => Appointment[];
}

const emptyAppt = {
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '09:00',
  doctorName: '',
  address: '',
  reason: '',
  description: '',
};

export function AppointmentsTab({ appointments, onAdd, onDelete, getUpcoming }: AppointmentsTabProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyAppt);

  const upcoming = getUpcoming();

  const appointmentDates = appointments.map(a => parseISO(a.date));
  const dayAppointments = appointments.filter(a => isSameDay(parseISO(a.date), selectedDate));

  const update = <K extends keyof typeof emptyAppt>(key: K, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleAdd = () => {
    if (!form.doctorName.trim() || !form.reason.trim()) {
      toast.error('Please fill in doctor name and reason');
      return;
    }
    if (form.doctorName.length > 100 || form.reason.length > 200 || form.address.length > 300 || form.description.length > 500) {
      toast.error('Input too long');
      return;
    }
    onAdd(form);
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

  const modifiers = {
    appointment: appointmentDates,
  };

  const modifiersStyles = {
    appointment: {
      fontWeight: 700,
      textDecoration: 'underline',
      textDecorationColor: 'hsl(var(--primary))',
      textUnderlineOffset: '4px',
    } as React.CSSProperties,
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Calendar */}
      <Card className="border-none shadow-sm">
        <CardContent className="flex justify-center p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
          />
        </CardContent>
      </Card>

      {/* Selected Day Appointments */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-medium">
          {format(selectedDate, 'EEEE, MMM d')}
        </h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[360px]">
            <DialogHeader>
              <DialogTitle>New Appointment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={form.date} onChange={e => update('date', e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Time</Label>
                  <Input type="time" value={form.time} onChange={e => update('time', e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Doctor Name</Label>
                <Input value={form.doctorName} onChange={e => update('doctorName', e.target.value)} placeholder="Dr. Smith" className="mt-1" maxLength={100} />
              </div>
              <div>
                <Label className="text-xs">Address</Label>
                <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Clinic address" className="mt-1" maxLength={300} />
              </div>
              <div>
                <Label className="text-xs">Reason</Label>
                <Input value={form.reason} onChange={e => update('reason', e.target.value)} placeholder="Check-up, follow-up..." className="mt-1" maxLength={200} />
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Additional notes..." className="mt-1 min-h-[60px]" maxLength={500} />
              </div>
              <Button onClick={handleAdd} className="w-full">Save Appointment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {dayAppointments.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">No appointments on this day.</p>
      ) : (
        <div className="space-y-2">
          {dayAppointments.map(appt => (
            <AppointmentCard key={appt.id} appt={appt} onDelete={onDelete} />
          ))}
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-sm font-medium text-muted-foreground">Upcoming</h3>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map(appt => (
              <AppointmentCard key={appt.id} appt={appt} onDelete={onDelete} showDate />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AppointmentCard({ appt, onDelete, showDate }: { appt: Appointment; onDelete: (id: string) => void; showDate?: boolean }) {
  return (
    <Card className="border-none shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-sm">{appt.doctorName}</p>
            <p className="text-xs text-muted-foreground">{appt.reason}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {showDate && (
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {format(parseISO(appt.date), 'MMM d')}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {appt.time}
              </span>
              {appt.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {appt.address}
                </span>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { onDelete(appt.id); toast.success('Appointment deleted'); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
