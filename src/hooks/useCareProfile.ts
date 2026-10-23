import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useHousehold } from './HouseholdProvider';
import { withUpdateWork } from './useUpdateBusy';
import { domainKeys } from '@/lib/domainKeys';
import { fetchAllRows } from '@/lib/fetchAll';
import type { TablesInsert } from '@/integrations/supabase/types';
import type { CareAlert, Contact, AlertKind } from '@/lib/careProfile';

export function useCareProfile() {
  const { householdId } = useHousehold();
  const cache = useQueryClient();
  const profileQuery = useQuery({ queryKey: domainKeys.profile(householdId), enabled: !!householdId, queryFn: async () => {
    const { data, error } = await supabase.from('care_profiles').select('*').eq('household_id', householdId!).maybeSingle();
    if (error) throw error;
    return data;
  } });
  const alertsQuery = useQuery({ queryKey: domainKeys.alerts(householdId), enabled: !!householdId, queryFn: () => fetchAllRows<CareAlert>((from, to) => supabase.from('care_alerts').select('*', { count: 'exact' }).eq('household_id', householdId!).order('sort').order('created_at').order('id').range(from, to)) });
  const invalidate = () => Promise.all([cache.invalidateQueries({ queryKey: domainKeys.profile(householdId) }), cache.invalidateQueries({ queryKey: domainKeys.alerts(householdId) })]);
  const write = async (action: () => PromiseLike<{ error: unknown }>) => {
    if (!householdId) return false;
    return withUpdateWork(async () => {
      try { const { error } = await action(); if (error) throw error; await invalidate(); return true; }
      catch { toast.error('Could not save. Check the connection and try again.'); return false; }
    });
  };
  return {
    profile: profileQuery.data ?? null, alerts: alertsQuery.data ?? [],
    loading: profileQuery.isLoading || alertsQuery.isLoading,
    error: profileQuery.isError || alertsQuery.isError,
    profileQuery, alertsQuery,
    retry: () => { void profileQuery.refetch(); void alertsQuery.refetch(); },
    saveProfile: (values: Omit<Partial<TablesInsert<'care_profiles'>>, 'id' | 'household_id'>) => write(() => supabase.from('care_profiles').upsert({ ...values, household_id: householdId! }, { onConflict: 'household_id' })),
    addAlert: (kind: AlertKind, text: string, note: string) => write(() => supabase.from('care_alerts').insert({ household_id: householdId!, kind, text: text.trim(), note: note.trim() })),
    removeAlert: (id: string) => write(() => supabase.from('care_alerts').delete().eq('household_id', householdId!).eq('id', id)),
  };
}

export function useContacts() {
  const { householdId } = useHousehold();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: domainKeys.contacts(householdId), enabled: !!householdId, queryFn: () => fetchAllRows<Contact>((from, to) => supabase.from('contacts').select('*', { count: 'exact' }).eq('household_id', householdId!).order('sort').order('created_at').order('id').range(from, to)) });
  const write = async (action: () => PromiseLike<{ error: unknown }>) => {
    if (!householdId) return false;
    return withUpdateWork(async () => {
      try { const { error } = await action(); if (error) throw error; await cache.invalidateQueries({ queryKey: domainKeys.contacts(householdId) }); return true; }
      catch { toast.error('Could not save contact. Check the connection and try again.'); return false; }
    });
  };
  return { contacts: query.data ?? [], loading: query.isLoading, error: query.isError, retry: () => void query.refetch(),
    save: (values: Omit<TablesInsert<'contacts'>, 'household_id'>, id?: string) => write(() => id ? supabase.from('contacts').update(values).eq('household_id', householdId!).eq('id', id) : supabase.from('contacts').insert({ ...values, household_id: householdId! })),
    remove: (id: string) => write(() => supabase.from('contacts').delete().eq('household_id', householdId!).eq('id', id)),
  };
}
