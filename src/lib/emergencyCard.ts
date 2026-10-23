import { ageLabel, alertValue, fallRiskValue, type CareProfile, type CareAlert, type Contact } from './careProfile';
import type { Medicine } from '@/hooks/useMedicines';

/** One content model for the screen and PDF: unknown never becomes a negative. */
export function emergencyCardRows(profile: CareProfile | null, alerts: CareAlert[], medicines: Medicine[], contacts: Contact[]) {
  const contactRows = contacts.filter(c => c.kind === 'emergency' || c.kind === 'doctor');
  return {
    age: ageLabel(profile?.date_of_birth),
    facts: [
      ['Allergies', alertValue('allergy', profile, alerts)], ['Fall risk', fallRiskValue(profile)],
      ['Contagious', alertValue('contagious', profile, alerts)], ['Conditions', alertValue('condition', profile, alerts)],
      ['Disabilities', alertValue('disability', profile, alerts)], ['Diet cautions', alertValue('diet', profile, alerts)],
    ],
    medicines: medicines.filter(m => !m.category || m.category === 'medicine').map(m => [m.name, [m.potency, m.amount].filter(Boolean).join(' · ') || 'Dose: Not recorded', [m.schedule_time, m.frequency].filter(Boolean).join(' · ') || 'Times: Not recorded']),
    contacts: [...contactRows.filter(c => c.kind === 'emergency'), ...contactRows.filter(c => c.kind === 'doctor')].map(c => [c.name, c.role, [c.phone, c.phone2].filter(Boolean).join(' / ') || 'Phone: Not recorded']),
    notes: profile?.emergency_notes || 'Not recorded',
  };
}
