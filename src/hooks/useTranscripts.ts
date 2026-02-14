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

export function useTranscripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

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
      // Upload audio to storage
      const storageFileName = `${selectedDate}/${Date.now()}.webm`;
      const uploadMime = audioBlob.type || 'audio/webm';
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(storageFileName, audioBlob, { contentType: uploadMime });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('audio-files').getPublicUrl(storageFileName);

      // Call edge function with user's auth token
      const formData = new FormData();
      // Preserve original file type for uploads (e.g. M4A voice memos)
      const audioFileName = audioBlob instanceof File ? audioBlob.name : 'recording.webm';
      const mimeType = audioBlob.type || 'audio/webm';
      formData.append('audio', new File([audioBlob], audioFileName, { type: mimeType }));

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be logged in to process audio');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
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
      await fetchTranscripts();
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
      await fetchTranscripts();
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
