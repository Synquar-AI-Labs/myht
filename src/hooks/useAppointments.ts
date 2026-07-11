import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Appointment, AppointmentForm } from '@/types/health';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { appointmentSchema } from '@/lib/validation';

export function useAppointments() {
  const queryClient = useQueryClient();

  const { data: appointments = [], isLoading: loading } = useQuery({
    queryKey: ['appointments'],
    queryFn: async (): Promise<Appointment[]> => {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
  }, [queryClient]);

  const addAppointment = useCallback(async (form: AppointmentForm) => {
    const parsed = appointmentSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message || 'Invalid input');
      return;
    }
    const { error } = await supabase.from('appointments').insert({
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
    } else {
      invalidate();
    }
  }, [invalidate]);

  const deleteAppointment = useCallback(async (id: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      console.error(error);
    } else {
      invalidate();
    }
  }, [invalidate]);

  const getUpcoming = useCallback(() => {
    // Use local calendar date (not UTC) so "today" matches the caregiver's day.
    const today = format(new Date(), 'yyyy-MM-dd');
    return appointments.filter(a => a.date >= today);
  }, [appointments]);

  return { appointments, loading, addAppointment, deleteAppointment, getUpcoming };
}
