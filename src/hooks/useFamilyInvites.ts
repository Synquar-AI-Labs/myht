import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { domainKeys } from '@/lib/domainKeys';
import { fetchAllRows } from '@/lib/fetchAll';

export function useFamilyInvites() {
  const { householdId, role } = useHousehold();
  return useQuery({
    queryKey: domainKeys.invites(householdId),
    enabled: !!householdId && role === 'admin',
    queryFn: () => fetchAllRows((from, to) => supabase.from('household_invites')
      .select('*', { count: 'exact' }).eq('household_id', householdId!)
      .is('accepted_at', null).is('revoked_at', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).order('id').range(from, to)),
  });
}
