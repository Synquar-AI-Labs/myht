import { useState } from 'react';
import { Phone, MessageSquare } from 'lucide-react';
import { CONTACT_GROUPS, phoneHref, type Contact } from '@/lib/careProfile';
import { useContacts } from '@/hooks/useCareProfile';
import { Button } from '@/components/ui/button';
import { ProfileLoad } from './ProfileParts';
import { ContactSheet, blankContact } from './ContactSheet';

export function ContactsTab() {
  const data = useContacts();
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  if (data.loading || data.error) return <ProfileLoad error={data.error} retry={data.retry} />;
  const phone = (value: string, name: string) => value && <div className="flex flex-none items-center gap-2">
    {phoneHref(value, 'tel') && <><a className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#26201a] text-white" href={phoneHref(value, 'tel')} aria-label={`Call ${name}`}><Phone className="h-5 w-5" /></a><a className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[#e9e2d6]" href={phoneHref(value, 'sms')} aria-label={`Text ${name}`}><MessageSquare className="h-5 w-5" /></a></>}
  </div>;
  return <div className="space-y-5 text-[#26201a]">
    <header className="flex items-center justify-between gap-3"><h1 className="text-[30px] font-normal">Contacts</h1><Button variant="ghost" className="px-0" onClick={() => setEditing('new')}>Add</Button></header>
    {CONTACT_GROUPS.map(group => <section className="space-y-2" key={group.kind}>
      <h2 className="[font-family:inherit] text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>{group.label}</h2>
      <div className="rounded-2xl border border-[#e9e2d6] bg-white px-4">
        {!data.contacts.some(c => c.kind === group.kind) && <p className="py-4 text-sm text-[#8b8175]">Not recorded</p>}
        {data.contacts.filter(c => c.kind === group.kind).map(contact => <article className="flex cursor-pointer items-center gap-2 border-b border-[#f3ede2] py-3 last:border-0" key={contact.id} onClick={() => setEditing(contact)}>
          <button className="min-h-11 min-w-0 flex-1 text-left" aria-label={`Edit ${contact.name}`} onClick={() => setEditing(contact)}>
            <span className="block break-words"><strong className="font-bold">{contact.name}</strong>{contact.role && <> · <span className="text-sm text-[#8b8175]">{contact.role}</span></>}</span>
            <span className="block select-text break-all text-sm text-[#8b8175]">{contact.phone || 'Phone: Not recorded'}</span>
            {contact.phone2 && <span className="block select-text break-all text-sm text-[#8b8175]">{contact.phone2}</span>}
          </button>
          <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>{phone(contact.phone, contact.name)}{phone(contact.phone2, `${contact.name} (other number)`)}</div>
        </article>)}
      </div>
    </section>)}
    {editing && <ContactSheet key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? blankContact : editing} id={editing === 'new' ? undefined : editing.id} onClose={() => setEditing(null)} />}
  </div>;
}
