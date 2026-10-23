import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';

type OpenBars = Record<string, boolean>;
export function todayBarLabel(keys: string[], open: OpenBars) {
  return keys.length > 0 && keys.every(key => open[key]) ? 'Collapse all' : 'Expand all';
}
const TodayBars = createContext<{
  open: OpenBars;
  visible: Record<string, string[]>;
  register: (scope: string, keys: string[]) => void;
  toggle: (key: string) => void;
  setAll: () => void;
} | null>(null);

export function TodayBarsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<OpenBars>({});
  const [visible, setVisible] = useState<Record<string, string[]>>({});
  const register = useCallback((scope: string, keys: string[]) => setVisible(previous => ({ ...previous, [scope]: keys })), []);
  const toggle = useCallback((key: string) => setOpen(previous => ({ ...previous, [key]: !previous[key] })), []);
  const keys = Object.values(visible).flat();
  const setAll = () => {
    const value = todayBarLabel(keys, open) === 'Expand all';
    setOpen(previous => ({ ...previous, ...Object.fromEntries(keys.map(key => [key, value])) }));
  };
  return <TodayBars.Provider value={{ open, visible, register, toggle, setAll }}>{children}</TodayBars.Provider>;
}

/** Register only displayed bars, never the hidden "Show more" groups or record cards.
 * Standalone cards retain their own state when rendered outside Today. */
export function useTodayBarGroup(scope: string, keys: string[]) {
  const shared = useContext(TodayBars);
  const [local, setLocal] = useState<OpenBars>({});
  const signature = keys.join('|');
  const ids = useMemo(() => signature ? signature.split('|').map(key => `${scope}:${key}`) : [], [scope, signature]);
  const register = shared?.register;
  useEffect(() => {
    register?.(scope, ids);
    return () => register?.(scope, []);
  }, [register, scope, ids]);
  return {
    isOpen: (key: string) => (shared?.open ?? local)[`${scope}:${key}`] ?? false,
    toggle: (key: string) => {
      const id = `${scope}:${key}`;
      if (shared) shared.toggle(id);
      else setLocal(previous => ({ ...previous, [id]: !previous[id] }));
    },
  };
}

export function TodayBarsButton() {
  const bars = useContext(TodayBars)!;
  const keys = Object.values(bars.visible).flat();
  const label = todayBarLabel(keys, bars.open);
  const Icon = label === 'Expand all' ? ChevronsUpDown : ChevronsDownUp;
  return <div className="flex justify-end"><button disabled={!keys.length} onClick={bars.setAll} className="flex min-h-11 min-w-11 items-center gap-2 text-sm font-semibold text-[#8a6240] disabled:opacity-50"><Icon className="h-[18px] w-[18px]" aria-hidden="true" />{label}</button></div>;
}
