import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { updateDecision, isBuildVersion, type BuildVersion } from '@/lib/appUpdate';
import { hasUpdateWork } from '@/hooks/useUpdateBusy';

// Native input baselines cover inline forms too, not just portaled dialogs.
// Explicit busy containers own their own saved baseline (the day editor).
export function AppUpdate() {
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const canUpdate = useRef<() => boolean>(() => false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const current: BuildVersion = JSON.parse(import.meta.env.VITE_BUILD_VERSION);
    let incoming: unknown;
    let disposed = false;
    let checking = false;
    const edited = new Map<HTMLInputElement | HTMLTextAreaElement, string>();
    const value = (node: HTMLInputElement | HTMLTextAreaElement) => node instanceof HTMLInputElement && ['checkbox', 'radio'].includes(node.type) ? String(node.checked) : node.value;
    const remember = (event: Event) => {
      const node = event.target;
      if ((node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) && !node.closest('[data-update-busy]') && !edited.has(node)) edited.set(node, value(node));
    };
    const busy = (feedback = true) => hasUpdateWork() || cache.isMutating() > 0 || (feedback && !!document.querySelector('[data-sonner-toast]')) || !!document.querySelector('[role="dialog"], [role="alertdialog"], [data-update-busy="true"]')
      || [...edited].some(([node, baseline]) => node.isConnected && value(node) !== baseline);
    canUpdate.current = () => !busy(false);
    const decide = () => {
      if (disposed || !incoming) return;
      const decision = updateDecision(current, incoming, busy());
      if (decision === 'reload') window.location.reload();
      if (decision === 'wait') setPending(true);
      if (decision === 'ignore') setPending(false);
    };
    let settleTimer: ReturnType<typeof setTimeout>;
    const settledDecision = () => { clearTimeout(settleTimer); settleTimer = setTimeout(decide, 0); };
    const unsubscribe = cache.getMutationCache().subscribe(settledDecision);
    const check = async () => {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (response.ok && !disposed) {
          const version: unknown = await response.json();
          if (isBuildVersion(version)) { incoming = version; decide(); }
        }
      } catch { /* Offline: keep the current app. */ }
      finally { checking = false; }
    };
    document.addEventListener('focusin', remember, true);
    document.addEventListener('beforeinput', remember, true);
    document.addEventListener('input', settledDecision, true);
    window.addEventListener('app-work-change', settledDecision);
    document.addEventListener('visibilitychange', check);
    const observer = new MutationObserver(settledDecision);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-update-busy'] });
    const timer = setInterval(check, 10 * 60_000);
    void check();
    return () => {
      disposed = true; clearInterval(timer); clearTimeout(settleTimer); unsubscribe(); observer.disconnect();
      document.removeEventListener('focusin', remember, true);
      document.removeEventListener('beforeinput', remember, true);
      document.removeEventListener('input', settledDecision, true);
      window.removeEventListener('app-work-change', settledDecision);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return pending ? <div role="status" className="sticky top-0 z-[100] flex items-center justify-between gap-3 bg-[#26201a] px-4 py-2 text-white">
    <span>A new version is ready</span><button className="min-h-11 min-w-11 rounded-lg border px-3 font-semibold" onClick={() => {
      if (canUpdate.current()) window.location.reload();
      else toast.info("Finish this first. The app will update when you're done.");
    }}>Update now</button>
  </div> : null;
}
