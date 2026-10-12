import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useHousehold } from './HouseholdProvider';
import { fetchAllRows } from '@/lib/fetchAll';
import type { DoseSkip } from '@/components/today/todaySchedule';
import { toast } from 'sonner';

export const skipKeys = (householdId?: string) => ['household', householdId, 'dose_skips'] as const;
export function useDoseSkips(date: string) {
  const { householdId, caregivers } = useHousehold();
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: [...skipKeys(householdId), date], enabled: !!householdId,
    queryFn: () => fetchAllRows<DoseSkip>((from, to) => supabase.from('dose_skips')
      .select('*', { count: 'exact' }).eq('household_id', householdId!).eq('for_date', date)
      .order('for_minute').order('id').range(from, to)),
  });
  const addSkip = async (skip: { medicine_id: string; for_date: string; for_minute: number; caregiver_id: string; reason: string }) => {
    const person = caregivers.find(p => p.is_active && p.caregiver_id === skip.caregiver_id);
    if (!householdId || !person) { toast.error("Choose who's logging"); return false; }
    const { error } = await supabase.from('dose_skips').upsert({ ...skip, household_id: householdId, recorded_by: person.display_name }, { onConflict: 'household_id,medicine_id,for_date,for_minute', ignoreDuplicates: true });
    if (error) { toast.error('Could not skip this dose'); return false; }
    void cache.invalidateQueries({ queryKey: skipKeys(householdId) });
    toast.success('Dose skipped'); return true;
  };
  const undoSkip = async (id: string) => {
    const { error } = await supabase.from('dose_skips').delete().eq('household_id', householdId!).eq('id', id);
    if (error) { toast.error('Could not undo'); return false; }
    void cache.invalidateQueries({ queryKey: skipKeys(householdId) }); return true;
  };
  return { skips: query.data ?? [], loading: query.isLoading, loadError: query.isError, addSkip, undoSkip };
}
