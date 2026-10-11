import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { medicineKeys, fetchMedicinesList } from '@/hooks/useMedicines';
import { useHousehold } from '@/hooks/HouseholdProvider';

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
  const { householdId } = useHousehold();

  const { data: medicines = [], isLoading: loading } = useQuery({
    queryKey: medicineKeys.list(householdId),
    queryFn: () => fetchMedicinesList(householdId),
    enabled: !!householdId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: medicineKeys.list(householdId) });

  const addMedicine = async (med: MedicineScheduleInsert) => {
    if (!householdId) return;
    const { error } = await supabase.from('medicines').insert({ ...med, household_id: householdId });
    if (error) { toast.error('Failed to add medicine'); return; }
    toast.success(`Added ${med.name}`);
    invalidate();
  };

  const updateMedicine = async (id: string, med: Partial<MedicineScheduleInsert>) => {
    if (!householdId) return;
    const { error } = await supabase.from('medicines').update(med).eq('household_id', householdId).eq('id', id);
    if (error) { toast.error('Failed to update medicine'); return; }
    toast.success('Updated');
    invalidate();
  };

  // Deleting a medicine is intentionally not supported: its dose logs are the
  // patient's medical record (DB enforces this with ON DELETE RESTRICT).
  // Archiving arrives with the regimen-version model.
  return { medicines: medicines as MedicineSchedule[], loading, addMedicine, updateMedicine, refetch: invalidate };
}
