import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createInvalidationBatcher } from '@/lib/invalidationBatcher';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { medicineKeys } from '@/hooks/useMedicines';

// Domains awaiting household scoping retain their existing cache keys.
const TABLE_KEYS: Record<string, string[][]> = {
  health_records: [['health_records']],
  bp_readings: [['bp_readings']],
  appointments: [['appointments']],
  custom_actions: [['custom_actions']],
  custom_action_logs: [['custom_action_logs']],
  hospital_stays: [['hospital-stays'], ['hospital-stays-summary']],
  written_notes: [['written-notes']],
  audio_transcripts: [['audio_transcripts'], ['audio_transcripts-count']],
};

/**
 * Only the household ticker is published; medical rows never travel over
 * realtime. Mount once and refresh the affected domain through its queries.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase.channel(`household-sync-${householdId}`);
    const batcher = createInvalidationBatcher(queryKey => {
      void queryClient.invalidateQueries({ queryKey });
    });
    let subscribed = false;

    channel.on('postgres_changes',
      { event: '*', schema: 'public', table: 'household_sync', filter: `household_id=eq.${householdId}` },
      payload => {
        const table = (payload.new as { table_name?: string }).table_name;
        const keys = table === 'medicines' ? [medicineKeys.list(householdId)]
          : table === 'medicine_logs' ? [medicineKeys.logs(householdId), medicineKeys.reports(householdId)]
          : TABLE_KEYS[table ?? ''] ?? [];
        keys.forEach(queryKey => batcher.queue([...queryKey]));
      });

    channel.subscribe(status => {
      if (status !== 'SUBSCRIBED') return;
      if (subscribed) {
        batcher.queue(['household', householdId]);
        Object.values(TABLE_KEYS).flat().forEach(key => batcher.queue(key));
      }
      subscribed = true;
    });

    return () => {
      batcher.cancel();
      supabase.removeChannel(channel);
    };
  }, [queryClient, householdId]);
}
