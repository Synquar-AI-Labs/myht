import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { groupGiven, groupUpcoming, relativeDoseTime, elapsedDoseTime, visibleDoseGroups } from '@/lib/doseGroups';
import { doseLabel, timeLabel, type GivenItem, type UpcomingItem, type SlotState } from './todaySchedule';

export function DoseTimeGroups({ given, upcoming, now, onGiven, onUpcoming }: {
  given?: GivenItem[]; upcoming?: UpcomingItem[]; now: Date;
  onGiven?: (item: GivenItem) => void; onUpcoming?: (item: UpcomingItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const groups: { at: Date; items: (GivenItem | UpcomingItem)[]; state?: SlotState }[] = upcoming ? groupUpcoming(upcoming) : groupGiven(given ?? []);
  const nearest = upcoming ? groups.reduce<number | null>((best, group) => best === null || Math.abs(group.at.getTime() - now.getTime()) < Math.abs(best - now.getTime()) ? group.at.getTime() : best, null) : null;
  return <>
    {(expanded ? groups : visibleDoseGroups(groups, now, !!upcoming)).map(group => {
      const key = group.at.getTime();
      const state = group.state ?? 'scheduled';
      const isOpen = open[key] ?? key === nearest;
      return <div key={key} className="border-b border-[#f3ede2] last:border-b-0">
        <button className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-2 py-3 text-left ${state === 'due' ? 'animate-due-flash-row' : state === 'overdue' ? 'text-[#c2410c]' : ''}`} aria-expanded={isOpen} onClick={() => setOpen(previous => ({ ...previous, [key]: !isOpen }))}>
          <span className="font-bold">{timeLabel(group.at)}</span>
          <span className="text-sm">{upcoming ? relativeDoseTime(group.at, now) : elapsedDoseTime(group.at, now)}</span>
          <span className="text-sm">{group.items.length} {upcoming ? (group.items.length === 1 ? 'medicine' : 'medicines') : 'given'}{state === 'due' ? ' · Due' : state === 'overdue' ? ' · Overdue' : ''}</span>
          <ChevronDown aria-hidden="true" className={`h-4 w-4 flex-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && <div className="pb-2">{group.items.map(item => {
          const medicine = item.medicine;
          return <button key={'log' in item ? item.log.id : item.medicine.id} className="flex min-h-11 w-full items-center gap-3 py-2 text-left" onClick={() => 'log' in item ? onGiven?.(item) : onUpcoming?.(item)}>
            <span className="min-w-0 flex-1 break-words">
            <span className="block font-bold">{medicine?.name ?? 'Unknown'}</span>
            <span className="block text-sm text-[#8b8175]">{doseLabel(medicine)}{'log' in item && item.log.recorded_by ? ` · ${item.log.recorded_by}` : ''}</span>
            </span>
            {!('log' in item) && <span className="flex-none text-sm font-semibold text-[#8a6240]">Record</span>}
          </button>;
        })}</div>}
      </div>;
    })}
    {groups.length > 6 && <button className="min-h-11 w-full text-sm font-semibold" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `Show ${groups.length - 6} more times`}</button>}
  </>;
}
