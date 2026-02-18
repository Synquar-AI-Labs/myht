import { useState } from 'react';
import { format, eachDayOfInterval, isSameDay } from 'date-fns';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAY_PEOPLE } from '@/types/health';

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0..24

function formatHour(h: number) {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: Date;
  onSave: (rows: {
    person_name: string;
    date: string;
    start_hour: number;
    end_hour: number;
    is_unavailable: boolean;
  }[]) => void;
}

export function StayFormSheet({ open, onOpenChange, defaultDate, onSave }: Props) {
  const [person, setPerson] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>(defaultDate);
  const [endDate, setEndDate] = useState<Date>(defaultDate);
  const [startHour, setStartHour] = useState<number>(9);
  const [endHour, setEndHour] = useState<number>(17);
  const [isUnavailable, setIsUnavailable] = useState(false);

  // Reset when defaultDate changes
  const handleOpen = (o: boolean) => {
    if (o) {
      setStartDate(defaultDate);
      setEndDate(defaultDate);
    }
    onOpenChange(o);
  };

  const isSingleDay = isSameDay(startDate, endDate);
  const isValid = person && (isSingleDay ? startHour < endHour : true);

  const handleSave = () => {
    if (!isValid) return;

    if (isSingleDay) {
      onSave([{
        person_name: person,
        date: format(startDate, 'yyyy-MM-dd'),
        start_hour: startHour,
        end_hour: endHour,
        is_unavailable: isUnavailable,
      }]);
    } else {
      // Multi-day: split into per-day rows
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const rows = days.map((day, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === days.length - 1;
        return {
          person_name: person,
          date: format(day, 'yyyy-MM-dd'),
          start_hour: isFirst ? startHour : 0,
          end_hour: isLast ? endHour : 24,
          is_unavailable: isUnavailable,
        };
      });
      onSave(rows);
    }

    setPerson('');
    setStartHour(9);
    setEndHour(17);
    setIsUnavailable(false);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {isUnavailable ? 'Mark Unavailable' : 'Add Stay'}
          </DrawerTitle>
          <DrawerDescription>Select who, when, and how long</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-4 pb-2">
          {/* Person */}
          <div>
            <Label>Person</Label>
            <Select value={person} onValueChange={setPerson}>
              <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
              <SelectContent>
                {STAY_PEOPLE.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(startDate, 'MMM d')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => {
                      if (d) {
                        setStartDate(d);
                        if (d > endDate) setEndDate(d);
                      }
                    }}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(endDate, 'MMM d')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(d) => { if (d && d >= startDate) setEndDate(d); }}
                    disabled={(d) => d < startDate}
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From</Label>
              <Select value={String(startHour)} onValueChange={v => setStartHour(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.filter(h => h < 24).map(h => (
                    <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To</Label>
              <Select value={String(endHour)} onValueChange={v => setEndHour(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOURS.filter(h => isSingleDay ? h > startHour : h > 0).map(h => (
                    <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unavailable toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={isUnavailable} onCheckedChange={setIsUnavailable} />
            <Label>Mark as Unavailable</Label>
          </div>
        </div>

        <DrawerFooter>
          <Button onClick={handleSave} disabled={!isValid}>
            {isUnavailable ? 'Mark Unavailable' : 'Add Stay'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
