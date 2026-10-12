import type { UpcomingItem } from '@/components/today/todaySchedule';

export function doseCandidates(upcoming: UpcomingItem[], medicineId: string, now: Date) {
  return upcoming.filter(item => item.medicine.id === medicineId
    && item.at.getTime() >= now.getTime() - 12 * 60 * 60_000
    && item.at.getTime() <= now.getTime() + 2 * 60 * 60_000);
}
export function automaticDose(candidates: UpcomingItem[]) {
  return candidates.length === 1 && (candidates[0].state === 'soon' || candidates[0].state === 'due') ? candidates[0] : undefined;
}
