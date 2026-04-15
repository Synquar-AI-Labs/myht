import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { HealthRecord, HealthRecordForm } from '@/types/health';
import { toast } from 'sonner';
import { healthRecordSchema } from '@/lib/validation';

// Fields where new entries ADD to the existing value instead of replacing
const ADDITIVE_FIELDS = new Set([
  'feed_bags', 'bile_bags', 'stool_count', 'vomit_count', 'urine_count', 'flush_ml', 'flush_count',
]);

export function useHealthRecords() {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [bpReadings, setBpReadings] = useState<{ id: string; date: string; systolic: number; diastolic: number; recorded_by: string; created_at: string }[]>([]);
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

  const fetchBpReadings = useCallback(async () => {
    const { data, error } = await supabase
      .from('bp_readings' as any)
      .select('*')
      .order('created_at', { ascending: true });
    if (!error) setBpReadings((data as any[]) ?? []);
  }, []);

  useEffect(() => { fetchRecords(); fetchBpReadings(); }, [fetchRecords, fetchBpReadings]);

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

    // BP fields are handled specially — skip individual bp updates here;
    // they go through saveBpReading instead
    if (dbField === 'bp_systolic' || dbField === 'bp_diastolic') return;

    // Check if record exists for this date
    const { data: existing } = await supabase
      .from('health_records')
      .select('*')
      .eq('date', date)
      .maybeSingle();

    if (existing) {
      let newValue = value;
      // For additive fields, ADD to existing value
      if (ADDITIVE_FIELDS.has(dbField) && typeof value === 'number') {
        const currentVal = (existing as any)[dbField] ?? 0;
        newValue = currentVal + value;
      }
      const { error } = await supabase
        .from('health_records')
        .update({ [dbField]: newValue, recorded_by: recordedBy } as any)
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

  // Save an individual BP reading and update the health_records row with the day's average
  const saveBpReading = useCallback(async (date: string, systolic: number, diastolic: number, recordedBy: string) => {
    // Insert individual reading
    const { error: insertErr } = await supabase.from('bp_readings' as any).insert({
      date, systolic, diastolic, recorded_by: recordedBy,
    } as any);
    if (insertErr) { toast.error('Failed to save BP reading'); console.error(insertErr); return; }

    // Fetch all readings for this date to compute average
    const { data: dayReadings } = await supabase
      .from('bp_readings' as any)
      .select('*')
      .eq('date', date);
    const readings = (dayReadings as any[]) ?? [];
    const avgSys = Math.round(readings.reduce((s: number, r: any) => s + r.systolic, 0) / readings.length);
    const avgDia = Math.round(readings.reduce((s: number, r: any) => s + r.diastolic, 0) / readings.length);

    // Upsert the average into health_records
    const { data: existing } = await supabase.from('health_records').select('id').eq('date', date).maybeSingle();
    if (existing) {
      await supabase.from('health_records').update({ bp_systolic: avgSys, bp_diastolic: avgDia, recorded_by: recordedBy } as any).eq('id', existing.id);
    } else {
      await supabase.from('health_records').insert({ date, bp_systolic: avgSys, bp_diastolic: avgDia, recorded_by: recordedBy } as any);
    }
    await Promise.all([fetchRecords(), fetchBpReadings()]);
  }, [fetchRecords, fetchBpReadings]);

  const getBpReadingsForDate = useCallback((date: string) => {
    return bpReadings.filter(r => r.date === date);
  }, [bpReadings]);

  const deleteBpReading = useCallback(async (id: string, date: string) => {
    const { error } = await supabase.from('bp_readings' as any).delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); console.error(error); return; }

    // Recalculate average
    const remaining = bpReadings.filter(r => r.id !== id && r.date === date);
    const { data: existing } = await supabase.from('health_records').select('id').eq('date', date).maybeSingle();
    if (existing) {
      if (remaining.length > 0) {
        const avgSys = Math.round(remaining.reduce((s, r) => s + r.systolic, 0) / remaining.length);
        const avgDia = Math.round(remaining.reduce((s, r) => s + r.diastolic, 0) / remaining.length);
        await supabase.from('health_records').update({ bp_systolic: avgSys, bp_diastolic: avgDia } as any).eq('id', existing.id);
      } else {
        await supabase.from('health_records').update({ bp_systolic: 0, bp_diastolic: 0 } as any).eq('id', existing.id);
      }
    }
    await Promise.all([fetchRecords(), fetchBpReadings()]);
  }, [bpReadings, fetchRecords, fetchBpReadings]);

  return { records, loading, addRecord, deleteRecord, getLatestRecord, getRecordByDate, updateField, saveBpReading, getBpReadingsForDate, deleteBpReading };
}
