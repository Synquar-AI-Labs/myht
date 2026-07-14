import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface Transcript {
  id: string;
  date: string;
  title: string | null;
  audio_url: string | null;
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
  return (data || []).map((d: any) => ({
    ...d,
    action_items: Array.isArray(d.action_items) ? d.action_items : [],
    follow_ups: Array.isArray(d.follow_ups) ? d.follow_ups : [],
  }));
}

export function useTranscripts() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [processing, setProcessing] = useState(false);

  const { data: transcripts = [], isLoading: loading } = useQuery({
    queryKey: ['audio_transcripts', selectedDate],
    queryFn: () => fetchTranscriptsForDate(selectedDate),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['audio_transcripts'] });
    queryClient.invalidateQueries({ queryKey: ['audio_transcripts-count'] });
  };

  const processAudio = async (audioBlob: Blob, title: string, recordedBy: string) => {
    setProcessing(true);
    try {
      // Determine correct file extension from blob
      const mimeExtMap: Record<string, string> = {
        'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/m4a': 'm4a',
        'audio/aac': 'm4a', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3',
        'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/webm': 'webm',
        'audio/ogg': 'ogg', 'audio/flac': 'flac', 'video/mp4': 'mp4',
        'audio/x-caf': 'm4a',
      };
      let ext = 'webm';
      if (audioBlob instanceof File && audioBlob.name) {
        const fileExt = audioBlob.name.split('.').pop()?.toLowerCase();
        if (fileExt && ['flac','m4a','mp3','mp4','mpeg','mpga','oga','ogg','wav','webm'].includes(fileExt)) {
          ext = fileExt;
        } else {
          ext = mimeExtMap[audioBlob.type] || 'webm';
        }
      } else {
        ext = mimeExtMap[audioBlob.type] || 'webm';
      }

      // Upload audio to storage with correct extension
      const storagePath = `${selectedDate}/${Date.now()}.${ext}`;
      const uploadMime = audioBlob.type || 'audio/webm';
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(storagePath, audioBlob, { contentType: uploadMime });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('audio-files').getPublicUrl(storagePath);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be logged in to process audio');
      }

      // Send storage path to edge function (avoids FormData/binary issues)
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ storagePath, fileName: `recording.${ext}` }),
        }
      );

      if (!res.ok) {
        let errMsg = 'Processing failed';
        try {
          const err = await res.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `Server error (${res.status})`;
        }
        throw new Error(errMsg);
      }

      const result = await res.json();

      // Save to database
      const { error: insertError } = await supabase.from('audio_transcripts').insert({
        date: selectedDate,
        title: title || null,
        audio_url: urlData.publicUrl,
        transcript: result.transcript,
        summary: result.summary,
        action_items: result.action_items,
        follow_ups: result.follow_ups,
        recorded_by: recordedBy,
      });

      if (insertError) throw insertError;

      toast({ title: 'Transcript saved', description: 'Audio has been transcribed and analyzed.' });
      invalidate();
    } catch (e: any) {
      console.error('processAudio error:', e);
      toast({ title: 'Error', description: e.message || 'Failed to process audio', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const deleteTranscript = async (id: string) => {
    const { error } = await supabase.from('audio_transcripts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete transcript', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted' });
      invalidate();
    }
  };

  return {
    transcripts,
    selectedDate,
    setSelectedDate,
    loading,
    processing,
    processAudio,
    deleteTranscript,
  };
}
