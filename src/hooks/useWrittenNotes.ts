import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { fetchAllRows } from '@/lib/fetchAll';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { domainKeys } from '@/lib/domainKeys';

export function useWrittenNotes() {
  const queryClient = useQueryClient();
  const { householdId, caregivers } = useHousehold();

  const { data: notes = [], isLoading: loading, isError: loadError } = useQuery({
    queryKey: domainKeys.notes(householdId),
    enabled: !!householdId,
    queryFn: async () => {
      return fetchAllRows((from, to) => supabase
        .from('written_notes')
        .select('*', { count: 'exact' })
        .eq('household_id', householdId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to));
    },
  });

  const addNote = async (title: string, content: string, caregiverId: string) => {
    const person = caregivers.find(p => p.is_active && p.caregiver_id === caregiverId);
    if (!householdId || !person) throw new Error('Choose a person in this family');
    const { error } = await supabase.from('written_notes').insert({
      household_id: householdId, caregiver_id: person.caregiver_id,
      // Explicit local calendar date — the DB default is server (UTC) time,
      // which would file an evening note under tomorrow.
      date: format(new Date(), 'yyyy-MM-dd'),
      title: title || null,
      content,
      recorded_by: person.display_name,
    });
    if (error) { toast.error('Failed to save note'); throw error; }
    toast.success('Note saved');
    queryClient.invalidateQueries({ queryKey: domainKeys.notes(householdId) });
  };

  return { notes, loading, loadError, addNote };
}
