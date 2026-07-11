import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MEDICINES_QUERY_KEY, fetchMedicinesList } from '@/hooks/useMedicines';

export interface MedicineSchedule {
  id: string;
  name: string;
  potency: string;
  amount: string;
  med_type: string;
  category: string;
  schedule_time: string;
  frequency: string;
  schedule_note: string;
  show_in_quick_log: boolean;
  created_at: string;
}

export type MedicineScheduleInsert = Omit<MedicineSchedule, 'id' | 'created_at'>;

export function useMedicineSchedule() {
  const queryClient = useQueryClient();

  const { data: medicines = [], isLoading: loading } = useQuery({
    queryKey: MEDICINES_QUERY_KEY,
    queryFn: fetchMedicinesList,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: MEDICINES_QUERY_KEY });

  const addMedicine = async (med: MedicineScheduleInsert) => {
    const { error } = await supabase.from('medicines').insert(med);
    if (error) { toast.error('Failed to add medicine'); return; }
    toast.success(`Added ${med.name}`);
    invalidate();
  };

  const updateMedicine = async (id: string, med: Partial<MedicineScheduleInsert>) => {
    const { error } = await supabase.from('medicines').update(med).eq('id', id);
    if (error) { toast.error('Failed to update medicine'); return; }
    toast.success('Updated');
    invalidate();
  };

  const deleteMedicine = async (id: string) => {
    const { error } = await supabase.from('medicines').delete().eq('id', id);
    if (error) { toast.error('Failed to delete medicine'); return; }
    toast.success('Deleted');
    invalidate();
  };

  return { medicines: medicines as MedicineSchedule[], loading, addMedicine, updateMedicine, deleteMedicine, refetch: invalidate };
}
