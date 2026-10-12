import { urgencyFor } from '@/lib/medicineUrgency';
import type { SlotState } from './todaySchedule';

export function UrgencyBadge({ state }: { state?: SlotState }) {
  const urgency = urgencyFor(state);
  if (!urgency) return null;
  return <span className="flex-none rounded-lg border border-current px-2 py-1 text-xs font-extrabold" style={{ backgroundColor: urgency.badgeBackground, color: urgency.badgeText }}>{urgency.label}</span>;
}
