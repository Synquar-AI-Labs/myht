import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createInvalidationBatcher } from '@/lib/invalidationBatcher';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { medicineKeys } from '@/hooks/useMedicines';
import { healthKeys } from '@/hooks/useHealthRecords';
import { domainKeys } from '@/lib/domainKeys';
import { skipKeys } from '@/hooks/useDoseSkips';

/**
 * Only the household ticker is published; medical rows never travel over
 * realtime. Mount once and refresh the affected domain through its queries.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { householdId, refresh } = useHousehold();

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase.channel(`household-sync-${householdId}`);
    const batcher = createInvalidationBatcher(queryKey => {
      if (queryKey[0] === 'household-refresh') {
        void refresh();
        return;
      }
      void queryClient.invalidateQueries({ queryKey });
    });
    const queueRefresh = () => {
      batcher.queue(['household-refresh']);
      batcher.queue([...domainKeys.invites(householdId)]);
    };
    let subscribed = false;

    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'household_sync', filter: `household_id=eq.${householdId}` },
      payload => {
        const table = (payload.new as { table_name?: string }).table_name;
        if (['households', 'household_members', 'caregivers', 'household_invites'].includes(table ?? '')) {
          queueRefresh();
        }
        const keys = {
          household_invites: [domainKeys.invites(householdId)],
          medicines: [medicineKeys.list(householdId)],
          medicine_logs: [medicineKeys.logs(householdId), medicineKeys.reports(householdId)],
          dose_skips: [skipKeys(householdId)],
          health_records: [healthKeys.records(householdId)],
          bp_readings: [healthKeys.bp(householdId)],
          appointments: [domainKeys.appointments(householdId)],
          hospital_stays: [domainKeys.stays(householdId), domainKeys.staysSummary(householdId)],
          written_notes: [domainKeys.notes(householdId)],
          custom_actions: [domainKeys.actions(householdId)],
          custom_action_logs: [domainKeys.actionLogs(householdId)],
          audio_transcripts: [domainKeys.transcripts(householdId), domainKeys.transcriptCount(householdId)],
        }[table ?? ''] ?? [];
        keys.forEach(queryKey => batcher.queue([...queryKey]));
      });

    channel.subscribe(status => {
      if (status !== 'SUBSCRIBED') return;
      if (subscribed) {
        batcher.queue(['household', householdId]);
        queueRefresh();
      }
      subscribed = true;
    });

    const refreshVisible = () => {
      if (document.visibilityState === 'visible') queueRefresh();
    };
    document.addEventListener('visibilitychange', refreshVisible);
    const interval = setInterval(refreshVisible, 5 * 60_000);

    return () => {
      batcher.cancel();
      document.removeEventListener('visibilitychange', refreshVisible);
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [queryClient, householdId, refresh]);
}
