import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useCareProfile } from '@/hooks/useCareProfile';
import { alertLine } from '@/lib/careProfile';

export function TodayAlerts({ onOpen }: { onOpen: () => void }) {
  const care = useCareProfile();
  if (care.error) return <div className="flex min-h-11 flex-wrap items-center gap-x-2 text-sm text-[#8b8175]" role="alert">Alerts could not load · <button className="min-h-11 min-w-11 underline" onClick={care.retry}>Try again</button></div>;
  if (care.loading) return <p className="py-2 text-sm text-[#8b8175]" role="status">Loading alerts…</p>;
  const summary = alertLine(care.profile, care.alerts);
  if (!summary.lines.length) return null;
  return <button data-today-alerts className="flex min-h-11 w-full items-start gap-2 rounded-2xl border border-[#f2cfcb] bg-[#fdf0ef] px-3 py-3 text-left text-[#7f1d1d]" onClick={onOpen} aria-label={`${summary.full}. Open About`}>
    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 flex-none" />
    <span className="min-w-0 flex-1 text-sm font-semibold leading-5" data-alert-lines>{summary.lines.map((line, i) => <span className="block truncate" aria-label={line} key={i}>{line}</span>)}</span>
    <ChevronRight aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none" />
  </button>;
}
