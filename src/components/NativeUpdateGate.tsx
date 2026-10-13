import { useEffect, useRef, useState, type ReactNode } from 'react';
import { App, type AppInfo } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useUpdateSafety } from '@/hooks/useUpdateSafety';
import { nativeUpdateDecision, phoneBuild } from '@/lib/nativeUpdate';

export function NativeUpdateGate({ children }: { children: ReactNode }) {
  const [starting, setStarting] = useState(true);
  const [decision, setDecision] = useState<'allow' | 'wait' | 'block'>('allow');
  const [info, setInfo] = useState<AppInfo | null>(null);
  const answer = useRef<{ build: number | null; minimum: unknown } | null>(null);
  const busy = useUpdateSafety(() => decide());
  const decide = () => {
    const current = answer.current;
    if (current) setDecision(nativeUpdateDecision(current.build, current.minimum, busy()));
  };
  useEffect(() => {
    let disposed = false;
    let checking = false;
    let controller: AbortController | undefined;
    let nextCheck: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const platform = Capacitor.getPlatform();
    const check = async (foreground = false) => {
      if (checking || (!foreground && document.visibilityState !== 'visible')) return;
      checking = true;
      clearTimeout(nextCheck);
      const request = new AbortController();
      controller = request;
      let succeeded = false;
      try {
        const response = await Promise.race([
          Promise.all([App.getInfo(), supabase.from('client_builds').select('min_build').eq('platform', platform).abortSignal(request.signal).maybeSingle()]),
          new Promise<null>(resolve => { deadline = setTimeout(() => { request.abort(); resolve(null); }, 20_000); }),
        ]);
        if (!disposed) {
          if (response && !response[1].error) {
            const [own, row] = response;
            setInfo(own);
            answer.current = { build: phoneBuild(own), minimum: row.data?.min_build };
            succeeded = true;
            decide();
          }
        }
      } catch { /* Keep the last successful answer, including an update requirement. */ }
      finally {
        clearTimeout(deadline); checking = false;
        if (!disposed) {
          setStarting(false);
          nextCheck = setTimeout(() => { void check(); }, succeeded ? 10 * 60_000 : 30_000);
        }
      }
    };
    const startup = setTimeout(() => { if (!disposed) setStarting(false); }, 3000);
    const visible = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', visible);
    const listener = App.addListener('appStateChange', state => { if (state.isActive) void check(true); });
    void check(true);
    return () => { disposed = true; controller?.abort(); clearTimeout(deadline); clearTimeout(startup); clearTimeout(nextCheck); document.removeEventListener('visibilitychange', visible); void listener.then(handle => handle.remove()); };
  }, []);
  if (starting) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (decision === 'block') return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-6 text-[#26201a]">
    <h1 className="text-2xl font-semibold">Update needed</h1>
    <p>This version is too old to keep your records right. {Capacitor.getPlatform() === 'ios' ? 'Open TestFlight and tap Update. Then open this app again.' : 'Open the Play Store and tap Update. Then open this app again.'}</p>
    <a className="flex min-h-11 items-center justify-center rounded-xl bg-[#26201a] p-3 text-white" href={Capacitor.getPlatform() === 'ios' ? 'itms-beta://' : `https://play.google.com/store/apps/details?id=${encodeURIComponent(info?.id ?? '')}`}>{Capacitor.getPlatform() === 'ios' ? 'Open TestFlight' : 'Open Play Store'}</a>
    {info && <p className="text-sm">Version {info.version} ({info.build})</p>}
  </main>;
  return <>{decision === 'wait' && <div role="status" style={{ top: 'env(safe-area-inset-top, 0px)' }} className="sticky z-[100] bg-[#26201a] px-4 py-3 text-white">This app needs an update. Finish this first.</div>}{children}</>;
}
