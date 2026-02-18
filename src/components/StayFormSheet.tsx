import { useState } from 'react';
import { format } from 'date-fns';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { STAY_PEOPLE } from '@/types/health';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6); // 6..24

function formatHour(h: number) {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate: Date;
  onSave: (data: {
    person_name: string;
    date: string;
    start_hour: number;
    end_hour: number;
    is_unavailable: boolean;
  }) => void;
}

export function StayFormSheet({ open, onOpenChange, defaultDate, onSave }: Props) {
  const [person, setPerson] = useState<string>('');
  const [startHour, setStartHour] = useState<number>(9);
  const [endHour, setEndHour] = useState<number>(17);
  const [isUnavailable, setIsUnavailable] = useState(false);

  const handleSave = () => {
    if (!person || startHour >= endHour) return;
    onSave({
      person_name: person,
      date: format(defaultDate, 'yyyy-MM-dd'),
      start_hour: startHour,
      end_hour: endHour,
      is_unavailable: isUnavailable,
    });
    setPerson('');
    setStartHour(9);
    setEndHour(17);
    setIsUnavailable(false);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {isUnavailable ? 'Mark Unavailable' : 'Add Stay'} — {format(defaultDate, 'EEE, MMM d')}
          </DrawerTitle>
          <DrawerDescription>Select who and when</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-4">
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
                  {HOURS.filter(h => h > startHour).map(h => (
                    <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isUnavailable} onCheckedChange={setIsUnavailable} />
            <Label>Mark as Unavailable</Label>
          </div>
        </div>

        <DrawerFooter>
          <Button onClick={handleSave} disabled={!person || startHour >= endHour}>
            {isUnavailable ? 'Mark Unavailable' : 'Add Stay'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
