import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';

const backend = vi.hoisted(() => ({ member: true, fail: false, inviteFail: false, people: ['Current person'] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: backend.member ? { household_id: 'family', role: 'admin' } : null, error: backend.fail ? { message: 'offline' } : null }),
    single: async () => ({ data: { id: 'family', care_recipient_name: 'Care recipient' }, error: null }),
  }) }) }),
  rpc: async (name: string) => ({ data: name === 'household_people'
    ? backend.people.map((display_name, index) => ({ caregiver_id: String(index), display_name, is_active: true, user_id: index === 0 ? 'self' : null, role: index === 0 ? 'admin' : null, email: null })) : [], error: name === 'pending_invite' && backend.inviteFail ? { message: 'offline' } : null }),
} }));
import { HouseholdProvider, useHousehold } from '@/hooks/HouseholdProvider';

function Screen() {
  const { state, refresh, caregivers } = useHousehold();
  const queryClient = useQueryClient();
  return <>
    <p>{state.status}</p>
    {state.status === 'ready' && <input aria-label="Open form" defaultValue="" />}
    {caregivers.map(p => <p key={p.caregiver_id}>{p.display_name}</p>)}
    {state.status === 'no-household' && <><p>{state.notice}</p><p>Cached queries: {queryClient.getQueryCache().getAll().length}</p></>}
    <button onClick={() => void refresh()}>Refresh</button>
  </>;
}
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['household', 'family', 'health_records'], [{ weight: 62 }]);
  render(<QueryClientProvider client={client}><HouseholdProvider user={{ id: 'self' } as User}><Screen /></HouseholdProvider></QueryClientProvider>);
  return client;
}
beforeEach(() => { backend.member = true; backend.fail = false; backend.inviteFail = false; backend.people = ['Current person']; });
it('membership loss clears the cache before showing no-household', async () => {
  const client = show();
  await screen.findByText('ready');
  backend.member = false;
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByText('You are no longer part of that family.');
  expect(screen.getByText('Cached queries: 0')).toBeInTheDocument();
  expect(client.getQueryData(['household', 'family', 'health_records'])).toBeUndefined();
  expect(screen.queryByLabelText('Open form')).not.toBeInTheDocument();
});
it('quiet refresh updates people without unmounting an open form', async () => {
  show(); await screen.findByText('ready');
  const input = screen.getByLabelText('Open form');
  fireEvent.change(input, { target: { value: 'Unsaved text' } });
  backend.people.push('New helper');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByText('New helper');
  expect(screen.getByLabelText('Open form')).toBe(input);
  expect(input).toHaveValue('Unsaved text');
});
it('a failed invitation lookup cannot retain a removed member’s family data', async () => {
  const client = show(); await screen.findByText('ready');
  backend.member = false; backend.inviteFail = true;
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); });
  expect(screen.getByText('no-household')).toBeInTheDocument();
  expect(screen.getByText('You are no longer part of that family.')).toBeInTheDocument();
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});
it('a failed quiet refresh keeps the family and cached data', async () => {
  const client = show(); await screen.findByText('ready');
  backend.fail = true;
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Refresh' })); });
  expect(screen.getByText('ready')).toBeInTheDocument();
  expect(screen.queryByText('error')).not.toBeInTheDocument();
  expect(client.getQueryData(['household', 'family', 'health_records'])).toEqual([{ weight: 62 }]);
});
