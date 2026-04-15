import { useState, useEffect, useCallback } from 'react';
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
  const [actions, setActions] = useState<CustomAction[]>([]);
  const [logs, setLogs] = useState<CustomActionLog[]>([]);

  const fetchActions = useCallback(async () => {
    const { data, error } = await supabase
      .from('custom_actions')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) { toast.error('Failed to load custom actions'); return; }
    setActions(data ?? []);
  }, []);

  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('custom_action_logs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Failed to load custom action logs'); return; }
    setLogs(data ?? []);
  }, []);

  useEffect(() => { fetchActions(); fetchLogs(); }, [fetchActions, fetchLogs]);

  const addAction = async (action: { name: string; unit: string; color: string; default_value: number; show_graph: boolean }) => {
    const { error } = await supabase.from('custom_actions').insert(action);
    if (error) { toast.error('Failed to add custom action'); return; }
    toast.success(`Added ${action.name}`);
    fetchActions();
  };

  const deleteAction = async (id: string) => {
    const { error } = await supabase.from('custom_actions').delete().eq('id', id);
    if (error) { toast.error('Failed to delete action'); return; }
    toast.success('Action deleted');
    fetchActions();
    fetchLogs();
  };

  const addLog = async (data: { action_id: string; value: number; date: string; recorded_by: string; hour: number; am_pm: string }) => {
    const { error } = await supabase.from('custom_action_logs').insert(data);
    if (error) { toast.error('Failed to log action'); return; }
    toast.success('Logged');
    fetchLogs();
  };

  const getLogCountForAction = (actionId: string) => logs.filter(l => l.action_id === actionId).length;

  return { actions, logs, addAction, deleteAction, addLog, getLogCountForAction, refetchLogs: fetchLogs };
}
