export const QUARTER_HOURS = Array.from({ length: 96 }, (_, i) => i * 15);

export function doseTimeLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function doseTimeFields(minutes: number) {
  const hour24 = Math.floor(minutes / 60);
  return { hour: hour24 % 12 || 12, am_pm: hour24 < 12 ? 'AM' : 'PM', minute: minutes % 60 };
}

export function doseTimeValue(log: { hour: number; am_pm: string; minute?: number }): number {
  return (log.hour % 12 + (log.am_pm === 'PM' ? 12 : 0)) * 60 + (log.minute ?? 0);
}

export function currentQuarter(now = new Date()): number {
  return now.getHours() * 60 + Math.floor(now.getMinutes() / 15) * 15;
}
