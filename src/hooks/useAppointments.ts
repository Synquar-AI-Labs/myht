import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Appointment, AppointmentForm } from '@/types/health';
import { toast } from 'sonner';
import { appointmentSchema } from '@/lib/validation';

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = useCallback(async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .order('date', { ascending: true });
    if (error) {
      toast.error('Failed to load appointments');
      console.error(error);
    } else {
      setAppointments(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

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
      await fetchAppointments();
    }
  }, [fetchAppointments]);

  const deleteAppointment = useCallback(async (id: string) => {
    const { error } = await supabase.from('appointments').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      console.error(error);
    } else {
      setAppointments(prev => prev.filter(a => a.id !== id));
    }
  }, []);

  const getUpcoming = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return appointments.filter(a => a.date >= today);
  }, [appointments]);

  return { appointments, loading, addAppointment, deleteAppointment, getUpcoming };
}
