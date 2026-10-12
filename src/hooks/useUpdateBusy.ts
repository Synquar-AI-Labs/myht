import { useEffect, useRef } from 'react';

const work = new Set<object>();
export const hasUpdateWork = () => work.size > 0;
export function holdUpdateWork() {
  const token = {};
  work.add(token);
  window.dispatchEvent(new Event('app-work-change'));
  return () => { work.delete(token); window.dispatchEvent(new Event('app-work-change')); };
}
/** Async work can outlive its screen (notably the final recording chunk). */
export async function withUpdateWork<T>(action: () => Promise<T>): Promise<T> {
  const release = holdUpdateWork();
  try { return await action(); } finally { release(); }
}
export function useUpdateBusy(busy: boolean) {
  const token = useRef({});
  useEffect(() => {
    if (busy) work.add(token.current); else work.delete(token.current);
    window.dispatchEvent(new Event('app-work-change'));
  }, [busy]);
  useEffect(() => () => { work.delete(token.current); window.dispatchEvent(new Event('app-work-change')); }, []);
}
