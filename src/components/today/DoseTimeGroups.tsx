import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { urgencyFor, urgencyStyle } from '@/lib/medicineUrgency';
import { UrgencyBadge } from './UrgencyBadge';
import { groupDoseTimes, groupUpcoming, headerDoseTime, visibleDoseGroups } from '@/lib/doseGroups';
import { doseLabel, timeLabel, scheduledDoseDetail, type GivenItem, type UpcomingItem, type SlotState, type DoseSkip } from './todaySchedule';
import type { Medicine } from '@/hooks/useMedicines';
import { useTodayBarGroup } from '@/hooks/useTodayBars';

type SkippedItem = { skip: DoseSkip; at: Date; medicine: Medicine | undefined };

export function DoseTimeGroups({ given, upcoming, skipped = [], now, onGiven, onUpcoming, onUndoSkip }: {
  given?: GivenItem[]; upcoming?: UpcomingItem[]; now: Date;
  onGiven?: (item: GivenItem) => void; onUpcoming?: (item: UpcomingItem) => void;
  skipped?: SkippedItem[]; onUndoSkip?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const groups: { at: Date; items: (GivenItem | UpcomingItem | SkippedItem)[]; state?: SlotState }[] = upcoming ? groupUpcoming(upcoming) : groupDoseTimes<GivenItem | SkippedItem>([...(given ?? []), ...skipped].sort((a, b) => b.at.getTime() - a.at.getTime()));
  const shown = expanded ? groups : visibleDoseGroups(groups, now, !!upcoming);
  const bars = useTodayBarGroup(upcoming ? 'upcoming' : 'given', shown.map(group => String(group.at.getTime())));
  return <>
    {shown.map(group => {
      const key = group.at.getTime();
      const state = group.state ?? 'scheduled';
      const urgency = urgencyFor(state);
      const count = upcoming ? group.items.length : group.items.filter(item => 'log' in item).length;
      const skippedCount = group.items.filter(item => 'skip' in item).length;
      const countLabel = upcoming ? `${count} ${count === 1 ? 'medicine' : 'medicines'}` : `${count} given`;
      const isOpen = bars.isOpen(String(key));
      return <div key={key} data-dose-group className="border-b border-[#f3ede2] last:border-b-0">
        <button style={urgencyStyle(state)} className={`dose-time-header ${urgency ? 'dose-tinted' : ''} ${upcoming ? 'dose-upcoming-header' : 'dose-given-header'} min-h-11 w-full rounded-xl text-left ${urgency?.motion ?? ''}`} aria-expanded={isOpen} onClick={() => bars.toggle(String(key))}>
          <span className="dose-time whitespace-nowrap font-bold">{timeLabel(group.at)}</span>
          <span className="dose-relative text-sm">{headerDoseTime(group.at, now, upcoming ? state : undefined)}</span>
          <span className="dose-controls flex items-center justify-end gap-[6px]">
            <span className="dose-status flex justify-end">{upcoming ? <UrgencyBadge state={state} /> : skippedCount > 0 ? <span className="dose-skipped-count whitespace-nowrap text-sm text-[#8b8175]">{skippedCount} skipped</span> : null}</span>
            <span className="dose-count flex w-[28px] flex-none justify-center">{(upcoming || count > 0) && <span aria-label={countLabel} style={{ backgroundColor: urgency ? '#ffffff' : '#f3f0ec' }} className="flex min-h-6 w-full items-center justify-center rounded-full text-sm">{count}</span>}</span>
            <ChevronDown aria-hidden="true" className={`dose-chevron h-[16px] w-[16px] flex-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {isOpen && <div className="dose-group-rows relative pb-2 pl-[18px] before:absolute before:inset-y-0 before:left-[6px] before:w-[2px] before:bg-[#e9e2d6]">{group.items.map(item => {
          const medicine = item.medicine;
          if ('skip' in item) return <div key={item.skip.id} className="flex items-center gap-2 py-2 text-sm text-[#8b8175]">
            <span className="dose-skip min-w-0 flex-1">Skipped: {medicine?.name ?? 'Medicine'} ({timeLabel(item.at)}){item.skip.reason ? `, ${item.skip.reason.toLowerCase()}` : ''}, by {item.skip.recorded_by}</span>
            <button className="dose-undo min-h-11 min-w-11 text-right font-semibold" onClick={() => onUndoSkip?.(item.skip.id)}>Undo</button>
          </div>;
          return <button key={'log' in item ? item.log.id : item.medicine.id} className="flex min-h-11 w-full items-center gap-3 py-2 text-left" onClick={() => 'log' in item ? onGiven?.(item) : onUpcoming?.(item)}>
            <span className="min-w-0 flex-1 break-words">
            <span className="dose-name block font-semibold">{medicine?.name ?? 'Unknown'}</span>
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
