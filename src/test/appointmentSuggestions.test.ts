import { expect,it } from 'vitest';
import { appointmentSuggestions,appointmentContactOffers } from '@/lib/appointmentSuggestions';
import type { Contact } from '@/lib/careProfile';
import type { Appointment } from '@/types/health';
const contacts=[{id:'doctor',kind:'doctor',name:'Dr. Sample',role:'Family doctor',address:'123 Sample Street'},{id:'clinic',kind:'hospital',name:'Sample Clinic',address:'456 Sample Road'}] as Contact[];
const appointments=[{id:'1',date:'2026-10-24',doctor_name:' dr. SAMPLE ',address:'456 sample road'},{id:'2',date:'2026-10-23',doctor_name:'Previous doctor',address:'Old clinic'},{id:'3',date:'2026-10-22',doctor_name:'PREVIOUS DOCTOR',address:'old CLINIC'},{id:'4',date:'2026-11-01',doctor_name:'Future doctor',address:'Future clinic'}] as Appointment[];
it('lists contacts first, deduplicates past names ignoring case/space, then offers typed text',()=>{
  const rows=appointmentSuggestions('doctor','',contacts,appointments,'2026-10-25');
  expect(rows.map(r=>r.label)).toEqual(['Dr. Sample · Family doctor','Previous doctor']);
  expect(appointmentSuggestions('doctor','PREV',contacts,appointments,'2026-10-25').map(r=>r.label)).toEqual(['Previous doctor',"Use 'PREV'"]);
});
it('filters contact roles and hospital names, preserving their usable addresses',()=>{
  expect(appointmentSuggestions('doctor','family',contacts,appointments)[0].address).toBe('123 Sample Street');
  const rows=appointmentSuggestions('where','',contacts,appointments,'2026-10-25');
  expect(rows.map(r=>r.label)).toEqual(['Sample Clinic · 456 Sample Road','Old clinic']);
  expect(appointmentSuggestions('where','sample clinic',contacts,appointments)[0].value).toBe('456 Sample Road');
});
it('offers only newly typed noncontacts, never duplicate contacts or picked history',()=>{
  const form={date:'2026-10-25',time:'09:00',doctorName:'Dr. New',address:'New Clinic',reason:'Check',description:''};
  expect(appointmentContactOffers(form,contacts,{doctor:true,where:true}).map(r=>r.kind)).toEqual(['doctor','hospital']);
  expect(appointmentContactOffers(form,contacts,{doctor:false,where:false})).toEqual([]);
  expect(appointmentContactOffers({...form,doctorName:' dr. SAMPLE ',address:'SAMPLE CLINIC'},contacts,{doctor:true,where:true})).toEqual([]);
});
it('keeps doctors with nullable legacy addresses without offering an empty place',()=>{
  const history=[{id:'null-place',date:'2026-10-20',doctor_name:'No-address doctor',address:null}];
  expect(appointmentSuggestions('where','',contacts,history,'2026-10-25').map(row=>row.value)).toEqual(['456 Sample Road']);
  expect(appointmentSuggestions('doctor','no-address',contacts,history,'2026-10-25')[0].value).toBe('No-address doctor');
});
