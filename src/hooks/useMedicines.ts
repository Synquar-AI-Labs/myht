import { useCallback } from 'react';
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
  show_in_quick_log: boolean;
  created_at: string;
}

export interface MedicineLog {
  id: string;
  date: string;
  medicine_id: string;
  hour: number;
  am_pm: string;
  recorded_by: string;
  created_at: string;
  medicine?: Medicine;
}

// Shared across useMedicines, useMedicineSchedule and the report cards so every
// screen reads the same cached medicine list.
export const MEDICINES_QUERY_KEY = ['medicines'] as const;

export async function fetchMedicinesList() {
  const { data, error } = await supabase
    .from('medicines' as any)
    .select('*')
    .order('name');
  if (error) throw error;
  return (data as any[]) ?? [];
}

export function useMedicines(viewDate: string) {
  const queryClient = useQueryClient();

  const { data: medicines = [] } = useQuery({
    queryKey: MEDICINES_QUERY_KEY,
    queryFn: fetchMedicinesList,
  });

  const { data: logs = [], isLoading: loading } = useQuery({
    queryKey: ['medicine_logs_by_date', viewDate],
    queryFn: async (): Promise<MedicineLog[]> => {
      const { data, error } = await supabase
        .from('medicine_logs' as any)
        .select('*, medicine:medicines(*)')
        .eq('date', viewDate)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any[])?.map((d: any) => ({ ...d, medicine: d.medicine })) ?? [];
    },
  });

  const invalidateMedicines = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: MEDICINES_QUERY_KEY });
  }, [queryClient]);

  const invalidateLogs = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['medicine_logs_by_date'] });
    queryClient.invalidateQueries({ queryKey: ['medicine_logs_all'] });
  }, [queryClient]);

  const addMedicineLog = useCallback(async (log: { medicine_id: string; hour: number; am_pm: string; recorded_by: string; date?: string }) => {
    const parsed = medicineLogSchema.safeParse({ ...log, date: log.date || viewDate });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return;
    }
    const { error } = await supabase.from('medicine_logs' as any).insert({
      date: parsed.data.date,
      medicine_id: parsed.data.medicine_id,
      hour: parsed.data.hour,
      am_pm: parsed.data.am_pm,
      recorded_by: parsed.data.recorded_by,
    } as any);
    if (error) {
      toast.error('Failed to add medicine log');
      console.error(error);
    } else {
      toast.success('Medicine logged');
      invalidateLogs();
    }
  }, [viewDate, invalidateLogs]);

  const deleteMedicineLog = useCallback(async (id: string) => {
    const { error } = await supabase.from('medicine_logs' as any).delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      console.error(error);
    } else {
      invalidateLogs();
      toast.success('Deleted');
    }
  }, [invalidateLogs]);

  const updateMedicineLog = useCallback(async (id: string, updates: { medicine_id?: string; hour?: number; am_pm?: string; recorded_by?: string }) => {
    const { error } = await supabase.from('medicine_logs' as any).update(updates as any).eq('id', id);
    if (error) {
      toast.error('Failed to update');
      console.error(error);
    } else {
      toast.success('Updated');
      invalidateLogs();
    }
  }, [invalidateLogs]);

  const addNewMedicine = useCallback(async (name: string, scheduleNote: string) => {
    const parsed = medicineSchema.safeParse({ name, schedule_note: scheduleNote });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return;
    }
    const { error } = await supabase.from('medicines' as any).insert({ name: parsed.data.name, schedule_note: parsed.data.schedule_note } as any);
    if (error) {
      toast.error('Failed to add medicine');
      console.error(error);
    } else {
      toast.success('Medicine added to list');
      invalidateMedicines();
    }
  }, [invalidateMedicines]);

  const copyFromPreviousDay = useCallback(async (previousDate: string) => {
    const { data, error } = await supabase
      .from('medicine_logs' as any)
      .select('*')
      .eq('date', previousDate);
    if (error || !data || (data as any[]).length === 0) {
      toast.error('No previous medicine logs to copy');
      return;
    }
    const inserts = (data as any[]).map((log: any) => ({
      date: viewDate,
      medicine_id: log.medicine_id,
      hour: log.hour,
      am_pm: log.am_pm,
      recorded_by: log.recorded_by,
    }));
    const { error: insertError } = await supabase.from('medicine_logs' as any).insert(inserts as any);
    if (insertError) {
      toast.error('Failed to copy medicines');
      console.error(insertError);
    } else {
      toast.success('Copied medicine logs from previous day');
      invalidateLogs();
    }
  }, [viewDate, invalidateLogs]);

  return { medicines, logs, loading, addMedicineLog, deleteMedicineLog, updateMedicineLog, addNewMedicine, copyFromPreviousDay };
}
