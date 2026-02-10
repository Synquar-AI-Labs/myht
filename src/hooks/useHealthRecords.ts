import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HealthRecord, HealthRecordForm } from '@/types/health';
import { toast } from 'sonner';

export function useHealthRecords() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from('health_records')
      .select('*')
      .order('date', { ascending: false });
    if (error) {
      toast.error('Failed to load records');
      console.error(error);
    } else {
      setRecords(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const addRecord = useCallback(async (form: HealthRecordForm) => {
    // Upsert by date — delete existing record for that date first
    await supabase.from('health_records').delete().eq('date', form.date);
    const { error } = await supabase.from('health_records').insert({
      date: form.date,
      feed_bags: form.feedBags,
      weight: form.weight,
      bp_systolic: form.bpSystolic,
      bp_diastolic: form.bpDiastolic,
      food_taken: form.foodTaken,
      food_description: form.foodDescription,
      stool_passed: form.stoolPassed,
      stool_count: form.stoolCount,
      vomiting: form.vomiting,
      constipation: form.constipation,
    });
    if (error) {
      toast.error('Failed to save record');
      console.error(error);
    } else {
      await fetchRecords();
    }
  }, [fetchRecords]);

  const deleteRecord = useCallback(async (id: string) => {
    const { error } = await supabase.from('health_records').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      console.error(error);
    } else {
      setRecords(prev => prev.filter(r => r.id !== id));
    }
  }, []);

  const getLatestRecord = useCallback(() => {
    return records.length > 0 ? records[0] : null;
  }, [records]);

  const getRecordByDate = useCallback((date: string) => {
    return records.find(r => r.date === date) || null;
  }, [records]);

  return { records, loading, addRecord, deleteRecord, getLatestRecord, getRecordByDate };
}
