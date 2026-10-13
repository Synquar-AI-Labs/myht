import { useEffect, useState } from 'react';
import { App, type AppInfo } from '@capacitor/app';
import { isNativeApp } from '@/native/platform';
import { format, parseISO } from 'date-fns';

export function BuildInfo() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => { if (isNativeApp()) { let active = true; void App.getInfo().then(value => { if (active) setInfo(value); }).catch(() => {}); return () => { active = false; }; } }, []);
  if (isNativeApp()) return info ? <p className="pt-4 text-center text-xs text-muted-foreground">Version {info.version} ({info.build})</p> : null;
  if (!import.meta.env.VITE_BUILD_VERSION) return null;
  const version = JSON.parse(import.meta.env.VITE_BUILD_VERSION);
  return <p className="pt-4 text-center text-xs text-muted-foreground">Version {version.commit.slice(0, 7)} · {format(parseISO(version.builtAt), 'MMM d, yyyy')}</p>;
}
