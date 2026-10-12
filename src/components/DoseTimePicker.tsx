import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QUARTER_HOURS, doseTimeLabel } from '@/lib/doseTime';
import { useEffect, useRef, useState } from 'react';

export function DoseTimePicker({ value, onChange, label = 'Dose time', excluded = [] }: { value?: number; onChange: (value: number) => void; label?: string; excluded?: number[] }) {
  const [open, setOpen] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || value !== undefined) return;
    const timer = setTimeout(() => {
      const item = content.current?.querySelector<HTMLElement>('[data-time="480"]');
      item?.scrollIntoView({ block: 'center' });
      item?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open, value]);
  const options = [...QUARTER_HOURS];
  if (value !== undefined && !options.includes(value)) options.push(value);
  options.sort((a, b) => a - b);
  return (
    <Select open={open} onOpenChange={setOpen} value={value === undefined ? '' : String(value)} onValueChange={v => onChange(Number(v))}>
      <SelectTrigger aria-label={label}><SelectValue placeholder="Choose a time" /></SelectTrigger>
      <SelectContent ref={content}>
        {options.map(time => <SelectItem className="min-h-11" data-time={time} key={time} value={String(time)} disabled={time !== value && excluded.includes(time)}>{doseTimeLabel(time)}{time % 15 ? ' (earlier entry)' : ''}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
