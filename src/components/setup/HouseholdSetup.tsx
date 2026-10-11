import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { accountError, resolveSetup } from '@/lib/accountSetup';
import { SetupBrand, SetupField, SetupLayout } from './SetupLayout';

export function HouseholdSetup({ children }: { children: React.ReactNode }) {
  const { state, user, reload } = useHousehold();
  const [name, setName] = useState(String(user.user_metadata.display_name ?? ''));
  const [recipient, setRecipient] = useState('');
  const [email, setEmail] = useState('');
  const [createdHousehold, setCreatedHousehold] = useState<string | null>(null);
  const [invites, setInvites] = useState<{ id: string; email: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shareText, setShareText] = useState('');
  const [nameOnly, setNameOnly] = useState(false);
  const [helperName, setHelperName] = useState('');
  const [helpers, setHelpers] = useState<string[]>([]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
  };
  const destination = resolveSetup({ loading: state.status === 'loading', error: state.status === 'error', member: state.status === 'ready', invite: state.status === 'no-household' && !!state.invite });
  if (destination === 'loading') return <SetupLayout><p role="status">Loading your family…</p></SetupLayout>;
  if (state.status === 'error') return <SetupLayout><p role="alert">{state.message}</p><button className="setup-primary" onClick={() => void reload()}>Retry</button></SetupLayout>;
  if (destination === 'app') return <>{children}</>;
  if (state.status !== 'no-household') return null;
  const invite = state.invite;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(async () => {
      if (createdHousehold) {
        if (nameOnly) {
          const { error } = await supabase.from('caregivers').insert({ household_id: createdHousehold, display_name: helperName.trim() });
          if (error) throw error;
          setHelpers(previous => [...previous, helperName.trim()]);
          setHelperName('');
          setNameOnly(false);
          return;
        }
        const address = email.trim().toLowerCase();
        const { data, error } = await supabase.rpc('invite_member', { p_email: address });
        if (error) throw error;
        setInvites(previous => [...previous.filter(i => i.email !== address), { id: data, email: address }]);
        setEmail('');
      } else if (invite) {
        const { error } = await supabase.rpc('accept_invite', { p_invite_id: invite.invite_id, p_display_name: name.trim() });
        if (error) throw error;
        await reload();
      } else {
        const { data, error } = await supabase.rpc('create_household', {
          p_care_recipient_name: recipient.trim(), p_display_name: name.trim(),
          p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (error) throw error;
        setCreatedHousehold(data);
      }
    });
  };
  const share = async (address: string) => {
    const text = 'Join our family on Health Tracker. Create an account with ' + address + ' at ' + window.location.origin;
    try {
      if (navigator.share) await navigator.share({ title: 'Join our family', text });
      else setShareText(text);
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setShareText(text); }
  };
  return <SetupLayout>
    {!createdHousehold && <SetupBrand />}
    <h1 className={!createdHousehold && !invite ? 'setup-hero' : undefined}>{createdHousehold ? 'Who else helps?' : invite ? 'Join your family' : 'Who are you caring for?'}</h1>
    <p>{createdHousehold ? 'Add the email of each person who helps. They create their own account with that email and choose their own password.'
      : invite ? invite.inviter_display_name + ' invited you to help care for ' + invite.care_recipient_name + '.'
      : 'We will set up a private place for the people who look after them.'}</p>
    <form onSubmit={submit}><fieldset disabled={busy}>
      {createdHousehold ? nameOnly
        ? <SetupField id="helper-name" label="Their name" required maxLength={40} placeholder="First name is enough" value={helperName} onChange={e => setHelperName(e.target.value)} />
        : <SetupField id="invite-email" label="Email" type="email" required placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        : <>
          {!invite && <SetupField id="recipient" label="Their name" required maxLength={80} placeholder="For example: Dad" value={recipient} onChange={e => setRecipient(e.target.value)} />}
          <SetupField id="caregiver-name" label="Your name" required maxLength={40} placeholder="First name is enough" value={name} onChange={e => setName(e.target.value)} />
        </>}
      <button className="setup-primary" disabled={busy}>{busy ? 'Please wait…' : createdHousehold ? 'Add' : invite ? 'Join' : 'Continue'}</button>
    </fieldset></form>
    {error && <p className="setup-error" role="alert">{error}</p>}
    {createdHousehold && <>
      {invites.map(i => <div className="setup-card" key={i.id}><p>{i.email}</p><span>Invited</span><button className="setup-link" disabled={busy} onClick={() => void share(i.email)}>Share</button><button className="setup-link" aria-label={'Remove ' + i.email} disabled={busy} onClick={() => void run(async () => {
        const { error } = await supabase.rpc('revoke_invite', { p_invite_id: i.id });
        if (error) throw error;
        setInvites(previous => previous.filter(item => item.id !== i.id));
      })}>Remove</button></div>)}
      {helpers.map(helper => <p className="setup-card" key={helper}>{helper}</p>)}
      <button className="setup-link" disabled={busy} onClick={() => setNameOnly(value => !value)}>{nameOnly ? 'Invite by email instead' : 'Someone helps but has no email? Add just their name'}</button>
      {shareText && <p className="setup-card" role="status">{shareText}</p>}
      <div style={{ flexGrow: 1 }} />
      <button className="setup-primary" disabled={busy} onClick={() => void reload()}>Done</button>
      <button className="setup-link" disabled={busy} onClick={() => void reload()}>Skip for now</button>
    </>}
    <button className="setup-link" disabled={busy} onClick={() => void supabase.auth.signOut()}>Sign out</button>
  </SetupLayout>;
}
