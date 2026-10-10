import { eachMonthOfInterval, format, subMonths } from 'date-fns';

export function getMonthOptions(now = new Date()) {
  return eachMonthOfInterval({ start: subMonths(now, 12), end: now })
    .reverse()
    .map(d => ({ value: format(d, 'yyyy-MM'), label: format(d, 'MMM yyyy') }));
}

export function countRecordedDays(rows: { hasRecord: boolean }[]) {
  return rows.filter(row => row.hasRecord).length;
}

export function formatAppointmentTime(time: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!match) return time;
  const hour = Number(match[1]);
  if (hour > 23 || Number(match[2]) > 59) return time;
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'AM' : 'PM'}`;
}
