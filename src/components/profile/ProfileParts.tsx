import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export const profilePanel = 'rounded-2xl border border-[#e9e2d6] bg-white p-4';
export const profileDialog = 'max-h-[85dvh] max-w-lg overflow-y-auto rounded-2xl [&>button.absolute]:right-2 [&>button.absolute]:top-2 [&>button.absolute]:flex [&>button.absolute]:min-h-11 [&>button.absolute]:min-w-11 [&>button.absolute]:items-center [&>button.absolute]:justify-center';
export function ProfileSection({ title, children, danger = false }: { title: string; children: ReactNode; danger?: boolean }) {
  return <section className={`space-y-3 ${danger ? 'rounded-2xl border border-[#f2cfcb] bg-[#fdf0ef] p-4' : profilePanel}`}>
    <h2 className={`[font-family:inherit] text-xs font-bold uppercase tracking-wider ${danger ? 'text-[#7f1d1d]' : 'text-[#8b8175]'}`}>{title}</h2>{children}
  </section>;
}
export function ProfileLoad({ error, retry }: { error: boolean; retry: () => void }) {
  return <div className={`${profilePanel} space-y-3`} role={error ? 'alert' : 'status'}>
    <p>{error ? "Couldn't load this information. Check the connection." : 'Loading…'}</p>
    {error && <Button variant="outline" onClick={retry}>Try again</Button>}
  </div>;
}
