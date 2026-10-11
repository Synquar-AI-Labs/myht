import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const context = vi.hoisted(() => ({ role: 'member' }));
vi.mock('@/hooks/HouseholdProvider', () => ({ useHousehold: () => ({
  role: context.role, householdId: 'family', user: { id: 'self' }, refresh: vi.fn(),
  caregivers: [
    { caregiver_id: 'one', user_id: 'self', display_name: 'Current person', email: 'self@example.test', role: 'admin', is_active: true },
    { caregiver_id: 'two', user_id: 'other', display_name: 'Other person', email: 'other@example.test', role: 'member', is_active: true },
    { caregiver_id: 'three', user_id: null, display_name: 'Helper', email: null, role: null, is_active: true },
    { caregiver_id: 'four', user_id: null, display_name: 'Former helper', email: null, role: null, is_active: false },
  ],
}) }));
vi.mock('@/hooks/useFamilyInvites', () => ({ useFamilyInvites: () => ({ data: [], isLoading: false, error: null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { FamilyPeopleTab } from '@/components/more/FamilyPeopleTab';

beforeEach(() => { context.role = 'member'; });
function show() {
  render(<QueryClientProvider client={new QueryClient()}><FamilyPeopleTab /></QueryClientProvider>);
}
it('members can see people and inactive status, but no admin controls', () => {
  show();
  expect(screen.getByText('Only the family admin can add or remove people.')).toBeInTheDocument();
  expect(screen.getByText('Helper')).toBeInTheDocument();
  expect(screen.getByText('Inactive')).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('admins can invite, add, deactivate, reactivate and remove others, never themselves', () => {
  context.role = 'admin'; show();
  expect(screen.getByRole('button', { name: 'Invite' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add person' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Remove Other person' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Remove Current person' })).not.toBeInTheDocument();
});
