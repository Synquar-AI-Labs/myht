import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface Transcript {
  id: string;
  date: string;
  title: string | null;
  audio_path: string | null;
  transcript: string;
  summary: string;
  action_items: string[];
  follow_ups: string[];
  recorded_by: string;
  created_at: string;
}

/**
 * The ONLY fetcher for `['audio_transcripts', date]` — HistoryTab shares the
 * cache key, so the result shape must stay identical everywhere.
 */
export async function fetchTranscriptsForDate(date: string): Promise<Transcript[]> {
  const { data, error } = await supabase
    .from('audio_transcripts')
    .select('*')
    .eq('date', date)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    action_items: Array.isArray(d.action_items) ? (d.action_items as string[]) : [],
    follow_ups: Array.isArray(d.follow_ups) ? (d.follow_ups as string[]) : [],
  }));
}

/** Data half of the transcripts feature. Recording/processing lives in the
 *  app-level RecordingProvider so it can survive navigation. */
export function useTranscripts() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: transcripts = [], isLoading: loading } = useQuery({
    queryKey: ['audio_transcripts', selectedDate],
    queryFn: () => fetchTranscriptsForDate(selectedDate),
  });

  const deleteTranscript = async (id: string) => {
    const { error } = await supabase.from('audio_transcripts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete transcript', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted' });
      queryClient.invalidateQueries({ queryKey: ['audio_transcripts'] });
      queryClient.invalidateQueries({ queryKey: ['audio_transcripts-count'] });
    }
  };

  return {
    transcripts,
    selectedDate,
    setSelectedDate,
    loading,
    deleteTranscript,
  };
}
