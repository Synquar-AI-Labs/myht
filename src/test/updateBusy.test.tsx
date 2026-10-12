import { StrictMode } from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useUpdateBusy, hasUpdateWork, withUpdateWork } from '@/hooks/useUpdateBusy';
function Work({ busy }: { busy: boolean }) { useUpdateBusy(busy); return null; }
describe('unfinished work boundary', () => {
  it('remains busy until every independent job ends', () => {
    const view = render(<><Work busy /><Work busy /></>);
    expect(hasUpdateWork()).toBe(true);
    view.rerender(<><Work busy={false} /><Work busy /></>);
    expect(hasUpdateWork()).toBe(true);
    view.rerender(<><Work busy={false} /><Work busy={false} /></>);
    expect(hasUpdateWork()).toBe(false);
  });
  it('clears work on unmount, including strict-mode setup/cleanup', () => {
    const view = render(<StrictMode><Work busy /></StrictMode>);
    expect(hasUpdateWork()).toBe(true);
    view.unmount();
    expect(hasUpdateWork()).toBe(false);
  });
  it('keeps pending persistence busy after its screen unmounts', async () => {
    let done!: () => void;
    const saved = new Promise<void>(resolve => { done = resolve; });
    const view = render(<Work busy />);
    const pending = withUpdateWork(() => saved);
    view.unmount();
    expect(hasUpdateWork()).toBe(true);
    done(); await pending;
    expect(hasUpdateWork()).toBe(false);
  });
  it('releases a failed async operation rather than leaving a stuck guard', async () => {
    await expect(withUpdateWork(async () => { throw new Error('Synthetic failure'); })).rejects.toThrow('Synthetic failure');
    expect(hasUpdateWork()).toBe(false);
  });
});
