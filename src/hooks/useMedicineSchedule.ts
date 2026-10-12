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
  start_date?: string | null;
  schedule_note: string;
  show_in_quick_log: boolean;
  created_at: string;
  source?: string;
}

export type MedicineScheduleInsert = Omit<MedicineSchedule, 'id' | 'created_at'>;

export function useMedicineSchedule() {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  const { data: medicines = [], isLoading: loading, isError: loadError, isSuccess: loaded } = useQuery({
    queryKey: medicineKeys.list(householdId),
    queryFn: () => fetchMedicinesList(householdId),
    enabled: !!householdId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: medicineKeys.list(householdId) });

  const addMedicine = async (med: MedicineScheduleInsert, onSaved?: (medicine: MedicineSchedule) => void) => {
    if (!householdId) return false;
    const { data, error } = await supabase.from('medicines').insert({ ...med, household_id: householdId }).select('*').single();
    if (error) { toast.error('Failed to add medicine'); return false; }
    toast.success(`Added ${med.name}`);
    onSaved?.(data);
    invalidate();
    return true;
  };

  const updateMedicine = async (id: string, med: Partial<MedicineScheduleInsert>) => {
    if (!householdId) return false;
    const { error } = await supabase.from('medicines').update(med).eq('household_id', householdId).eq('id', id);
    if (error) { toast.error('Failed to update medicine'); return false; }
    toast.success('Updated');
    invalidate();
    return true;
  };

  // Deleting a medicine is intentionally not supported: its dose logs are the
  // patient's medical record (DB enforces this with ON DELETE RESTRICT).
  // Archiving arrives with the regimen-version model.
  return { medicines: medicines as MedicineSchedule[], loading, loadError, loaded, addMedicine, updateMedicine, refetch: invalidate };
}
