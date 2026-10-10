import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HealthRecord, HealthRecordForm } from '@/types/health';
import { toast } from 'sonner';
import { healthRecordSchema } from '@/lib/validation';

import { buildDayRecordWrite, changedFormFields } from '@/lib/dayRecord';
import { fetchAllRows } from '@/lib/fetchAll';

type BpReading = { id: string; date: string; systolic: number; diastolic: number; recorded_by: string; created_at: string };

export function useHealthRecords() {
  const queryClient = useQueryClient();

  const { data: records = [], isLoading: loading, isError: recordsError } = useQuery({
    queryKey: ['health_records'],
    queryFn: async (): Promise<HealthRecord[]> => {
      return fetchAllRows<HealthRecord>((from, to) => supabase
        .from('health_records')
        .select('*', { count: 'exact' })
        .order('date', { ascending: false })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to));
    },
  });

  const { data: bpReadings = [], isLoading: bpLoading, isError: bpError } = useQuery({
    queryKey: ['bp_readings'],
    queryFn: async (): Promise<BpReading[]> => {
      return fetchAllRows<BpReading>((from, to) => supabase
        .from('bp_readings' as any)
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as any);
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
  const addRecord = useCallback(async (form: HealthRecordForm, baseline: HealthRecordForm): Promise<boolean> => {
    const parsed = healthRecordSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return false;
    }
    // Only the fields the daily form owns. Anything else on the row
    // (bile_bags, urine_count, flush_ml — logged via Quick Log) is preserved.
    const formFields = changedFormFields(form as unknown as Record<string, unknown>, {});

    // Update in place if the day already has a record; otherwise insert.
    // (Never delete-then-insert — a failed insert would lose the whole day.)
    const { data: dayRows, error: lookupError } = await supabase
      .from('health_records')
      .select('*')
      .eq('date', form.date)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1);
    if (lookupError) { toast.error('Failed to load the day record'); console.error(lookupError); return false; }
    const existing = dayRows?.[0];

    const writeFields = changedFormFields(form as unknown as Record<string, unknown>, baseline as unknown as Record<string, unknown>);
    if (Object.keys(writeFields).length === 1) { toast.info('Nothing changed'); return false; }
    let error;
    if (existing) {
      ({ error } = await supabase
        .from('health_records')
        .update(writeFields as any)
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

  const updateFields = useCallback(async (date: string, fields: Record<string, number | boolean | string>, recordedBy: string): Promise<boolean> => {
    const fieldMap: Record<string, string> = {
      feedBags: 'feed_bags',
      flushCount: 'flush_count',
      flushMl: 'flush_ml',
      urineCount: 'urine_count',
      bileBags: 'bile_bags',
      weight: 'weight',
      foodTaken: 'food_taken',
      foodDescription: 'food_description',
      stoolPassed: 'stool_passed',
      stoolCount: 'stool_count',
      vomiting: 'vomiting',
      vomitCount: 'vomit_count',
      constipation: 'constipation',
      miscNotes: 'misc_notes',
      bpSystolic: 'bp_systolic',
      bpDiastolic: 'bp_diastolic',
    };
    const columns = Object.fromEntries(Object.entries(fields)
      .map(([key, value]) => [fieldMap[key] || key, value])
      .filter(([key]) => key !== 'bp_systolic' && key !== 'bp_diastolic'));
    if (!Object.keys(columns).length) return false;
    const { data, error: lookupError } = await supabase
      .from('health_records')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1);
    if (lookupError) { toast.error('Failed to load the day record'); console.error(lookupError); return false; }
    const existing = data?.[0];
    const write = buildDayRecordWrite(existing as unknown as Record<string, unknown> ?? null, columns as Record<string, number | boolean | string>, recordedBy);
    const { error } = existing
      ? await supabase
        .from('health_records')
        .update(write as any)
        .eq('id', existing.id)
      : await supabase
        .from('health_records')
        .insert({ date, ...write } as any);
    if (error) { toast.error('Failed to save reading'); console.error(error); return false; }
    invalidateRecords();
    return true;
  }, [invalidateRecords]);

  const updateField = useCallback((date: string, field: string, value: number | boolean | string, recordedBy: string) => updateFields(date, { [field]: value }, recordedBy), [updateFields]);

  // Save an individual BP reading and update the health_records row with the day's average
  const saveBpReading = useCallback(async (date: string, systolic: number, diastolic: number, recordedBy: string): Promise<boolean> => {
    // Insert individual reading
    const { error: insertErr } = await supabase
      .from('bp_readings' as any)
      .insert({ date, systolic, diastolic, recorded_by: recordedBy } as any);
    if (insertErr) { toast.error('Failed to save BP reading'); console.error(insertErr); return false; }

    const averageWarning = () => {
      toast.warning("BP saved. The day's average will update with the next reading.");
      invalidateBp();
      return true;
    };

    // Fetch all readings for this date to compute average
    const { data: dayReadings, error: readingsError } = await supabase
      .from('bp_readings' as any)
      .select('*')
      .eq('date', date);
    if (readingsError || !dayReadings?.length) return averageWarning();
    const readings = dayReadings as any[];
    const avgSys = Math.round(readings.reduce((s: number, r: any) => s + r.systolic, 0) / readings.length);
    const avgDia = Math.round(readings.reduce((s: number, r: any) => s + r.diastolic, 0) / readings.length);
    if (!Number.isFinite(avgSys) || !Number.isFinite(avgDia)) return averageWarning();

    // Upsert the average into health_records
    const { data: dayRows, error: lookupError } = await supabase
      .from('health_records')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1);
    if (lookupError) { console.error(lookupError); return averageWarning(); }
    const existing = dayRows?.[0];
    if (existing) {
      const { error: writeError } = await supabase
        .from('health_records')
        .update({ bp_systolic: avgSys, bp_diastolic: avgDia, recorded_by: recordedBy } as any)
        .eq('id', existing.id);
      if (writeError) return averageWarning();
    } else {
      const { error: writeError } = await supabase
        .from('health_records')
        .insert({ date, bp_systolic: avgSys, bp_diastolic: avgDia, recorded_by: recordedBy } as any);
      if (writeError) return averageWarning();
    }
    invalidateRecords();
    invalidateBp();
    return true;
  }, [invalidateRecords, invalidateBp]);

  const getBpReadingsForDate = useCallback((date: string) => {
    return bpReadings.filter(r => r.date === date);
  }, [bpReadings]);

  const deleteBpReading = useCallback(async (id: string, date: string): Promise<boolean> => {
    const { error } = await supabase.from('bp_readings' as any).delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); console.error(error); return false; }

    // Recalculate average
    const remaining = bpReadings.filter(r => r.id !== id && r.date === date);
    const { data: dayRows, error: lookupError } = await supabase
      .from('health_records')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(1);
    if (lookupError) { toast.error('Failed to load the day record'); console.error(lookupError); return false; }
    const existing = dayRows?.[0];
    if (existing) {
      if (remaining.length > 0) {
        const avgSys = Math.round(remaining.reduce((s, r) => s + r.systolic, 0) / remaining.length);
        const avgDia = Math.round(remaining.reduce((s, r) => s + r.diastolic, 0) / remaining.length);
        const { error: writeError } = await supabase
          .from('health_records')
          .update({ bp_systolic: avgSys, bp_diastolic: avgDia } as any)
          .eq('id', existing.id);
        if (writeError) { toast.error('Failed to save BP average'); invalidateBp(); return false; }
      } else {
        const { error: writeError } = await supabase
          .from('health_records')
          .update({ bp_systolic: 0, bp_diastolic: 0 } as any)
          .eq('id', existing.id);
        if (writeError) { toast.error('Failed to save BP average'); invalidateBp(); return false; }
      }
    }
    invalidateRecords();
    invalidateBp();
    return true;
  }, [bpReadings, invalidateRecords, invalidateBp]);

  return { records, bpReadings, loading, bpLoading, loadError, addRecord, deleteRecord, getLatestRecord, getRecordByDate, updateField, updateFields, saveBpReading, getBpReadingsForDate, deleteBpReading };
}
