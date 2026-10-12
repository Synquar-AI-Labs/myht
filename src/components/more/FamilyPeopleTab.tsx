import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { useFamilyInvites } from '@/hooks/useFamilyInvites';
import { supabase } from '@/integrations/supabase/client';
import { accountError } from '@/lib/accountSetup';
import { familyInviteMessage } from '@/lib/familyInvite';
import { domainKeys } from '@/lib/domainKeys';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';

export function FamilyPeopleTab() {
  const { householdId, caregivers, role, user, refresh } = useHousehold();
  const invites = useFamilyInvites();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [target, setTarget] = useState<string | undefined>();
  const inviteForm = useRef<HTMLFormElement>(null);
  const inviteEmail = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shareText, setShareText] = useState('');
  useUpdateBusy(busy || !!email || !!name || !!target);
  const admin = role === 'admin';
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await action();
      await refresh();
      await queryClient.invalidateQueries({ queryKey: domainKeys.invites(householdId) });
    } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
  };
  const share = async (address: string) => {
    const text = familyInviteMessage(address, window.location.origin);
    try {
      if (navigator.share) await navigator.share({ title: 'Join our family', text });
      else setShareText(text);
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setShareText(text); }
  };
  const card = 'rounded-2xl border border-[#e9e2d6] bg-white p-4';
  return <section className="space-y-4">
    <h1 className="text-[26px] font-normal text-[#26201a]">Family &amp; people</h1>
    {!admin && <p className="text-sm text-muted-foreground">Only the family admin can add or remove people.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="space-y-2">
      {caregivers.map(person => <div className={card} key={person.caregiver_id}>
        <p className="font-semibold break-words">{person.display_name}{!person.is_active && <span className="ml-2 text-sm font-normal text-muted-foreground">Inactive</span>}</p>
        {person.user_id && <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{person.email} · {person.role === 'admin' ? 'Admin' : person.role === 'member' ? 'Member' : 'No access'}</p>}
        {admin && <div className="mt-2 flex flex-wrap gap-3">
          {person.user_id && person.role && person.user_id !== user.id && <ConfirmDeleteButton variant="ghost" className="min-h-11 text-destructive" disabled={busy}
            title={'Remove ' + person.display_name + '?'} description="They lose access right away. What they recorded stays." confirmLabel="Remove"
            onConfirm={() => run(async () => { const { error } = await supabase.rpc('remove_member', { p_user_id: person.user_id! }); if (error) throw error; })}>Remove {person.display_name}</ConfirmDeleteButton>}
          {!person.user_id && (person.is_active ? <>
            <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => {
              setTarget(person.caregiver_id); setEmail('');
              inviteForm.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              inviteEmail.current?.focus({ preventScroll: true });
            }}>Invite them</Button>
            <ConfirmDeleteButton variant="ghost" className="min-h-11 text-destructive" disabled={busy} title={'Deactivate ' + person.display_name + '?'}
              description="They will no longer appear in the lists. What they recorded stays." confirmLabel="Deactivate"
              onConfirm={() => run(async () => { const { error } = await supabase.from('caregivers').update({ is_active: false }).eq('household_id', householdId!).eq('id', person.caregiver_id); if (error) throw error; })}>Deactivate</ConfirmDeleteButton>
          </> : <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => void run(async () => {
            const { error } = await supabase.from('caregivers').update({ is_active: true }).eq('household_id', householdId!).eq('id', person.caregiver_id); if (error) throw error;
          })}>Reactivate</Button>)}
        </div>}
      </div>)}
    </div>
    {admin && <>
      <form ref={inviteForm} className={card + ' space-y-3'} onSubmit={e => { e.preventDefault(); void run(async () => {
        const { error } = await supabase.rpc('invite_member', { p_email: email.trim().toLowerCase(), ...(target ? { p_caregiver_id: target } : {}) });
        if (error) throw error;
        setEmail(''); setTarget(undefined);
      }); }}>
        <label className="block text-sm font-semibold" htmlFor="family-invite-email">{target ? 'Invite ' + caregivers.find(p => p.caregiver_id === target)?.display_name : 'Invite someone by email'}</label>
        <Input ref={inviteEmail} id="family-invite-email" type="email" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" />
        <Button disabled={busy}>Invite</Button>
        {target && <Button type="button" variant="ghost" disabled={busy} onClick={() => setTarget(undefined)}>Cancel</Button>}
      </form>
      <div className="space-y-2">
        {invites.isLoading && <p role="status">Loading invitations…</p>}
        {invites.error && <p role="alert">{accountError(invites.error)}</p>}
        {invites.data?.map(invite => <div className={card} key={invite.id}>
          <p className="[overflow-wrap:anywhere]">{invite.email}</p>
          <div className="flex items-center justify-between gap-5 text-sm">
            <span className="text-muted-foreground">Invited</span>
            <div className="flex gap-5">
              <Button variant="ghost" className="min-h-11" disabled={busy} onClick={() => void share(invite.email)}>Share</Button>
              <ConfirmDeleteButton variant="ghost" className="min-h-11 text-destructive" disabled={busy} title="Cancel this invitation?"
                description={invite.email + ' will no longer be able to join with this invitation.'} confirmLabel="Cancel invitation"
                onConfirm={() => run(async () => { const { error } = await supabase.rpc('revoke_invite', { p_invite_id: invite.id }); if (error) throw error; })}>Cancel</ConfirmDeleteButton>
            </div>
          </div>
        </div>)}
      </div>
      {shareText && <p className={card + ' break-words text-sm'} role="status">{shareText}</p>}
      <form className={card + ' space-y-3'} onSubmit={e => { e.preventDefault(); void run(async () => {
        const { error } = await supabase.from('caregivers').insert({ household_id: householdId!, display_name: name.trim() });
        if (error) throw error;
        setName('');
      }); }}>
        <label htmlFor="family-person-name" className="block text-sm font-semibold">Add a person without an email</label>
        <Input id="family-person-name" required maxLength={40} value={name} disabled={busy} onChange={e => setName(e.target.value)} />
        <Button disabled={busy}>Add person</Button>
      </form>
    </>}
  </section>;
}
