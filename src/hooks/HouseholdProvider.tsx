import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { accountError } from '@/lib/accountSetup';
import { useQueryClient } from '@tanstack/react-query';

export type HouseholdPerson = {
  caregiver_id: string; display_name: string; is_active: boolean;
  user_id: string | null; role: string | null; email: string | null;
};
export type PendingInvite = { invite_id: string; care_recipient_name: string; inviter_display_name: string };
type HouseholdState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'no-household'; invite: PendingInvite | null; notice?: string }
  | { status: 'ready'; household: Tables<'households'>; role: string; people: HouseholdPerson[] };
const Context = createContext<{ state: HouseholdState; user: User; reload: () => Promise<void>; refresh: () => Promise<void> } | null>(null);

export function HouseholdProvider({ user, children }: { user: User; children: React.ReactNode }) {
  const [state, setState] = useState<HouseholdState>({ status: 'loading' });
  const generation = useRef(0);
  const current = useRef(state);
  current.current = state;
  const queryClient = useQueryClient();
  const load = useCallback(async (quiet: boolean) => {
    const request = ++generation.current;
    const previous = current.current;
    if (!quiet) setState({ status: 'loading' });
    try {
      const { data: membership, error } = await supabase.from('household_members').select('*').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      let next: HouseholdState;
      if (membership) {
        const { data: household, error: householdError } = await supabase.from('households').select('*').eq('id', membership.household_id).single();
        if (householdError) throw householdError;
        const { data: people, error: peopleError } = await supabase.rpc('household_people');
        if (peopleError) throw peopleError;
        next = { status: 'ready', household, role: membership.role, people: people ?? [] };
      } else {
        const notice = previous.status === 'ready' ? 'You are no longer part of that family.'
          : previous.status === 'no-household' ? previous.notice : undefined;
        if (previous.status === 'ready' && request === generation.current) {
          await queryClient.cancelQueries();
          queryClient.clear();
          if (request !== generation.current) return;
          setState({ status: 'no-household', invite: null, notice });
        }
        const { data, error: inviteError } = await supabase.rpc('pending_invite');
        if (inviteError && previous.status !== 'ready') throw inviteError;
        next = { status: 'no-household', invite: data?.[0] ?? null, notice };
      }
      if (request === generation.current) setState(next);
    } catch (error) {
      if (request === generation.current && !quiet) setState({ status: 'error', message: accountError(error) });
    }
  }, [user.id, queryClient]);
  const reload = useCallback(() => load(false), [load]);
  const refresh = useCallback(() => load(true), [load]);
  useEffect(() => { void reload(); return () => { generation.current++; }; }, [reload]);
  return <Context.Provider value={{ state, user, reload, refresh }}>{children}</Context.Provider>;
}
export function useHousehold() {
  const value = useContext(Context);
  if (!value) throw new Error('HouseholdProvider is missing');
  const ready = value.state.status === 'ready' ? value.state : null;
  return {
    ...value, householdId: ready?.household.id, role: ready?.role,
    careRecipientName: ready?.household.care_recipient_name,
    caregivers: ready?.people ?? [],
    myCaregiver: ready?.people.find(p => p.user_id === value.user.id),
  };
}
