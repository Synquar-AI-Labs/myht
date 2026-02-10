import { Tables } from '@/integrations/supabase/types';

export type HealthRecord = Tables<'health_records'>;
export type Appointment = Tables<'appointments'>;
export type ReminderSettings = Tables<'reminder_settings'>;
export type DateRange = '7' | '30' | 'custom';

// Camel-case form shape used by UI components
export interface HealthRecordForm {
  date: string;
  feedBags: number;
  weight: number;
  bpSystolic: number;
  bpDiastolic: number;
  foodTaken: boolean;
  foodDescription: string;
  stoolPassed: boolean;
  stoolCount: number;
  vomiting: boolean;
  constipation: boolean;
}

export interface AppointmentForm {
  date: string;
  time: string;
  doctorName: string;
  address: string;
  reason: string;
  description: string;
}

// Map DB row to UI form shape
export function dbToHealthForm(r: HealthRecord): HealthRecordForm {
  return {
    date: r.date,
    feedBags: r.feed_bags,
    weight: Number(r.weight),
    bpSystolic: r.bp_systolic,
    bpDiastolic: r.bp_diastolic,
    foodTaken: r.food_taken,
    foodDescription: r.food_description ?? '',
    stoolPassed: r.stool_passed,
    stoolCount: r.stool_count,
    vomiting: r.vomiting,
    constipation: r.constipation,
  };
}

export function dbToAppointmentForm(a: Appointment): AppointmentForm {
  return {
    date: a.date,
    time: a.time,
    doctorName: a.doctor_name,
    address: a.address ?? '',
    reason: a.reason,
    description: a.description ?? '',
  };
}
