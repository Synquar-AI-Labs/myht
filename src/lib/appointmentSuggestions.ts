import type { Contact } from './careProfile';
import type { Appointment, AppointmentForm } from '@/types/health';
import { format } from 'date-fns';

export const contactKey = (value: string) => value.trim().replace(/\s+/g,' ').toLowerCase();
export type AppointmentSuggestion = { value: string; label: string; source: 'contact' | 'past' | 'typed'; address?: string };
type AppointmentHistory = Pick<Appointment,'id'|'date'|'doctor_name'> & { address: string | null };
export function appointmentSuggestions(field: 'doctor' | 'where', text: string, contacts: Contact[], appointments: AppointmentHistory[], today = format(new Date(),'yyyy-MM-dd')) {
  const seen = new Set<string>();
  const list: AppointmentSuggestion[] = [];
  const add = (row: AppointmentSuggestion) => {
    const key = contactKey(row.value);
    if (!key || seen.has(key)) return;
    seen.add(key);list.push(row);
  };
  contacts.filter(c => c.kind === (field === 'doctor' ? 'doctor' : 'hospital')).forEach(c => add({
    value: field === 'doctor' ? c.name : c.address || c.name,
    label: [c.name, field === 'doctor' ? c.role : c.address !== c.name ? c.address : ''].filter(Boolean).join(' · '),
    source:'contact', address:c.address,
  }));
  appointments.filter(a => a.date <= today).slice().sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id)).forEach(a => {
    const value = (field === 'doctor' ? a.doctor_name : a.address) ?? '';
    add({value,label:value,source:'past'});
  });
  const needle = contactKey(text);
  const matches = list.filter(row => contactKey(row.label).includes(needle) || contactKey(row.value).includes(needle));
  if (text.trim()) matches.push({value:text.trim(),label:`Use '${text.trim()}'`,source:'typed'});
  return matches;
}
export type ContactOffer = { kind: 'doctor' | 'hospital'; name: string; address: string };
export function appointmentContactOffers(form: AppointmentForm, contacts: Contact[], typed: { doctor: boolean; where: boolean }): ContactOffer[] {
  const offers: ContactOffer[]=[];
  if (typed.doctor && form.doctorName.trim() && !contacts.some(c => c.kind==='doctor' && contactKey(c.name)===contactKey(form.doctorName))) offers.push({kind:'doctor',name:form.doctorName.trim(),address:form.address.trim()});
  if (typed.where && form.address.trim() && !contacts.some(c => c.kind==='hospital' && [c.name,c.address].some(value=>contactKey(value)===contactKey(form.address)))) offers.push({kind:'hospital',name:form.address.trim(),address:form.address.trim()});
  return offers;
}
