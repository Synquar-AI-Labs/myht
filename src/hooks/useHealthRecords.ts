import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { HealthRecord, HealthRecordForm } from '@/types/health';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { healthRecordSchema } from '@/lib/validation';
import { changedDayFields } from '@/lib/dayRecord';
import { readingArgs } from '@/lib/readingArgs';
import { fetchAllRows } from '@/lib/fetchAll';
import { useHousehold } from '@/hooks/HouseholdProvider';

type BpReading = Tables<'bp_readings'>;
export const healthKeys = {
  records: (id?: string) => ['household', id, 'health_records'] as const,
  bp: (id?: string) => ['household', id, 'bp_readings'] as const,
};

export function useHealthRecords() {
  const queryClient = useQueryClient();
  const { householdId, caregivers } = useHousehold();

  const { data: records = [], isLoading: loading, isError: recordsError } = useQuery({
    queryKey: healthKeys.records(householdId), enabled: !!householdId,
    queryFn: () => fetchAllRows<HealthRecord>((from, to) => supabase
      .from('health_records').select('*', { count: 'exact' })
      .eq('household_id', householdId!)
      .order('date', { ascending: false }).order('created_at', { ascending: true })
      .order('id', { ascending: true }).range(from, to)),
  });
  const { data: bpReadings = [], isLoading: bpLoading, isError: bpError } = useQuery({
    queryKey: healthKeys.bp(householdId), enabled: !!householdId,
    queryFn: () => fetchAllRows<BpReading>((from, to) => supabase
      .from('bp_readings').select('*', { count: 'exact' })
      .eq('household_id', householdId!)
      .order('created_at', { ascending: true }).order('id', { ascending: true }).range(from, to)),
  });
  const invalidateRecords = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: healthKeys.records(householdId) });
  }, [queryClient, householdId]);
  const invalidateBp = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: healthKeys.bp(householdId) });
  }, [queryClient, householdId]);

  const addRecord = useCallback(async (form: HealthRecordForm, baseline: HealthRecordForm): Promise<boolean> => {
    if (!householdId) return false;
    const parsed = healthRecordSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0]?.message || 'Invalid input'); return false; }
    let fields;
    try { fields = changedDayFields(form, baseline, caregivers); }
    catch { toast.error('Choose a person in this family'); return false; }
    if (!Object.keys(fields).length) { toast.info('Nothing changed'); return false; }
    const write: TablesInsert<'health_records'> = { household_id: householdId, date: form.date, ...fields };
    const { error } = await supabase.from('health_records').upsert(write, { onConflict: 'household_id,date' });
    if (error) { toast.error('Failed to save record'); console.error(error); return false; }
    invalidateRecords();
    return true;
  }, [householdId, caregivers, invalidateRecords]);

  const deleteRecord = useCallback(async (id: string): Promise<boolean> => {
    if (!householdId) return false;
    const { error } = await supabase.from('health_records').delete().eq('household_id', householdId).eq('id', id);
    if (error) { toast.error('Failed to delete'); console.error(error); return false; }
    invalidateRecords(); return true;
  }, [householdId, invalidateRecords]);

  const updateFields = useCallback(async (date: string, fields: Record<string, number | boolean | string>, caregiverId: string): Promise<boolean> => {
    const person = caregivers.find(p => p.is_active && p.caregiver_id === caregiverId);
    if (!householdId || !person || !Object.keys(fields).length) return false;
    let args;
    try { args = readingArgs(householdId, date, fields, person.caregiver_id, person.display_name); }
    catch { toast.error('Invalid reading'); return false; }
    const { error } = await supabase.rpc('log_reading', args);
    if (error) { toast.error('Failed to save reading'); console.error(error); return false; }
    invalidateRecords(); return true;
  }, [householdId, caregivers, invalidateRecords]);
  const updateField = useCallback((date: string, field: string, value: number | boolean | string, caregiverId: string) => updateFields(date, { [field]: value }, caregiverId), [updateFields]);

  const saveBpReading = useCallback(async (date: string, systolic: number, diastolic: number, caregiverId: string): Promise<boolean> => {
    const person = caregivers.find(p => p.is_active && p.caregiver_id === caregiverId);
    if (!householdId || !person) return false;
    const { error } = await supabase.rpc('log_bp_reading', {
      p_household_id: householdId, p_date: date, p_systolic: systolic, p_diastolic: diastolic,
      p_caregiver_id: person.caregiver_id, p_recorded_by: person.display_name,
    });
    if (error) { toast.error('Failed to save BP reading'); console.error(error); return false; }
    invalidateRecords(); invalidateBp(); return true;
  }, [householdId, caregivers, invalidateRecords, invalidateBp]);

  const getLatestRecord = useCallback(() => records[0] ?? null, [records]);
  const getRecordByDate = useCallback((date: string) => records.find(r => r.date === date) ?? null, [records]);
  const getBpReadingsForDate = useCallback((date: string) => bpReadings.filter(r => r.date === date), [bpReadings]);
  return { records, bpReadings, loading, bpLoading, loadError: recordsError || bpError, addRecord, deleteRecord, getLatestRecord, getRecordByDate, updateField, updateFields, saveBpReading, getBpReadingsForDate };
}
