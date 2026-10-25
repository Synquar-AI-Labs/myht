import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchAllRows } from '@/lib/fetchAll';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { domainKeys } from '@/lib/domainKeys';

export interface CustomAction {
  id: string;
  name: string;
  unit: string;
  color: string;
  default_value: number;
  show_graph: boolean;
  created_at: string;
}

export interface CustomActionLog {
  id: string;
  action_id: string;
  value: number;
  date: string;
  recorded_by: string;
  hour: number;
  am_pm: string;
  created_at: string;
}

export function useCustomActions() {
  const queryClient = useQueryClient();
  const { householdId, caregivers } = useHousehold();

  const { data: actions = [], isLoading: actionsLoading, isFetching: actionsFetching, isError: actionsError } = useQuery({
    queryKey: domainKeys.actions(householdId),
    enabled: !!householdId,
    queryFn: async (): Promise<CustomAction[]> => {
      return fetchAllRows<CustomAction>((from, to) => supabase
        .from('custom_actions')
        .select('*', { count: 'exact' })
        .eq('household_id', householdId!)
        .order('created_at', { ascending: true }).order('id')
        .range(from, to));
    },
  });

  const { data: logs = [], isLoading: logsLoading, isFetching: logsFetching, isError: logsError } = useQuery({
    queryKey: domainKeys.actionLogs(householdId),
    enabled: !!householdId,
    queryFn: async (): Promise<CustomActionLog[]> => {
      return fetchAllRows<CustomActionLog>((from, to) => supabase
        .from('custom_action_logs')
        .select('*', { count: 'exact' })
        .eq('household_id', householdId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to));
    },
  });

  const loading = actionsLoading || logsLoading;
  const loadError = actionsError || logsError;

  const invalidateActions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: domainKeys.actions(householdId) });
  }, [queryClient, householdId]);
  const invalidateLogs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: domainKeys.actionLogs(householdId) });
  }, [queryClient, householdId]);

  const addAction = async (action: { name: string; unit: string; color: string; default_value: number; show_graph: boolean }) => {
    if (!householdId) return;
    const { error } = await supabase.from('custom_actions').insert({ ...action, household_id: householdId });
    if (error) { toast.error('Failed to add custom action'); return; }
    toast.success(`Added ${action.name}`);
    invalidateActions();
  };

  const deleteAction = async (id: string) => {
    if (!householdId) return;
    const { error } = await supabase.from('custom_actions').delete().eq('household_id', householdId).eq('id', id);
    if (error) { toast.error('Failed to delete action'); return; }
    toast.success('Action deleted');
    invalidateActions();
    invalidateLogs();
  };

  const addLog = async (data: { action_id: string; value: number; date: string; caregiver_id: string; hour: number; am_pm: string }) => {
    const person = caregivers.find(p => p.is_active && p.caregiver_id === data.caregiver_id);
    if (!householdId || !person) { toast.error('Choose a person in this family'); return; }
    const { error } = await supabase.from('custom_action_logs').insert({ ...data, household_id: householdId, recorded_by: person.display_name });
    if (error) { toast.error('Failed to log action'); return; }
    toast.success('Logged');
    invalidateLogs();
  };

  const getLogCountForAction = (actionId: string, date?: string) => logs.filter(l => l.action_id === actionId && (!date || l.date === date)).length;

  return { actions, logs, loading, refreshing: actionsFetching || logsFetching, loadError, addAction, deleteAction, addLog, getLogCountForAction, refetchLogs: invalidateLogs, retry: () => { invalidateActions(); invalidateLogs(); } };
}
