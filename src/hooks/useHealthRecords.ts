import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HealthRecord, HealthRecordForm } from '@/types/health';
import { toast } from 'sonner';
import { healthRecordSchema } from '@/lib/validation';

// Fields where new entries ADD to the existing value instead of replacing
const ADDITIVE_FIELDS = new Set([
  'feed_bags', 'bile_bags', 'stool_count', 'vomit_count', 'urine_count', 'flush_ml', 'flush_count',
]);

type BpReading = { id: string; date: string; systolic: number; diastolic: number; recorded_by: string; created_at: string };

export function useHealthRecords() {
  const queryClient = useQueryClient();

  const { data: records = [], isLoading: loading, isError: recordsError } = useQuery({
    queryKey: ['health_records'],
    queryFn: async (): Promise<HealthRecord[]> => {
      const { data, error } = await supabase
        .from('health_records')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bpReadings = [], isLoading: bpLoading, isError: bpError } = useQuery({
    queryKey: ['bp_readings'],
    queryFn: async (): Promise<BpReading[]> => {
      const { data, error } = await supabase
        .from('bp_readings' as any)
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const loadError = recordsError || bpError;

  const invalidateRecords = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['health_records'] });
  }, [queryClient]);
  const invalidateBp = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['bp_readings'] });
  }, [queryClient]);

  /** Returns true only when the record verifiably saved. */
  const addRecord = useCallback(async (form: HealthRecordForm): Promise<boolean> => {
    const parsed = healthRecordSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return false;
    }
    // Only the fields the daily form owns. Anything else on the row
    // (bile_bags, urine_count, flush_ml — logged via Quick Log) is preserved.
    const formFields = {
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
    };

    // Update in place if the day already has a record; otherwise insert.
    // (Never delete-then-insert — a failed insert would lose the whole day.)
    const { data: existing } = await supabase
      .from('health_records')
      .select('id')
      .eq('date', form.date)
      .maybeSingle();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('health_records')
        .update(formFields as any)
        .eq('id', existing.id));
    } else {
      ({ error } = await supabase
        .from('health_records')
        .insert({ date: form.date, ...formFields } as any));
    }

    if (error) {
      toast.error('Failed to save record');
      console.error(error);
      return false;
    }
    invalidateRecords();
    return true;
  }, [invalidateRecords]);

  /** Returns true only when the delete verifiably succeeded. */
  const deleteRecord = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('health_records').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      console.error(error);
      return false;
    }
    invalidateRecords();
    return true;
  }, [invalidateRecords]);

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
    invalidateRecords();
  }, [invalidateRecords]);

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
    invalidateRecords();
    invalidateBp();
  }, [invalidateRecords, invalidateBp]);

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
    invalidateRecords();
    invalidateBp();
  }, [bpReadings, invalidateRecords, invalidateBp]);

  return { records, bpReadings, loading, bpLoading, loadError, addRecord, deleteRecord, getLatestRecord, getRecordByDate, updateField, saveBpReading, getBpReadingsForDate, deleteBpReading };
}
