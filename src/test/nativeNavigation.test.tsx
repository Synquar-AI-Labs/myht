import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Auth from '@/pages/Auth';
import { PrescriptionPhotoScreen } from '@/components/PrescriptionPhotoScreen';
import { handleNativeBack } from '@/native/back';

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), invoke: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));
vi.mock('@capacitor/app', () => ({ App: { minimizeApp: vi.fn() } }));
vi.mock('@/hooks/HouseholdProvider', () => ({ useHousehold: () => ({ householdId: 'synthetic-household' }) }));
vi.mock('@/lib/preparePhoto', () => ({ preparePhoto: async () => new Blob(['photo'], { type: 'image/jpeg' }), PHOTO_OPEN_ERROR: 'Could not open photo' }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signUp: mocks.signUp },
  functions: { invoke: mocks.invoke },
} }));
beforeEach(() => { vi.stubEnv('VITE_NATIVE_APP', 'true'); vi.clearAllMocks(); vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }); vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:synthetic', revokeObjectURL: vi.fn() })); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('native sign-up back returns to the previous step with typed values; busy prevents back', async () => {
  let release!: (value: { error: null }) => void;
  mocks.signUp.mockReturnValue(new Promise(resolve => { release = resolve; }));
  const view = render(<MemoryRouter><Auth /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }));
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Synthetic person' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'synthetic@example.local' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Synthetic-password-42!' } });
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  await act(() => handleNativeBack());
  expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  await act(async () => { release({ error: null }); });
  expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  await act(() => handleNativeBack());
  expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  expect(screen.getByLabelText('Your name')).toHaveValue('Synthetic person');
  expect(screen.getByLabelText('Email')).toHaveValue('synthetic@example.local'); view.unmount();
});

it('photo back returns to the cabinet but cannot cancel an active read', async () => {
  let release!: (value: { data: null; error: object }) => void;
  mocks.invoke.mockReturnValue(new Promise(resolve => { release = resolve; }));
  const onBack = vi.fn();
  const view = render(<PrescriptionPhotoScreen medicines={[]} loaded loadError={false} onRetry={() => {}} onBack={onBack} onAdd={() => {}} onEdit={() => {}} />);
  await act(() => handleNativeBack()); expect(onBack).toHaveBeenCalledOnce(); onBack.mockClear();
  fireEvent.change(screen.getByLabelText('Choose prescription photos'), { target: { files: [new File(['image'], 'synthetic.jpg', { type: 'image/jpeg' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Read 1 photo' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Read 1 photo' }));
  await act(() => handleNativeBack()); expect(onBack).not.toHaveBeenCalled();
  await act(async () => { release({ data: null, error: { message: 'Synthetic failure' } }); });
  await act(() => handleNativeBack()); expect(onBack).toHaveBeenCalledOnce(); view.unmount();
});
