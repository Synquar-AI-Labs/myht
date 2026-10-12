import type { SlotState } from '@/components/today/todaySchedule';
import type { CSSProperties } from 'react';

export const URGENCY = {
  soon: { label: 'SOON', color: '#b45309', tint: '#fef3c7', badgeBackground: '#fef3c7', badgeText: '#b45309', pulse: '#b4530940', motion: 'medicine-pulse-slow' },
  due: { label: 'DUE NOW', color: '#c2410c', tint: '#fff0e7', badgeBackground: '#c2410c', badgeText: '#ffffff', pulse: '#c2410c40', motion: 'medicine-pulse-fast' },
  late: { label: 'LATE', color: '#7f1d1d', tint: '#fee2e2', badgeBackground: '#7f1d1d', badgeText: '#ffffff', pulse: '#7f1d1d40', motion: 'medicine-pulse-fast' },
  missed: { label: 'MISSED', color: '#7f1d1d', tint: '#f3f0ec', badgeBackground: '#7f1d1d', badgeText: '#ffffff', pulse: '#7f1d1d40', motion: '' },
} as const;

export const URGENCY_RANK: Record<SlotState, number> = { scheduled: 0, soon: 1, due: 2, late: 3, missed: 4 };
export const urgencyFor = (state?: SlotState) => state && state !== 'scheduled' ? URGENCY[state] : null;

export function urgencyStyle(state?: SlotState): CSSProperties | undefined {
  const urgency = urgencyFor(state);
  return urgency ? { backgroundColor: urgency.tint, color: urgency.color, '--medicine-pulse': urgency.pulse } as CSSProperties : undefined;
}
