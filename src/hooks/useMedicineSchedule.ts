import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [medicines, setMedicines] = useState<MedicineSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('medicines')
      .select('id, name, potency, amount, med_type, category, schedule_time, frequency, schedule_note, show_in_quick_log, created_at')
      .order('name');
    if (error) { toast.error('Failed to load medicines'); setLoading(false); return; }
    setMedicines((data as MedicineSchedule[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const addMedicine = async (med: MedicineScheduleInsert) => {
    const { error } = await supabase.from('medicines').insert(med);
    if (error) { toast.error('Failed to add medicine'); return; }
    toast.success(`Added ${med.name}`);
    fetch();
  };

  const updateMedicine = async (id: string, med: Partial<MedicineScheduleInsert>) => {
    const { error } = await supabase.from('medicines').update(med).eq('id', id);
    if (error) { toast.error('Failed to update medicine'); return; }
    toast.success('Updated');
    fetch();
  };

  const deleteMedicine = async (id: string) => {
    const { error } = await supabase.from('medicines').delete().eq('id', id);
    if (error) { toast.error('Failed to delete medicine'); return; }
    toast.success('Deleted');
    fetch();
  };

  return { medicines, loading, addMedicine, updateMedicine, deleteMedicine, refetch: fetch };
}
