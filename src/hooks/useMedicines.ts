import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { medicineSchema, medicineLogSchema } from '@/lib/validation';

export interface Medicine {
  id: string;
  name: string;
  schedule_note: string;
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

export function useMedicines(viewDate: string) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [logs, setLogs] = useState<MedicineLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMedicines = useCallback(async () => {
    const { data, error } = await supabase
      .from('medicines' as any)
      .select('*')
      .order('name');
    if (error) {
      console.error(error);
    } else {
      setMedicines((data as any[]) ?? []);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase
      .from('medicine_logs' as any)
      .select('*, medicine:medicines(*)')
      .eq('date', viewDate)
      .order('created_at', { ascending: true });
    if (error) {
      console.error(error);
    } else {
      setLogs((data as any[])?.map((d: any) => ({ ...d, medicine: d.medicine })) ?? []);
    }
    setLoading(false);
  }, [viewDate]);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  const addMedicineLog = useCallback(async (log: { medicine_id: string; hour: number; am_pm: string; recorded_by: string; date?: string }) => {
    const parsed = medicineLogSchema.safeParse({ ...log, date: log.date || viewDate });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return;
    }
    const { error } = await supabase.from('medicine_logs' as any).insert({
      date: viewDate,
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
      await fetchLogs();
    }
  }, [viewDate, fetchLogs]);

  const deleteMedicineLog = useCallback(async (id: string) => {
    const { error } = await supabase.from('medicine_logs' as any).delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      console.error(error);
    } else {
      setLogs(prev => prev.filter(l => l.id !== id));
      toast.success('Deleted');
    }
  }, []);

  const updateMedicineLog = useCallback(async (id: string, updates: { medicine_id?: string; hour?: number; am_pm?: string; recorded_by?: string }) => {
    const { error } = await supabase.from('medicine_logs' as any).update(updates as any).eq('id', id);
    if (error) {
      toast.error('Failed to update');
      console.error(error);
    } else {
      toast.success('Updated');
      await fetchLogs();
    }
  }, [fetchLogs]);

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
      await fetchMedicines();
    }
  }, [fetchMedicines]);

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
      await fetchLogs();
    }
  }, [viewDate, fetchLogs]);

  return { medicines, logs, loading, addMedicineLog, deleteMedicineLog, updateMedicineLog, addNewMedicine, copyFromPreviousDay };
}
