import { useCallback, useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import type { Appointment, AppointmentForm } from '@/types/health';
import { appointmentSuggestions, appointmentContactOffers, type AppointmentSuggestion, type ContactOffer } from '@/lib/appointmentSuggestions';
import { useContacts } from '@/hooks/useCareProfile';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import { useNativeBack } from '@/native/back';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ContactSheet, blankContact } from '@/components/profile/ContactSheet';
import { profileDialog } from '@/components/profile/ProfileParts';
import type { Contact } from '@/lib/careProfile';
import { Anchor as PopoverAnchor } from '@radix-ui/react-popover';
import { Popover, PopoverContent } from '@/components/ui/popover';

function AppointmentPicker({ label, value, field, contacts, appointments, onChange, onPick }: {
  label:string;value:string;field:'doctor'|'where';contacts:Contact[];appointments:Appointment[];
  onChange:(value:string)=>void;onPick:(row:AppointmentSuggestion)=>void;
}) {
  const id=useId(), [open,setOpen]=useState(false), [active,setActive]=useState(-1);
  const rows=appointmentSuggestions(field,value,contacts,appointments);
  const showList=open&&rows.length>0;
  useEffect(()=>{
    if(showList&&active>=0)document.getElementById(`${id}-${active}`)?.scrollIntoView({block:'nearest'});
  },[showList,active,id]);
  const choose=(row:AppointmentSuggestion)=>{onPick(row);setOpen(false);setActive(-1);};
  return <Popover open={showList} onOpenChange={setOpen}><div className="min-w-0 space-y-1">
    <Label htmlFor={id}>{label}</Label>
    <PopoverAnchor asChild><Input id={id} role="combobox" aria-autocomplete="list" aria-expanded={showList} aria-controls={`${id}-list`} aria-activedescendant={showList&&active>=0?`${id}-${active}`:undefined}
      autoComplete="off" placeholder={field==='doctor'?'Dr. Smith':'Clinic address'} maxLength={field==='doctor'?100:500} value={value}
      onFocus={()=>setOpen(true)} onClick={()=>setOpen(true)} onChange={e=>{onChange(e.target.value);setOpen(true);setActive(-1);}}
      onKeyDown={e=>{
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(index=>Math.max(0,Math.min(rows.length-1,index+(e.key==='ArrowDown'?1:-1))));}
        else if(e.key==='Enter'&&open&&active>=0&&rows[active]){e.preventDefault();choose(rows[active]);}
        else if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();setOpen(false);}
      }}/></PopoverAnchor>
    <PopoverContent id={`${id}-list`} role="listbox" aria-label={`${label} suggestions`} align="start" className="w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1" style={{maxHeight:'min(12rem, var(--radix-popover-content-available-height))'}}
      onOpenAutoFocus={e=>e.preventDefault()} onCloseAutoFocus={e=>e.preventDefault()} onInteractOutside={e=>{if(e.target===document.getElementById(id))e.preventDefault();}}>
      {rows.map((row,index)=><button type="button" role="option" id={`${id}-${index}`} aria-selected={active===index} key={`${row.source}:${row.value}`} className={`min-h-11 w-full break-words rounded px-2 py-2 text-left text-sm ${active===index?'bg-[#f3ede2]':''}`} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(row)}>{row.label}</button>)}
    </PopoverContent>
  </div></Popover>;
}

export function AppointmentDialog({ open, onOpenChange, initialDate, appointments, onSave, title='New Appointment' }: {
  open:boolean;onOpenChange:(open:boolean)=>void;initialDate:string;appointments:Appointment[];onSave:(form:AppointmentForm)=>Promise<boolean>;title?:string;
}) {
  const contacts=useContacts();
  const blank=():AppointmentForm=>({date:initialDate,time:'09:00',doctorName:'',address:'',reason:'',description:''});
  const [form,setForm]=useState<AppointmentForm>(blank);
  const [typed,setTyped]=useState({doctor:false,where:false});
  const [busy,setBusy]=useState(false);
  const [offers,setOffers]=useState<ContactOffer[]>([]);
  const [adding,setAdding]=useState<ContactOffer|null>(null);
  const [wasOpen,setWasOpen]=useState(open);
  // A new visit starts on the selected day. A refresh never replaces typed input.
  if(open!==wasOpen){setWasOpen(open);if(open){setForm(blank());setTyped({doctor:false,where:false});}}
  useUpdateBusy(open||busy||!!offers.length||!!adding);
  useNativeBack(useCallback(()=>{
    if(!open&&!busy&&!adding&&offers.length){setOffers(previous=>previous.slice(1));return true;}
    if(!open&&!busy&&!offers.length&&!adding)return false;
    toast.info('Save or cancel your changes first.');return true;
  },[open,busy,offers.length,adding]),10,true);
  const nextOffer=()=>{setAdding(null);setOffers(previous=>previous.slice(1));};
  return <>
    <Dialog open={open} onOpenChange={value=>{if(!busy)onOpenChange(value);}}><DialogContent className={`${profileDialog} max-w-sm`} onEscapeKeyDown={e=>{if(busy||(e.target instanceof Element&&e.target.getAttribute('role')==='combobox'&&e.target.getAttribute('aria-expanded')==='true'))e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}}>
      <DialogHeader className="pr-8"><DialogTitle>{title}</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={async e=>{
        e.preventDefault();if(!form.doctorName.trim()||!form.reason.trim())return;
        setBusy(true);
        try{if(await onSave(form)){
          const candidates=contacts.loading||contacts.error?[]:appointmentContactOffers(form,contacts.contacts,typed);
          onOpenChange(false);setForm(blank());setOffers(candidates);toast.success('Appointment added');
        }}catch{toast.error('Could not save appointment. Try again.');}finally{setBusy(false);}
      }}><fieldset disabled={busy} className="min-w-0 space-y-3">
        <div className="grid min-w-0 grid-cols-2 gap-3"><div className="min-w-0 space-y-1"><Label htmlFor="appointment-date">Date</Label><Input className="min-w-0 max-w-full" id="appointment-date" type="date" required value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div><div className="min-w-0 space-y-1"><Label htmlFor="appointment-time">Time</Label><Input className="min-w-0 max-w-full" id="appointment-time" type="time" required value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}/></div></div>
        {contacts.error&&<p role="alert" className="text-xs text-muted-foreground">Contacts could not load. You can still type the details. <Button type="button" variant="ghost" onClick={contacts.retry}>Try again</Button></p>}
        <AppointmentPicker label="Doctor Name" field="doctor" value={form.doctorName} contacts={contacts.contacts} appointments={appointments}
          onChange={value=>{setForm(p=>({...p,doctorName:value}));setTyped(p=>({...p,doctor:true}));}}
          onPick={row=>{const fillAddress=!form.address.trim()&&row.source==='contact';setForm(p=>({...p,doctorName:row.value,address:fillAddress?row.address||'':p.address}));setTyped(p=>({...p,doctor:row.source==='typed',where:fillAddress?false:p.where}));}}/>
        <AppointmentPicker label="Where" field="where" value={form.address} contacts={contacts.contacts} appointments={appointments}
          onChange={value=>{setForm(p=>({...p,address:value}));setTyped(p=>({...p,where:true}));}}
          onPick={row=>{setForm(p=>({...p,address:row.value}));setTyped(p=>({...p,where:row.source==='typed'}));}}/>
        <div className="space-y-1"><Label htmlFor="appointment-reason">Reason</Label><Input id="appointment-reason" required placeholder="Check-up, follow-up..." maxLength={200} value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))}/></div>
        <div className="space-y-1"><Label htmlFor="appointment-notes">Notes (optional)</Label><Textarea id="appointment-notes" maxLength={500} value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></div>
        <Button type="submit" className="w-full" disabled={!form.doctorName.trim()||!form.reason.trim()}>Save Appointment</Button>
      </fieldset></form>
    </DialogContent></Dialog>
    <Dialog open={!!offers.length&&!adding} onOpenChange={value=>{if(!value)nextOffer();}}><DialogContent className={`${profileDialog} max-w-sm`}><DialogHeader className="pr-10"><DialogTitle className="break-words">Add {offers[0]?.name} to Contacts?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">The appointment is saved.</p><div className="flex gap-3"><Button variant="outline" className="flex-1" onClick={nextOffer}>Not now</Button><Button className="flex-1" onClick={()=>setAdding(offers[0])}>Add</Button></div></DialogContent></Dialog>
    {adding&&<ContactSheet initial={{...blankContact,...adding}} onClose={nextOffer}/>}
  </>;
}
