import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Maps each database table to the React Query keys that depend on it.
// When Supabase pushes a change for a table, every matching query is
// invalidated so *all* open screens (and other caregivers' phones) refresh.
const TABLE_KEYS: Record<string, string[][]> = {
  health_records: [['health_records']],
  bp_readings: [['bp_readings']],
  medicines: [['medicines']],
  medicine_logs: [['medicine_logs_by_date'], ['medicine_logs_all']],
  appointments: [['appointments']],
  custom_actions: [['custom_actions']],
  custom_action_logs: [['custom_action_logs']],
  hospital_stays: [['hospital-stays']],
  written_notes: [['written-notes']],
  audio_transcripts: [['audio_transcripts']],
};

/**
 * Subscribes to Postgres change events for every shared table and invalidates
 * the relevant React Query caches. Mount this once, high in the tree.
 *
 * If realtime is not enabled on the tables server-side, this simply receives
 * no events (harmless) — React Query's refetch-on-focus still keeps data fresh.
 */
export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel('db-sync');

    Object.entries(TABLE_KEYS).forEach(([table, keys]) => {
      // supabase-js's overloads don't narrow a dynamic event string cleanly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (channel.on as any)(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          keys.forEach(queryKey => queryClient.invalidateQueries({ queryKey }));
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
