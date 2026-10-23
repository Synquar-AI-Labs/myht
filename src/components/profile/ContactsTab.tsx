import { useCallback, useState } from 'react';
import { Phone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { CONTACT_GROUPS, phoneHref, type Contact } from '@/lib/careProfile';
import { useContacts } from '@/hooks/useCareProfile';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import { useNativeBack } from '@/native/back';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { ProfileLoad, profileDialog } from './ProfileParts';

const blank = { kind: 'emergency', name: '', role: '', phone: '', phone2: '', email: '', address: '', notes: '' };
export function ContactsTab() {
  const data = useContacts();
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useUpdateBusy(busy || editing !== undefined);
  useNativeBack(useCallback(() => {
    if (editing === undefined && !busy) return false;
    toast.info('Save or cancel your changes first.'); return true;
  }, [editing, busy]), 10, true);
  const close = (open: boolean) => { if (!open && !busy) setEditing(undefined); };
  const edit = (contact?: Contact) => {
    setDraft(contact ? { kind: contact.kind, name: contact.name, role: contact.role, phone: contact.phone, phone2: contact.phone2, email: contact.email, address: contact.address, notes: contact.notes } : blank);
    setEditing(contact?.id ?? null);
  };
  if (data.loading || data.error) return <ProfileLoad error={data.error} retry={data.retry} />;
  const phone = (value: string, name: string) => value && <div className="flex flex-wrap items-center gap-2">
    <span className="min-w-0 flex-1 select-text break-all text-sm text-[#8b8175]">{value}</span>
    {phoneHref(value, 'tel') && <><a className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#26201a] text-white" href={phoneHref(value, 'tel')} aria-label={`Call ${name}`}><Phone className="h-5 w-5" /></a><a className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[#e9e2d6]" href={phoneHref(value, 'sms')} aria-label={`Text ${name}`}><MessageSquare className="h-5 w-5" /></a></>}
  </div>;
  return <div className="space-y-5 text-[#26201a]">
    <header className="flex items-center justify-between gap-3"><h1 className="text-[30px] font-normal">Contacts</h1><Button variant="ghost" onClick={() => edit()}>Add</Button></header>
    {CONTACT_GROUPS.map(group => <section className="space-y-2" key={group.kind}>
      <h2 className="[font-family:inherit] text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</h2>
      <div className="rounded-2xl border border-[#e9e2d6] bg-white px-4">
        {!data.contacts.some(c => c.kind === group.kind) && <p className="py-4 text-sm text-[#8b8175]">Not recorded</p>}
        {data.contacts.filter(c => c.kind === group.kind).map(contact => <article className="space-y-2 border-b border-[#f3ede2] py-3 last:border-0" key={contact.id}>
          <div className="flex items-center gap-2"><div className="min-w-0 flex-1 break-words"><h3 className="[font-family:inherit] font-semibold">{contact.name}</h3>{contact.role && <p className="text-sm text-[#8b8175]">{contact.role}</p>}</div><Button variant="ghost" aria-label={`Edit ${contact.name}`} onClick={() => edit(contact)}>Edit</Button></div>
          {phone(contact.phone, contact.name)}{phone(contact.phone2, `${contact.name} (other number)`)}
          {!contact.phone && !contact.phone2 && <p className="text-sm text-[#8b8175]">Phone: Not recorded</p>}
          {[contact.email, contact.address, contact.notes].filter(Boolean).map((text, index) => <p key={index} className="whitespace-pre-wrap break-words text-sm text-[#8b8175]">{text}</p>)}
          <ConfirmDeleteButton variant="ghost" disabled={busy} className="min-h-11 text-sm text-destructive" title="Delete this contact?" description={contact.name} onConfirm={async () => { setBusy(true); try { await data.remove(contact.id); } finally { setBusy(false); } }}>Delete</ConfirmDeleteButton>
        </article>)}
      </div>
    </section>)}
    <Dialog open={editing !== undefined} onOpenChange={close}><DialogContent className={profileDialog} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
      <DialogHeader className="pr-10"><DialogTitle>{editing ? 'Edit contact' : 'Add contact'}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={async e => {
        e.preventDefault(); setBusy(true);
        try { if (await data.save(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()])) as typeof draft, editing ?? undefined)) { setEditing(undefined); toast.success('Contact saved'); } }
        finally { setBusy(false); }
      }}><fieldset disabled={busy} className="space-y-3">
        <div className="space-y-1"><Label htmlFor="contact-kind">Group</Label><select id="contact-kind" className="min-h-11 w-full rounded-md border bg-background px-3 text-base" value={draft.kind} onChange={e => setDraft(p => ({ ...p, kind: e.target.value }))}>{CONTACT_GROUPS.map(g => <option key={g.kind} value={g.kind}>{g.label}</option>)}</select></div>
        {([{ key: 'name', label: 'Name', max: 80 }, { key: 'role', label: 'Role', max: 120 }, { key: 'phone', label: 'Phone', max: 50 }, { key: 'phone2', label: 'Other phone (optional)', max: 50 }, { key: 'email', label: 'Email (optional)', max: 254 }, { key: 'address', label: 'Address (optional)', max: 500 }] as const).map(field => <div className="space-y-1" key={field.key}><Label htmlFor={`contact-${field.key}`}>{field.label}</Label><Input id={`contact-${field.key}`} className="min-h-11" required={field.key === 'name'} type={field.key === 'email' ? 'email' : field.key.startsWith('phone') ? 'tel' : 'text'} maxLength={field.max} value={draft[field.key]} onChange={e => setDraft(p => ({ ...p, [field.key]: e.target.value }))} /></div>)}
        <div className="space-y-1"><Label htmlFor="contact-notes">Note (optional)</Label><Textarea id="contact-notes" maxLength={1000} value={draft.notes} onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))} /></div>
        <div className="flex gap-3"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => close(false)}>Cancel</Button><Button type="submit" className="min-h-11 flex-1" disabled={!draft.name.trim()}>Save</Button></div>
      </fieldset></form>
    </DialogContent></Dialog>
  </div>;
}
