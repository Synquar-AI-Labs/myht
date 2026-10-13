import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { updateDecision, isBuildVersion, type BuildVersion } from '@/lib/appUpdate';
import { useUpdateSafety } from '@/hooks/useUpdateSafety';

// Native input baselines cover inline forms too, not just portaled dialogs.
// Explicit busy containers own their own saved baseline (the day editor).
export function AppUpdate() {
  const [pending, setPending] = useState(false);
  const canUpdate = useRef<() => boolean>(() => false);
  const settled = useRef<() => void>(() => {});
  const busy = useUpdateSafety(() => settled.current(), import.meta.env.PROD);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const current: BuildVersion = JSON.parse(import.meta.env.VITE_BUILD_VERSION);
    let incoming: unknown;
    let disposed = false;
    let checking = false;
    canUpdate.current = () => !busy(false);
    const decide = () => {
      if (disposed || !incoming) return;
      const decision = updateDecision(current, incoming, busy());
      if (decision === 'reload') window.location.reload();
      if (decision === 'wait') setPending(true);
      if (decision === 'ignore') setPending(false);
    };
    settled.current = decide;
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
    document.addEventListener('visibilitychange', check);
    const timer = setInterval(check, 10 * 60_000);
    void check();
    return () => {
      disposed = true; clearInterval(timer); settled.current = () => {};
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
