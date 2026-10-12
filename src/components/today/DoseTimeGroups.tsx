import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { urgencyFor, urgencyStyle } from '@/lib/medicineUrgency';
import { UrgencyBadge } from './UrgencyBadge';
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
      const urgency = urgencyFor(state);
      const isOpen = open[key] ?? (!!urgency || key === nearest);
      return <div key={key} className="border-b border-[#f3ede2] last:border-b-0">
        <button style={urgencyStyle(state)} className={`flex min-h-11 w-full flex-col gap-2 rounded-xl px-2 py-3 text-left ${urgency?.motion ?? ''}`} aria-expanded={isOpen} onClick={() => setOpen(previous => ({ ...previous, [key]: !isOpen }))}>
          <span className="flex w-full items-center justify-between gap-2">
            <span className="whitespace-nowrap font-bold">{timeLabel(group.at)}</span>
            <span className="flex flex-none items-center gap-2"><UrgencyBadge state={state} /><ChevronDown aria-hidden="true" className={`h-4 w-4 flex-none transition-transform ${isOpen ? 'rotate-180' : ''}`} /></span>
          </span>
          <span className="flex w-full items-center justify-between gap-2 text-sm">
            <span>{upcoming ? relativeDoseTime(group.at, now) : elapsedDoseTime(group.at, now)}</span>
            <span>{group.items.length} {upcoming ? (group.items.length === 1 ? 'medicine' : 'medicines') : 'given'}</span>
          </span>
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
    {(expanded || visibleDoseGroups(groups, now, !!upcoming).length < groups.length) && <button className="min-h-11 w-full text-sm font-semibold" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `Show ${groups.length - visibleDoseGroups(groups, now, !!upcoming).length} more times`}</button>}
  </>;
}
