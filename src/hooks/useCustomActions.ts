import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

  const { data: actions = [], isLoading: actionsLoading, isError: actionsError } = useQuery({
    queryKey: ['custom_actions'],
    queryFn: async (): Promise<CustomAction[]> => {
      const { data, error } = await supabase
        .from('custom_actions')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logs = [], isLoading: logsLoading, isError: logsError } = useQuery({
    queryKey: ['custom_action_logs'],
    queryFn: async (): Promise<CustomActionLog[]> => {
      const { data, error } = await supabase
        .from('custom_action_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading = actionsLoading || logsLoading;
  const loadError = actionsError || logsError;

  const invalidateActions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['custom_actions'] });
  }, [queryClient]);
  const invalidateLogs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['custom_action_logs'] });
  }, [queryClient]);

  const addAction = async (action: { name: string; unit: string; color: string; default_value: number; show_graph: boolean }) => {
    const { error } = await supabase.from('custom_actions').insert(action);
    if (error) { toast.error('Failed to add custom action'); return; }
    toast.success(`Added ${action.name}`);
    invalidateActions();
  };

  const deleteAction = async (id: string) => {
    const { error } = await supabase.from('custom_actions').delete().eq('id', id);
    if (error) { toast.error('Failed to delete action'); return; }
    toast.success('Action deleted');
    invalidateActions();
    invalidateLogs();
  };

  const addLog = async (data: { action_id: string; value: number; date: string; recorded_by: string; hour: number; am_pm: string }) => {
    const { error } = await supabase.from('custom_action_logs').insert(data);
    if (error) { toast.error('Failed to log action'); return; }
    toast.success('Logged');
    invalidateLogs();
  };

  const getLogCountForAction = (actionId: string, date?: string) => logs.filter(l => l.action_id === actionId && (!date || l.date === date)).length;

  return { actions, logs, loading, loadError, addAction, deleteAction, addLog, getLogCountForAction, refetchLogs: invalidateLogs };
}
