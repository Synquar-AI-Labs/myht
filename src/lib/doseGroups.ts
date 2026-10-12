import type { GivenItem, UpcomingItem, SlotState } from '@/components/today/todaySchedule';

export function relativeDoseTime(at: Date, now: Date): string {
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (!minutes) return 'now';
  const amount = Math.abs(minutes);
  const hours = Math.floor(amount / 60);
  const remainder = amount % 60;
  const units = [
    hours ? `${hours} ${hours === 1 ? 'hour' : 'hours'}` : '',
    remainder ? `${remainder} ${remainder === 1 ? 'minute' : 'minutes'}` : '',
  ].filter(Boolean).join(' ');
  return minutes > 0 ? `in ${units}` : `${units} late`;
}

export function groupDoseTimes<T extends { at: Date }>(items: T[]) {
  const groups = new Map<number, { at: Date; items: T[] }>();
  items.forEach(item => {
    const key = item.at.getTime();
    if (!groups.has(key)) groups.set(key, { at: item.at, items: [] });
    groups.get(key)!.items.push(item);
  });
  return [...groups.values()];
}

export function groupUpcoming(items: UpcomingItem[]) {
  const rank: Record<SlotState, number> = { scheduled: 0, overdue: 1, due: 2 };
  return groupDoseTimes(items).map(group => ({ ...group,
    state: group.items.reduce<SlotState>((state, item) => rank[item.state] > rank[state] ? item.state : state, 'scheduled'),
  }));
}

export const groupGiven = (items: GivenItem[]) => groupDoseTimes(items);

export function elapsedDoseTime(at: Date, now: Date): string {
  return relativeDoseTime(at, now).replace(/ late$/, ' ago');
}

/** Keep the nearest upcoming time visible even when many overdue times precede it. */
export function visibleDoseGroups<T extends { at: Date }>(groups: T[], now: Date, upcoming: boolean) {
  if (!upcoming) return groups.slice(0, 6);
  const nearest = new Set([...groups]
    .sort((a, b) => Math.abs(a.at.getTime() - now.getTime()) - Math.abs(b.at.getTime() - now.getTime()))
    .slice(0, 6));
  return groups.filter(group => nearest.has(group));
}
