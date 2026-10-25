import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { CONTACT_GROUPS } from '@/lib/careProfile';
import { useContacts } from '@/hooks/useCareProfile';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import { useNativeBack } from '@/native/back';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { profileDialog } from './ProfileParts';

export const blankContact = { kind:'emergency', name:'', role:'', phone:'', phone2:'', email:'', address:'', notes:'' };
export function ContactSheet({ initial, id, onClose }: { initial: typeof blankContact; id?: string; onClose: () => void }) {
  const data=useContacts();
  const [draft,setDraft]=useState(()=>({kind:initial.kind,name:initial.name,role:initial.role,phone:initial.phone,phone2:initial.phone2,email:initial.email,address:initial.address,notes:initial.notes}));
  const [busy,setBusy]=useState(false);
  useUpdateBusy(true);
  useNativeBack(useCallback(()=>{toast.info('Save or cancel your changes first.');return true;},[]),10,true);
  const close=()=>{if(!busy)onClose();};
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className={profileDialog} onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}}>
    <DialogHeader className="pr-10"><DialogTitle>{id?'Edit contact':'Add contact'}</DialogTitle></DialogHeader>
    <form className="space-y-4" onSubmit={async e=>{
      e.preventDefault();setBusy(true);
      try{if(await data.save(Object.fromEntries(Object.entries(draft).map(([key,value])=>[key,value.trim()])) as typeof draft,id)){toast.success('Contact saved');onClose();}}
      finally{setBusy(false);}
    }}><fieldset disabled={busy} className="space-y-3">
      <div className="space-y-1"><Label htmlFor="contact-kind">Group</Label><select id="contact-kind" className="min-h-11 w-full rounded-md border bg-background px-3 text-base" value={draft.kind} onChange={e=>setDraft(p=>({...p,kind:e.target.value}))}>{CONTACT_GROUPS.map(group=><option key={group.kind} value={group.kind}>{group.label}</option>)}</select></div>
      {([{key:'name',label:'Name',max:80},{key:'role',label:'Role',max:120},{key:'phone',label:'Phone',max:50},{key:'phone2',label:'Other phone (optional)',max:50},{key:'email',label:'Email (optional)',max:254},{key:'address',label:'Address (optional)',max:500}] as const).map(field=><div className="space-y-1" key={field.key}><Label htmlFor={`contact-${field.key}`}>{field.label}</Label><Input id={`contact-${field.key}`} className="min-h-11" required={field.key==='name'} type={field.key==='email'?'email':field.key.startsWith('phone')?'tel':'text'} maxLength={field.max} value={draft[field.key]} onChange={e=>setDraft(p=>({...p,[field.key]:e.target.value}))}/></div>)}
      {draft.name.trim().length>80&&<p role="alert" className="text-sm text-destructive">Use 80 characters or fewer for the contact's name.</p>}
      <div className="space-y-1"><Label htmlFor="contact-notes">Note (optional)</Label><Textarea id="contact-notes" maxLength={1000} value={draft.notes} onChange={e=>setDraft(p=>({...p,notes:e.target.value}))}/></div>
      <div className="flex gap-3"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={close}>Cancel</Button><Button type="submit" className="min-h-11 flex-1" disabled={!draft.name.trim()||draft.name.trim().length>80}>Save</Button></div>
    </fieldset></form>
    {id&&<ConfirmDeleteButton variant="ghost" disabled={busy} className="min-h-11 justify-start px-0 text-sm text-destructive" title="Delete this contact?" description={draft.name} onConfirm={async()=>{setBusy(true);try{if(await data.remove(id))onClose();}finally{setBusy(false);}}}>Delete</ConfirmDeleteButton>}
  </DialogContent></Dialog>;
}
