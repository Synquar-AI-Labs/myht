import { useState, useEffect, useCallback } from 'react';
import { Appointment } from '@/types/health';

const STORAGE_KEY = 'appointments';

function loadAppointments(): Appointment[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAppointments(appointments: Appointment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
}

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>(loadAppointments);

  useEffect(() => {
    saveAppointments(appointments);
  }, [appointments]);

  const addAppointment = useCallback((appt: Omit<Appointment, 'id' | 'createdAt'>) => {
    const newAppt: Appointment = {
      ...appt,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setAppointments(prev => [...prev, newAppt].sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date);
      return dateComp !== 0 ? dateComp : a.time.localeCompare(b.time);
    }));
  }, []);

  const updateAppointment = useCallback((id: string, updates: Partial<Appointment>) => {
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  }, []);

  const deleteAppointment = useCallback((id: string) => {
    setAppointments(prev => prev.filter(a => a.id !== id));
  }, []);

  const getAppointmentsForDate = useCallback((date: string) => {
    return appointments.filter(a => a.date === date);
  }, [appointments]);

  const getUpcoming = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return appointments.filter(a => a.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  }, [appointments]);

  return { appointments, addAppointment, updateAppointment, deleteAppointment, getAppointmentsForDate, getUpcoming };
}
