import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { urgencyFor, urgencyStyle } from '@/lib/medicineUrgency';
import { UrgencyBadge } from './UrgencyBadge';
import { groupDoseTimes, groupUpcoming, relativeDoseTime, elapsedDoseTime, visibleDoseGroups } from '@/lib/doseGroups';
import { doseLabel, timeLabel, scheduledDoseDetail, type GivenItem, type UpcomingItem, type SlotState, type DoseSkip } from './todaySchedule';
import type { Medicine } from '@/hooks/useMedicines';

type SkippedItem = { skip: DoseSkip; at: Date; medicine: Medicine | undefined };

export function DoseTimeGroups({ given, upcoming, skipped = [], now, onGiven, onUpcoming, onUndoSkip }: {
  given?: GivenItem[]; upcoming?: UpcomingItem[]; now: Date;
  onGiven?: (item: GivenItem) => void; onUpcoming?: (item: UpcomingItem) => void;
  skipped?: SkippedItem[]; onUndoSkip?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const groups: { at: Date; items: (GivenItem | UpcomingItem | SkippedItem)[]; state?: SlotState }[] = upcoming ? groupUpcoming(upcoming) : groupDoseTimes<GivenItem | SkippedItem>([...(given ?? []), ...skipped].sort((a, b) => b.at.getTime() - a.at.getTime()));
  const nearest = upcoming ? groups.reduce<number | null>((best, group) => best === null || Math.abs(group.at.getTime() - now.getTime()) < Math.abs(best - now.getTime()) ? group.at.getTime() : best, null) : null;
  return <>
    {(expanded ? groups : visibleDoseGroups(groups, now, !!upcoming)).map(group => {
      const key = group.at.getTime();
      const state = group.state ?? 'scheduled';
      const urgency = urgencyFor(state);
      const isOpen = open[key] ?? (!!urgency || key === nearest);
      return <div key={key} data-dose-group className="border-b border-[#f3ede2] last:border-b-0">
        <button style={urgencyStyle(state)} className={`dose-time-header ${upcoming ? 'dose-upcoming-header' : 'dose-given-header'} min-h-11 w-full rounded-xl px-2 text-left ${urgency?.motion ?? ''}`} aria-expanded={isOpen} onClick={() => setOpen(previous => ({ ...previous, [key]: !isOpen }))}>
          <span className="dose-time whitespace-nowrap font-bold">{timeLabel(group.at)}</span>
          <span className="dose-relative text-sm">{upcoming ? relativeDoseTime(group.at, now) : elapsedDoseTime(group.at, now)}</span>
          <span className="dose-count text-right text-sm">{upcoming ? `${group.items.length} ${group.items.length === 1 ? 'medicine' : 'medicines'}` : `${group.items.filter(item => 'log' in item).length} given${group.items.some(item => 'skip' in item) ? ` · ${group.items.filter(item => 'skip' in item).length} skipped` : ''}`}</span>
          <span className="dose-controls flex items-center justify-end gap-2"><span className="dose-status flex justify-end"><UrgencyBadge state={state} /></span><ChevronDown aria-hidden="true" className={`dose-chevron h-4 w-4 flex-none transition-transform ${isOpen ? 'rotate-180' : ''}`} /></span>
        </button>
        {isOpen && <div className="px-2 pb-2">{group.items.map(item => {
          const medicine = item.medicine;
          if ('skip' in item) return <div key={item.skip.id} className="flex items-center gap-2 py-2 text-sm text-[#8b8175]">
            <span className="dose-skip min-w-0 flex-1">Skipped: {medicine?.name ?? 'Medicine'} ({timeLabel(item.at)}){item.skip.reason ? `, ${item.skip.reason.toLowerCase()}` : ''}, by {item.skip.recorded_by}</span>
            <button className="dose-undo min-h-11 min-w-11 text-right font-semibold" onClick={() => onUndoSkip?.(item.skip.id)}>Undo</button>
          </div>;
          return <button key={'log' in item ? item.log.id : item.medicine.id} className="flex min-h-11 w-full items-center gap-3 py-2 text-left" onClick={() => 'log' in item ? onGiven?.(item) : onUpcoming?.(item)}>
            <span className="min-w-0 flex-1 break-words">
            <span className="dose-name block font-bold">{medicine?.name ?? 'Unknown'}</span>
            <span className="dose-detail block text-sm text-[#8b8175]">{doseLabel(medicine)}{'log' in item && item.log.recorded_by ? ` · ${item.log.recorded_by}` : ''}{'log' in item && scheduledDoseDetail(item.log) ? ` · ${scheduledDoseDetail(item.log)}` : ''}</span>
            </span>
            {!('log' in item) && <span className="dose-record flex-none text-sm font-semibold text-[#8a6240]">Record</span>}
          </button>;
        })}</div>}
      </div>;
    })}
    {(expanded || visibleDoseGroups(groups, now, !!upcoming).length < groups.length) && <button className="min-h-11 w-full text-sm font-semibold" onClick={() => setExpanded(value => !value)}>{expanded ? 'Show less' : `Show ${groups.length - visibleDoseGroups(groups, now, !!upcoming).length} more times`}</button>}
  </>;
}
