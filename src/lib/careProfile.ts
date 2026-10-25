import { differenceInYears, format, isValid, parseISO } from 'date-fns';
import type { Tables } from '@/integrations/supabase/types';

export const ALERT_KINDS = ['allergy', 'contagious', 'disability', 'condition', 'diet'] as const;
export type AlertKind = typeof ALERT_KINDS[number];
export type CareProfile = Tables<'care_profiles'>;
export type CareAlert = Tables<'care_alerts'>;
export type Contact = Tables<'contacts'>;
export const ALERT_LABELS: Record<AlertKind, string> = { allergy: 'Allergies', contagious: 'Contagious disease', condition: 'Current conditions', disability: 'Disabilities', diet: 'Diet cautions' };
export const CONTACT_GROUPS = [{ kind: 'emergency', label: 'Emergency', color: '#b42318' }, { kind: 'doctor', label: 'Doctors', color: '#4f6bd6' }, { kind: 'caretaker', label: 'Caretakers', color: '#0f766e' }, { kind: 'hospital', label: 'Hospitals & clinics', color: '#8b5cf6' }, { kind: 'other', label: 'Pharmacy and other', color: '#8b8175' }] as const;

export function ageOn(birth: string | null | undefined, now = new Date()): number | null {
  if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
  const date = parseISO(birth);
  if (!isValid(date) || format(date, 'yyyy-MM-dd') !== birth || date > now) return null;
  return differenceInYears(now, date);
}
export function ageLabel(birth?: string | null, now = new Date()) {
  const age = ageOn(birth, now);
  return age === null ? 'Date of birth: Not recorded' : `${age} years · born ${format(parseISO(birth!), 'MMM d, yyyy')}`;
}
export function alertValue(kind: AlertKind, profile: CareProfile | null, alerts: CareAlert[]) {
  const entries = alerts.filter(a => a.kind === kind);
  if (entries.length) return entries.map(a => [a.text, a.note].filter(Boolean).join(' — ')).join(' · ');
  return profile?.none_known.includes(kind) ? 'None known' : 'Not recorded';
}
export function fallRiskValue(profile: CareProfile | null) {
  if (profile?.fall_risk == null) return 'Not recorded';
  return [profile.fall_risk ? 'Yes' : 'No', profile.fall_risk_note].filter(Boolean).join(' · ');
}
export function alertLine(profile: CareProfile | null, alerts: CareAlert[]) {
  const entries = (kind: AlertKind) => alerts.filter(a => a.kind === kind).map(a => `${a.text}${a.note ? ` — ${a.note}` : ''}`).join(', ');
  const lines: string[] = [];
  const allergies = entries('allergy');
  if (allergies) lines.push(`Allergic to ${allergies}`);
  if (profile?.fall_risk) lines.push(`Fall risk: ${profile.fall_risk_note || 'Yes'}`);
  const contagious = entries('contagious');
  if (contagious) lines.push(`Contagious: ${contagious}`);
  return { lines, full: lines.join(' · ') };
}
export function cardReadiness(parts: { loading: boolean; error: boolean }[]): 'failed' | 'loading' | 'ready' {
  if (parts.some(p => p.error)) return 'failed';
  return parts.some(p => p.loading) ? 'loading' : 'ready';
}
export function phoneHref(phone: string, scheme: 'tel' | 'sms') {
  // Never concatenate an extension or other free text into a different number.
  // The original remains visible/copyable when it cannot be dialled safely.
  if (/[^\d+*#().\s-]/.test(phone)) return undefined;
  const number = phone.replace(/[^\d+*#]/g, '');
  return /\d/.test(number) ? `${scheme}:${number.replace(/#/g, '%23')}` : undefined;
}
