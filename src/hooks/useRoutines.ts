import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useHousehold } from './HouseholdProvider';
import { withUpdateWork } from './useUpdateBusy';
import { domainKeys } from '@/lib/domainKeys';
import { fetchAllRows } from '@/lib/fetchAll';
import { routineTimeChange, TYPICAL_MEALS, type RoutineItem, type RoutineLog } from '@/lib/routineSchedule';
import { canonicalSchedule } from '@/lib/medicineForm';

export type RoutineDraft = Pick<RoutineItem, 'kind' | 'name' | 'details' | 'drink' | 'target_minutes' | 'area' | 'move_type' | 'start_date'> & { times: number[] };
export function useRoutines() {
  const { householdId } = useHousehold();
  const cache = useQueryClient();
  const query = useQuery({ queryKey: domainKeys.routines(householdId), enabled: !!householdId, queryFn: () => fetchAllRows<RoutineItem>((from, to) => supabase.from('routine_items').select('*', { count: 'exact' }).eq('household_id', householdId!).order('created_at').order('id').range(from, to)) });
  const logsQuery = useQuery({ queryKey: domainKeys.routineLogs(householdId), enabled: !!householdId, queryFn: () => fetchAllRows<RoutineLog>((from, to) => supabase.from('routine_logs').select('*', { count: 'exact' }).eq('household_id', householdId!).order('done_at').order('id').range(from, to)) });
  const write = async <T,>(action: () => PromiseLike<{ data: T; error: { code?: string } | null }>): Promise<{ ok: true; data: T } | { ok: false }> => {
    if (!householdId) return { ok: false };
    return withUpdateWork(async () => {
      try {
        const result = await action();
        if (result.error) throw result.error;
        await cache.invalidateQueries({ queryKey: domainKeys.routines(householdId) });
        return { ok: true as const, data: result.data };
      } catch (error) {
        toast.error((error as { code?: string }).code === '23503' ? 'This item has records. Stop it from a date instead.' : 'Could not save the plan. Check the connection and try again.');
        return { ok: false as const };
      }
    });
  };
  return { items: query.data ?? [], logs: logsQuery.data ?? [], loading: query.isLoading || logsQuery.isLoading, error: query.isError || logsQuery.isError,
    retry: () => { void query.refetch(); void logsQuery.refetch(); },
    save: async (draft: RoutineDraft, id?: string) => {
      const { times, ...values } = draft;
      return write(async () => {
        if (!id) return supabase.from('routine_items').insert({ ...values, household_id: householdId!, schedule_time: canonicalSchedule(times) }).select('id');
        const { data: current, error } = await supabase.from('routine_items').select('*').eq('household_id', householdId!).eq('id', id).single();
        if (error) return { data: null, error };
        return supabase.from('routine_items').update({ ...values, ...routineTimeChange(current, times) }).eq('household_id', householdId!).eq('id', id).select('id').single();
      });
    },
    stop: (id: string, date: string) => write(() => supabase.from('routine_items').update({ end_date: date }).eq('household_id', householdId!).eq('id', id).select('id').single()),
    remove: (ids: string[]) => write(() => supabase.from('routine_items').delete().eq('household_id', householdId!).in('id', ids).select('id')),
    typical: () => write(() => supabase.from('routine_items').insert(TYPICAL_MEALS.map(meal => ({ ...meal, kind: 'meal', household_id: householdId!, start_date: format(new Date(), 'yyyy-MM-dd') }))).select('id')),
  };
}
