import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Appointment, AppointmentForm } from '@/types/health';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { appointmentSchema } from '@/lib/validation';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { domainKeys } from '@/lib/domainKeys';
import { fetchAllRows } from '@/lib/fetchAll';

export function useAppointments() {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  const { data: appointments = [], isLoading: loading } = useQuery({
    queryKey: domainKeys.appointments(householdId),
    enabled: !!householdId,
    queryFn: async (): Promise<Appointment[]> => {
      return fetchAllRows<Appointment>((from, to) => supabase
        .from('appointments')
        .select('*', { count: 'exact' })
        .eq('household_id', householdId!)
        .order('date', { ascending: true }).order('id')
        .range(from, to));
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: domainKeys.appointments(householdId) });
  }, [queryClient, householdId]);

  const addAppointment = useCallback(async (form: AppointmentForm): Promise<boolean> => {
    if (!householdId) return false;
    const parsed = appointmentSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return false;
    }
    const { error } = await supabase.from('appointments').insert({
      household_id: householdId,
      date: form.date,
      time: form.time,
      doctor_name: form.doctorName,
      address: form.address,
      reason: form.reason,
      description: form.description,
    });
    if (error) {
      toast.error('Failed to save appointment');
      console.error(error);
      return false;
    } else {
      invalidate();
      return true;
    }
  }, [invalidate, householdId]);

  const deleteAppointment = useCallback(async (id: string): Promise<boolean> => {
    if (!householdId) return false;
    const { error } = await supabase.from('appointments').delete().eq('household_id', householdId).eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      console.error(error);
      return false;
    } else {
      invalidate();
      return true;
    }
  }, [invalidate, householdId]);

  const getUpcoming = useCallback(() => {
    // Use local calendar date (not UTC) so "today" matches the caregiver's day.
    const today = format(new Date(), 'yyyy-MM-dd');
    return appointments.filter(a => a.date >= today);
  }, [appointments]);

  return { appointments, loading, addAppointment, deleteAppointment, getUpcoming };
}
