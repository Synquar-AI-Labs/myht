import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { MAX_TRANSCRIBABLE_BYTES, describeBytes } from '@/lib/recording';

export type ProcessingStage = null | 'uploading' | 'transcribing' | 'saving';

/** A recording that made it to storage but failed transcription/saving —
 *  kept so the caregiver can retry WITHOUT re-recording or re-uploading. */
interface PendingRetry {
  storagePath: string;
  ext: string;
  title: string;
  recordedBy: string;
  date: string;
}

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
  return (data || []).map(d => ({
    ...d,
    action_items: Array.isArray(d.action_items) ? (d.action_items as string[]) : [],
    follow_ups: Array.isArray(d.follow_ups) ? (d.follow_ups as string[]) : [],
  }));
}

export function useTranscripts() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [processingStage, setProcessingStage] = useState<ProcessingStage>(null);
  const [pendingRetry, setPendingRetry] = useState<PendingRetry | null>(null);
  const processing = processingStage !== null;

  const { data: transcripts = [], isLoading: loading } = useQuery({
    queryKey: ['audio_transcripts', selectedDate],
    queryFn: () => fetchTranscriptsForDate(selectedDate),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['audio_transcripts'] });
    queryClient.invalidateQueries({ queryKey: ['audio_transcripts-count'] });
  };

  /** Transcribe an already-uploaded file and save the result. */
  const transcribeAndSave = async (job: PendingRetry) => {
    setProcessingStage('transcribing');
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
        body: JSON.stringify({ storagePath: job.storagePath, fileName: `recording.${job.ext}` }),
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

    setProcessingStage('saving');
    const { data: urlData } = supabase.storage.from('audio-files').getPublicUrl(job.storagePath);
    const { error: insertError } = await supabase.from('audio_transcripts').insert({
      date: job.date,
      title: job.title || null,
      audio_url: urlData.publicUrl,
      transcript: result.transcript,
      summary: result.summary,
      action_items: result.action_items,
      follow_ups: result.follow_ups,
      recorded_by: job.recordedBy,
    });
    if (insertError) throw insertError;

    setPendingRetry(null);
    toast({ title: 'Transcript saved', description: 'Audio has been transcribed and analyzed.' });
    invalidate();
  };

  const processAudio = async (audioBlob: Blob, title: string, recordedBy: string) => {
    // Fail fast, BEFORE a long upload: the transcription API rejects >25 MB.
    if (audioBlob.size > MAX_TRANSCRIBABLE_BYTES) {
      toast({
        title: 'Recording too large to transcribe',
        description: `This one is ${describeBytes(audioBlob.size)}; the limit is ${describeBytes(MAX_TRANSCRIBABLE_BYTES)} (about 90 minutes). Please split long conversations.`,
        variant: 'destructive',
      });
      return;
    }

    setProcessingStage('uploading');
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
        // MediaRecorder types can carry codec suffixes ("audio/mp4;codecs=…")
        const baseType = audioBlob.type.split(';')[0];
        ext = mimeExtMap[baseType] || 'webm';
      }

      const storagePath = `${selectedDate}/${Date.now()}.${ext}`;
      const uploadMime = audioBlob.type || 'audio/webm';
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(storagePath, audioBlob, { contentType: uploadMime });
      if (uploadError) throw uploadError;

      const job: PendingRetry = { storagePath, ext, title, recordedBy, date: selectedDate };
      try {
        await transcribeAndSave(job);
      } catch (e) {
        // The audio IS safely uploaded — remember it so retry skips both
        // re-recording and re-uploading.
        setPendingRetry(job);
        throw e;
      }
    } catch (e) {
      console.error('processAudio error:', e);
      const message = e instanceof Error ? e.message : 'Failed to process audio';
      toast({ title: "Couldn't finish processing", description: message, variant: 'destructive' });
    } finally {
      setProcessingStage(null);
    }
  };

  /** Retry transcription of the last uploaded-but-unprocessed recording. */
  const retryTranscription = async () => {
    if (!pendingRetry) return;
    try {
      await transcribeAndSave(pendingRetry);
    } catch (e) {
      console.error('retryTranscription error:', e);
      const message = e instanceof Error ? e.message : 'Failed to process audio';
      toast({ title: "Couldn't finish processing", description: message, variant: 'destructive' });
    } finally {
      setProcessingStage(null);
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
    processingStage,
    canRetry: pendingRetry !== null,
    retryTranscription,
    processAudio,
    deleteTranscript,
  };
}
