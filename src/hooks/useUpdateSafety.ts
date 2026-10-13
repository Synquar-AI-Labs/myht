import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { hasUpdateWork } from '@/hooks/useUpdateBusy';

/** Shared by browser reloads and native upgrade prompts; never discard work. */
export function useUpdateSafety(onSettled: () => void, enabled = true) {
  const cache = useQueryClient();
  const callback = useRef(onSettled);
  callback.current = onSettled;
  const edited = useRef(new Map<HTMLInputElement | HTMLTextAreaElement, string>());
  const value = (node: HTMLInputElement | HTMLTextAreaElement) => node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type) ? String(node.checked) : node.value;
  const busy = useCallback((feedback = true) => hasUpdateWork() || cache.isMutating() > 0 || (feedback && !!document.querySelector('[data-sonner-toast]')) || !!document.querySelector('[role="dialog"], [role="alertdialog"], [data-update-busy="true"]')
    || [...edited.current].some(([node, baseline]) => node.isConnected && value(node) !== baseline), [cache]);
  useEffect(() => {
    if (!enabled) return;
    const remember = (event: Event) => {
      const node = event.target;
      if ((node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) && !node.closest('[data-update-busy]') && !edited.current.has(node)) edited.current.set(node, value(node));
    };
    let settleTimer: ReturnType<typeof setTimeout>;
    const settled = () => { clearTimeout(settleTimer); settleTimer = setTimeout(() => callback.current(), 0); };
    const unsubscribe = cache.getMutationCache().subscribe(settled);
    document.addEventListener('focusin', remember, true);
    document.addEventListener('beforeinput', remember, true);
    document.addEventListener('input', settled, true);
    window.addEventListener('app-work-change', settled);
    const observer = new MutationObserver(settled);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-update-busy'] });
    return () => {
      clearTimeout(settleTimer); unsubscribe(); observer.disconnect(); edited.current.clear();
      document.removeEventListener('focusin', remember, true);
      document.removeEventListener('beforeinput', remember, true);
      document.removeEventListener('input', settled, true);
      window.removeEventListener('app-work-change', settled);
    };
  }, [cache, enabled]);
  return busy;
}
