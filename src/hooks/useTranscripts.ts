import { useState, useEffect, useCallback } from 'react';
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

export type ProcessingStep = 
  | 'recording'
  | 'saving'
  | 'uploading'
  | 'transcribing'
  | 'analyzing'
  | 'summarizing'
  | null;

export function useTranscripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);

  const fetchTranscripts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('audio_transcripts')
      .select('*')
      .eq('date', selectedDate)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transcripts:', error);
    } else {
      setTranscripts(
        (data || []).map((d: any) => ({
          ...d,
          action_items: Array.isArray(d.action_items) ? d.action_items : [],
          follow_ups: Array.isArray(d.follow_ups) ? d.follow_ups : [],
        }))
      );
    }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchTranscripts();
  }, [fetchTranscripts]);

  const processAudio = async (audioBlob: Blob, title: string, recordedBy: string) => {
    setProcessing(true);
    try {
      if (!audioBlob || audioBlob.size === 0) {
        throw new Error('Recording is empty. Please try again.');
      }

      console.log('processAudio: blob size =', audioBlob.size, 'type =', audioBlob.type);

      // Step 1: Upload audio to storage
      setProcessingStep('uploading');
      const contentType = audioBlob.type || 'audio/webm';
      const ext = contentType.includes('mp4') || contentType.includes('mp3') ? 'mp3' : 'webm';
      const fileName = `${selectedDate}/${Date.now()}.${ext}`;

      const arrayBuffer = await audioBlob.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(fileName, arrayBuffer, {
          contentType,
          cacheControl: '3600',
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage.from('audio-files').getPublicUrl(fileName);
      const audioUrl = urlData.publicUrl;

      // Step 2: Call edge function with the URL (not raw audio) to avoid load-failed errors
      setProcessingStep('transcribing');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be logged in to process audio');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000); // 3 min timeout

      let res: Response;
      try {
        res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ audioUrl }),
            signal: controller.signal,
          }
        );
      } catch (fetchErr: any) {
        clearTimeout(timeout);
        if (fetchErr.name === 'AbortError') {
          throw new Error('Processing timed out. Your recording was uploaded — try again later.');
        }
        throw new Error('Network error. Your recording was saved locally — try uploading it again.');
      } finally {
        clearTimeout(timeout);
      }

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

      setProcessingStep('analyzing');
      const result = await res.json();

      // Step 3: Save to database
      setProcessingStep('summarizing');
      const { error: insertError } = await supabase.from('audio_transcripts').insert({
        date: selectedDate,
        title: title || null,
        audio_url: audioUrl,
        transcript: result.transcript,
        summary: result.summary,
        action_items: result.action_items,
        follow_ups: result.follow_ups,
        recorded_by: recordedBy,
      });

      if (insertError) throw insertError;

      toast({ title: 'Transcript saved', description: 'Audio has been transcribed and analyzed.' });
      await fetchTranscripts();
    } catch (e: any) {
      console.error('processAudio error:', e);
      toast({
        title: 'Error',
        description: e.message || 'Failed to process audio. If you recorded, a backup was saved to your device.',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setProcessingStep(null);
    }
  };

  const deleteTranscript = async (id: string) => {
    const { error } = await supabase.from('audio_transcripts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete transcript', variant: 'destructive' });
    } else {
      toast({ title: 'Deleted' });
      await fetchTranscripts();
    }
  };

  return {
    transcripts,
    selectedDate,
    setSelectedDate,
    loading,
    processing,
    processingStep,
    processAudio,
    deleteTranscript,
    setProcessingStep,
  };
}
