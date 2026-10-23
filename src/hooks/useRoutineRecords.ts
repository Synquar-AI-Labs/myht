import { useQuery, useQueryClient } from '@tanstack/react-query';
import { parseISO, addDays } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useHousehold } from './HouseholdProvider';
import { withUpdateWork } from './useUpdateBusy';
import { domainKeys } from '@/lib/domainKeys';
import { fetchAllRows } from '@/lib/fetchAll';
import type { RoutineItem, RoutineLog } from '@/lib/routineSchedule';
import type { TablesInsert } from '@/integrations/supabase/types';

export function useRoutineLogs(date: string, kind?: 'meal' | 'exercise', planned = false) {
  const { householdId } = useHousehold();
  return useQuery({ queryKey: [...domainKeys.routineLogs(householdId), planned ? 'planned' : 'done', date, kind], enabled: !!householdId,
    queryFn: () => fetchAllRows<RoutineLog>((from, to) => {
      let q = supabase.from('routine_logs').select('*', { count: 'exact' }).eq('household_id', householdId!);
      if (kind) q = q.eq('kind', kind);
      q = planned ? q.eq('for_date', date) : q.gte('done_at', parseISO(date).toISOString()).lt('done_at', addDays(parseISO(date), 1).toISOString());
      return q.order('done_at').order('id').range(from, to);
    }) });
}
export function useRoutineSection(kind: 'meal' | 'exercise', date: string) {
  const { householdId } = useHousehold();
  const items = useQuery({ queryKey: [...domainKeys.routines(householdId), kind], enabled: !!householdId,
    queryFn: () => fetchAllRows<RoutineItem>((from, to) => supabase.from('routine_items').select('*', { count: 'exact' }).eq('household_id', householdId!).eq('kind', kind).order('created_at').order('id').range(from, to)) });
  const logs = useRoutineLogs(date, kind, true);
  return { items: items.data ?? [], logs: logs.data ?? [], loading: items.isLoading || logs.isLoading, error: items.isError || logs.isError, retry: () => { void items.refetch(); void logs.refetch(); } };
}
export type RoutineSave = { state: 'saved' | 'existing'; log: RoutineLog } | { state: 'failed' };
export function useRoutineWrites() {
  const { householdId, user, caregivers } = useHousehold();
  const cache = useQueryClient();
  const invalidate = () => cache.invalidateQueries({ queryKey: domainKeys.routineLogs(householdId) });
  return {
    save: (input: Omit<TablesInsert<'routine_logs'>, 'household_id'>, existing?: RoutineLog): Promise<RoutineSave> => withUpdateWork(async () => {
      try {
        const session = await supabase.auth.getSession();
        if (!householdId || session.data.session?.user.id !== user.id) throw new Error('identity_changed');
        let result;
        if (existing) {
          const attribution = input.caregiver_id !== existing.caregiver_id ? caregivers.find(p => p.caregiver_id === input.caregiver_id && p.is_active) : undefined;
          if (input.caregiver_id !== existing.caregiver_id && !attribution) throw new Error('invalid_caregiver');
          result = await supabase.from('routine_logs').update({ amount: input.amount, minutes: input.minutes, note: input.note, done_at: input.done_at, ...(attribution ? { caregiver_id: attribution.caregiver_id, recorded_by: attribution.display_name } : {}) }).eq('household_id', householdId).eq('id', existing.id).select('*').single();
        } else result = await supabase.from('routine_logs').insert({ ...input, household_id: householdId }).select('*').single();
        if (result.error?.code === '23505' && !existing) {
          const found = await supabase.from('routine_logs').select('*').eq('household_id', householdId).eq('item_id', input.item_id).eq('for_date', input.for_date).eq('for_minute', input.for_minute).single();
          if (found.error) throw found.error;
          await invalidate(); return { state: 'existing', log: found.data };
        }
        if (result.error) throw result.error;
        await invalidate(); return { state: 'saved', log: result.data };
      } catch { toast.error('Could not save. Your entry is still here. Try again.'); return { state: 'failed' }; }
    }),
    undo: (id: string) => withUpdateWork(async () => {
      const result = await supabase.from('routine_logs').delete().eq('household_id', householdId!).eq('id', id).select('id').single();
      if (result.error) { toast.error('Could not undo. Try again.'); return false; }
      await invalidate(); return true;
    }),
  };
}
