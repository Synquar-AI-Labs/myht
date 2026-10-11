import { Tables } from '@/integrations/supabase/types';

export type HealthRecord = Tables<'health_records'>;
export type Appointment = Tables<'appointments'>;
export type DateRange = '7' | '30' | 'custom';

// Camel-case form shape used by UI components
export interface HealthRecordForm {
  date: string;
  feedBags: number;
  flushCount: number;
  weight: number;
  bpSystolic: number;
  bpDiastolic: number;
  foodTaken: boolean;
  foodDescription: string;
  stoolPassed: boolean;
  stoolCount: number;
  vomiting: boolean;
  vomitCount: number;
  constipation: boolean;
  recordedBy: string;
  caregiverId?: string | null;
  miscNotes: string;
}

export const RECORDER_OPTIONS = ['Umair', 'Shaharyar', 'Affan', 'Fahad', 'Shahwar'] as const;

export const STAY_PEOPLE = ['Fahad', 'Shahwar', 'Umair', 'Affan', 'Azra', 'Nayab', 'Shaheryar'] as const;

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
    flushCount: (r as any).flush_count ?? 0,
    weight: Number(r.weight),
    bpSystolic: r.bp_systolic,
    bpDiastolic: r.bp_diastolic,
    foodTaken: r.food_taken,
    foodDescription: r.food_description ?? '',
    stoolPassed: r.stool_passed,
    stoolCount: r.stool_count,
    vomiting: r.vomiting,
    vomitCount: (r as any).vomit_count ?? 0,
    constipation: r.constipation,
    recordedBy: (r as any).recorded_by ?? '',
    caregiverId: r.caregiver_id,
    miscNotes: (r as any).misc_notes ?? '',
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
