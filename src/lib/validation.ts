import { z } from 'zod';

export const appointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
  doctorName: z.string().trim().min(1, 'Doctor name is required').max(100, 'Doctor name too long'),
  address: z.string().max(300, 'Address too long').default(''),
  reason: z.string().trim().min(1, 'Reason is required').max(200, 'Reason too long'),
  description: z.string().max(500, 'Description too long').default(''),
});

export const healthRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  feedBags: z.number().int().min(0).max(100),
  flushCount: z.number().int().min(0).max(100),
  weight: z.number().min(0).max(500),
  bpSystolic: z.number().int().min(0).max(400),
  bpDiastolic: z.number().int().min(0).max(400),
  foodTaken: z.boolean(),
  foodDescription: z.string().max(500, 'Description too long').default(''),
  stoolPassed: z.boolean(),
  stoolCount: z.number().int().min(0).max(100),
  vomiting: z.boolean(),
  vomitCount: z.number().int().min(0).max(100),
  constipation: z.boolean(),
  recordedBy: z.string().trim().min(1, 'Recorder is required').max(50, 'Name too long'),
  miscNotes: z.string().max(1000, 'Notes too long').default(''),
});

export const medicineSchema = z.object({
  name: z.string().trim().min(1, 'Medicine name required').max(200, 'Name too long'),
  schedule_note: z.string().max(500, 'Schedule note too long').default(''),
});

export const medicineLogSchema = z.object({
  medicine_id: z.string().uuid('Invalid medicine ID'),
  hour: z.number().int().min(1, 'Hour must be 1-12').max(12, 'Hour must be 1-12'),
  am_pm: z.enum(['AM', 'PM'], { errorMap: () => ({ message: 'Must be AM or PM' }) }),
  recorded_by: z.string().trim().min(1, 'Recorder required').max(50, 'Name too long'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
});
