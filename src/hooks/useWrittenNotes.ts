import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

export function useWrittenNotes() {
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading: loading, isError: loadError } = useQuery({
    queryKey: ['written-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('written_notes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addNote = async (title: string, content: string, recordedBy: string) => {
    const { error } = await supabase.from('written_notes').insert({
      // Explicit local calendar date — the DB default is server (UTC) time,
      // which would file an evening note under tomorrow.
      date: format(new Date(), 'yyyy-MM-dd'),
      title: title || null,
      content,
      recorded_by: recordedBy,
    });
    if (error) { toast.error('Failed to save note'); throw error; }
    toast.success('Note saved');
    queryClient.invalidateQueries({ queryKey: ['written-notes'] });
  };

  return { notes, loading, loadError, addNote };
}
