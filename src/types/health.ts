export interface HealthRecord {
  id: string;
  date: string; // YYYY-MM-DD
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
  createdAt: string;
}

export interface Appointment {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  doctorName: string;
  address: string;
  reason: string;
  description: string;
  createdAt: string;
}

export type DateRange = '7' | '30' | 'custom';
