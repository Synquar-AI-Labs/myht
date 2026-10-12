import { useCallback } from 'react';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { useCaregiverChoice } from '@/hooks/useCaregiverChoice';
import { fetchAllRows } from '@/lib/fetchAll';
import { attributionForEdit } from '@/lib/caregiverChoice';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { medicineSchema, medicineLogSchema } from '@/lib/validation';

export interface Medicine {
  id: string;
  name: string;
  potency: string;
  amount: string;
  schedule_note: string;
  schedule_time: string;
  category: string;
  frequency: string;
  show_in_quick_log: boolean;
  created_at: string;
}

export interface MedicineLog {
  id: string;
  date: string;
  medicine_id: string;
  hour: number;
  minute?: number;
  am_pm: string;
  recorded_by: string;
  caregiver_id?: string | null;
  created_at: string;
  medicine?: Medicine;
}

// Shared across useMedicines, useMedicineSchedule and the report cards so every
// screen reads the same cached medicine list.
export const medicineKeys = {
  list: (id?: string) => ['household', id, 'medicines'] as const,
  logs: (id?: string) => ['household', id, 'medicine_logs_by_date'] as const,
  reports: (id?: string) => ['household', id, 'medicine_logs_all'] as const,
};

export async function fetchMedicinesList(householdId: string) {
  if (!householdId) return [];
  return fetchAllRows<Medicine>((from, to) => supabase.from('medicines')
    .select('*', { count: 'exact' }).eq('household_id', householdId)
    .order('name').order('id').range(from, to));
}

export function useMedicines(viewDate: string) {
  const queryClient = useQueryClient();
  const { householdId, caregivers } = useHousehold();
  const { caregiver } = useCaregiverChoice();

  const { data: medicines = [] } = useQuery({
    queryKey: medicineKeys.list(householdId),
    queryFn: () => fetchMedicinesList(householdId),
    enabled: !!householdId,
  });

  const { data: logs = [], isLoading: loading, isError: loadError } = useQuery({
    queryKey: [...medicineKeys.logs(householdId), viewDate],
    enabled: !!householdId,
    queryFn: async (): Promise<MedicineLog[]> => {
      const { data, error } = await supabase
        .from('medicine_logs')
        .select('*, medicine:medicines(*)')
        .eq('household_id', householdId)
        .eq('date', viewDate)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateMedicines = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: medicineKeys.list(householdId) });
  }, [queryClient, householdId]);

  const invalidateLogs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: medicineKeys.logs(householdId) });
    queryClient.invalidateQueries({ queryKey: medicineKeys.reports(householdId) });
  }, [queryClient, householdId]);

  const addMedicineLog = useCallback(async (log: { medicine_id: string; hour: number; minute?: number; am_pm: string; recorded_by: string; caregiver_id?: string; date?: string }) => {
    const saver = log.caregiver_id ? caregivers.find(p => p.is_active && p.caregiver_id === log.caregiver_id) : caregiver;
    if (!householdId || !saver) { toast.error("Choose who's logging"); return; }
    const parsed = medicineLogSchema.safeParse({ ...log, date: log.date || viewDate });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return;
    }
    const { error } = await supabase.from('medicine_logs').insert({
      household_id: householdId,
      caregiver_id: saver.caregiver_id,
      date: parsed.data.date,
      medicine_id: parsed.data.medicine_id,
      hour: parsed.data.hour,
      minute: parsed.data.minute,
      am_pm: parsed.data.am_pm,
      recorded_by: saver.display_name,
    });
    if (error) {
      toast.error('Failed to add medicine log');
      console.error(error);
    } else {
      toast.success('Medicine logged');
      invalidateLogs();
    }
  }, [viewDate, invalidateLogs, householdId, caregiver, caregivers]);

  const deleteMedicineLog = useCallback(async (id: string) => {
    if (!householdId) return;
    const { error } = await supabase.from('medicine_logs').delete().eq('household_id', householdId).eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      console.error(error);
    } else {
      invalidateLogs();
      toast.success('Deleted');
    }
  }, [invalidateLogs, householdId]);

  const updateMedicineLog = useCallback(async (id: string, updates: { medicine_id?: string; hour?: number; minute?: number; am_pm?: string; recorded_by?: string; caregiver_id?: string }) => {
    if (!householdId) return;
    const { recorded_by: _name, caregiver_id: selected, ...fields } = updates;
    let attribution = {};
    if (selected !== undefined) {
      const { data: existing, error } = await supabase.from('medicine_logs').select('caregiver_id').eq('household_id', householdId).eq('id', id).single();
      if (error) { toast.error('Failed to update'); return; }
      try { attribution = attributionForEdit(caregivers, selected, existing.caregiver_id); }
      catch { toast.error('Choose a person in this family'); return; }
    }
    const { error } = await supabase.from('medicine_logs').update({ ...fields, ...attribution }).eq('household_id', householdId).eq('id', id);
    if (error) {
      toast.error('Failed to update');
      console.error(error);
    } else {
      toast.success('Updated');
      invalidateLogs();
    }
  }, [invalidateLogs, householdId, caregiver, caregivers]);

  const addNewMedicine = useCallback(async (name: string, scheduleNote: string) => {
    if (!householdId) return;
    const parsed = medicineSchema.safeParse({ name, schedule_note: scheduleNote });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return;
    }
    const { error } = await supabase.from('medicines').insert({ household_id: householdId, name: parsed.data.name, schedule_note: parsed.data.schedule_note });
    if (error) {
      toast.error('Failed to add medicine');
      console.error(error);
    } else {
      toast.success('Medicine added to list');
      invalidateMedicines();
    }
  }, [invalidateMedicines, householdId]);

  const copyFromPreviousDay = useCallback(async (previousDate: string) => {
    if (!householdId || !caregiver) return;
    const { data, error } = await supabase
      .from('medicine_logs')
      .select('*')
      .eq('household_id', householdId)
      .eq('date', previousDate);
    if (error || !data || data.length === 0) {
      toast.error('No previous medicine logs to copy');
      return;
    }
    const inserts = data.map(log => ({
      household_id: householdId,
      caregiver_id: caregiver.caregiver_id,
      date: viewDate,
      medicine_id: log.medicine_id,
      hour: log.hour,
      minute: log.minute,
      am_pm: log.am_pm,
      recorded_by: caregiver.display_name,
    }));
    const { error: insertError } = await supabase.from('medicine_logs').insert(inserts);
    if (insertError) {
      toast.error('Failed to copy medicines');
      console.error(insertError);
    } else {
      toast.success('Copied medicine logs from previous day');
      invalidateLogs();
    }
  }, [viewDate, invalidateLogs, householdId, caregiver]);

  return { medicines, logs, loading, loadError, addMedicineLog, deleteMedicineLog, updateMedicineLog, addNewMedicine, copyFromPreviousDay };
}
