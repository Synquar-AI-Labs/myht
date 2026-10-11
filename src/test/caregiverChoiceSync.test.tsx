import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/hooks/HouseholdProvider', () => ({ useHousehold: () => ({
  householdId: 'family', myCaregiver: { caregiver_id: 'self' }, caregivers: [
    { caregiver_id: 'self', display_name: 'My caregiver', is_active: true },
    { caregiver_id: 'helper', display_name: 'Other caregiver', is_active: true },
  ],
}) }));
import { useCaregiverChoice } from '@/hooks/useCaregiverChoice';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
function Choice({ id }: { id: string }) {
  const { caregiver, selectCaregiver } = useCaregiverChoice();
  return <div><span data-testid={id}>{caregiver?.display_name}</span><button onClick={() => selectCaregiver('helper')}>Choose helper {id}</button></div>;
}
it('keeps simultaneously mounted add flows on the same remembered device choice', () => {
  render(<><Choice id="reading" /><Choice id="note" /></>);
  expect(screen.getByTestId('note')).toHaveTextContent('My caregiver');
  fireEvent.click(screen.getByRole('button', { name: 'Choose helper reading' }));
  expect(screen.getByTestId('reading')).toHaveTextContent('Other caregiver');
  expect(screen.getByTestId('note')).toHaveTextContent('Other caregiver');
  expect(localStorage.getItem('ht_caregiver:family')).toBe('helper');
});
