/** Monotonic ticker reconciliation; a gap cannot identify the missing table. */
export function reconcileSequence(previous: number | null, next: number, source: 'read' | 'event') {
  if (!Number.isSafeInteger(next) || next < 0 || (previous !== null && next <= previous)) return { seq: previous, action: 'none' as const };
  const action = previous === null && source === 'read' ? 'none' : source === 'event' && previous !== null && next === previous + 1 ? 'table' : 'all';
  return { seq: next, action };
}
