import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HealthRecord, HealthRecordForm } from '@/types/health';
import { toast } from 'sonner';
import { healthRecordSchema } from '@/lib/validation';

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
    const parsed = healthRecordSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return;
    }
    // Upsert by date — delete existing record for that date first
    await supabase.from('health_records').delete().eq('date', form.date);
    const { error } = await supabase.from('health_records').insert({
      date: form.date,
      feed_bags: form.feedBags,
      flush_count: form.flushCount,
      weight: form.weight,
      bp_systolic: form.bpSystolic,
      bp_diastolic: form.bpDiastolic,
      food_taken: form.foodTaken,
      food_description: form.foodDescription,
      stool_passed: form.stoolPassed,
      stool_count: form.stoolCount,
      vomiting: form.vomiting,
      vomit_count: form.vomitCount,
      constipation: form.constipation,
      recorded_by: form.recordedBy,
      misc_notes: form.miscNotes,
    } as any);
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

  const updateField = useCallback(async (date: string, field: string, value: number | boolean | string, recordedBy: string) => {
    // Map camelCase UI field names to snake_case DB columns
    const fieldMap: Record<string, string> = {
      feedBags: 'feed_bags',
      flushCount: 'flush_count',
      flushMl: 'flush_ml',
      urineCount: 'urine_count',
      bileBags: 'bile_bags',
      weight: 'weight',
      bpSystolic: 'bp_systolic',
      bpDiastolic: 'bp_diastolic',
      foodTaken: 'food_taken',
      foodDescription: 'food_description',
      stoolPassed: 'stool_passed',
      stoolCount: 'stool_count',
      vomiting: 'vomiting',
      vomitCount: 'vomit_count',
      constipation: 'constipation',
      miscNotes: 'misc_notes',
    };
    const dbField = fieldMap[field] || field;

    // Check if record exists for today
    const { data: existing } = await supabase
      .from('health_records')
      .select('id')
      .eq('date', date)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('health_records')
        .update({ [dbField]: value, recorded_by: recordedBy } as any)
        .eq('id', existing.id);
      if (error) { toast.error('Failed to update'); console.error(error); return; }
    } else {
      const { error } = await supabase
        .from('health_records')
        .insert({ date, [dbField]: value, recorded_by: recordedBy } as any);
      if (error) { toast.error('Failed to save'); console.error(error); return; }
    }
    await fetchRecords();
  }, [fetchRecords]);

  return { records, loading, addRecord, deleteRecord, getLatestRecord, getRecordByDate, updateField };
}
