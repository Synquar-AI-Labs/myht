import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { useCareProfile } from '@/hooks/useCareProfile';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import { useNativeBack } from '@/native/back';
import { ALERT_LABELS, ageLabel, alertValue, fallRiskValue, type AlertKind } from '@/lib/careProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton';
import { ProfileLoad, ProfileSection, profileDialog } from './ProfileParts';

export function AboutTab({ onContacts, onEmergency }: { onContacts: () => void; onEmergency: () => void }) {
  const { careRecipientName } = useHousehold();
  const care = useCareProfile();
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState({ date_of_birth: '', fall_risk: '', fall_risk_note: '', emergency_notes: '' });
  const [baseline, setBaseline] = useState(draft);
  const [kind, setKind] = useState<AlertKind | null>(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useUpdateBusy(busy || edit || kind !== null);
  useNativeBack(useCallback(() => {
    if (!busy && !edit && !kind) return false;
    toast.info('Save or cancel your changes first.'); return true;
  }, [busy, edit, kind]), 10, true);
  const close = (open: boolean) => { if (!busy && !open) { setEdit(false); setKind(null); } };
  const editProfile = () => {
    const saved = { date_of_birth: care.profile?.date_of_birth ?? '', fall_risk: care.profile?.fall_risk == null ? '' : String(care.profile.fall_risk), fall_risk_note: care.profile?.fall_risk_note ?? '', emergency_notes: care.profile?.emergency_notes ?? '' };
    setDraft(saved); setBaseline(saved);
    setEdit(true);
  };
  const run = async (action: () => Promise<boolean>) => { setBusy(true); try { return await action(); } finally { setBusy(false); } };
  if (care.loading || care.error) return <ProfileLoad error={care.error} retry={care.retry} />;
  const list = (key: AlertKind) => <div className="space-y-1" key={key}>
    <h3 className="[font-family:inherit] text-sm font-semibold text-[#8b8175]">{ALERT_LABELS[key]}</h3>
    <div className="flex flex-wrap items-center gap-2">
      {care.alerts.filter(a => a.kind === key).map(a => <ConfirmDeleteButton key={a.id} variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal rounded-full px-3 py-2 text-left" disabled={busy} title="Remove this alert?" description={[a.text, a.note].filter(Boolean).join(' · ')} confirmLabel="Remove" onConfirm={async () => { await run(() => care.removeAlert(a.id)); }}><span className="min-w-0 break-words">{a.text}{a.note && <span className="text-sm text-[#8b8175]"> · {a.note}</span>}</span></ConfirmDeleteButton>)}
      <Button variant="outline" className="min-h-11 rounded-full px-3 text-[#8a6240]" disabled={busy} aria-label={`Add ${ALERT_LABELS[key]}`} onClick={() => { setKind(key); setText(''); setNote(''); }}>+ Add</Button>
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {care.alerts.every(a => a.kind !== key) && <><p className="min-w-0 flex-1 text-sm text-[#8b8175]">{alertValue(key, care.profile, care.alerts)}</p>
        {!care.profile?.none_known.includes(key) && <Button variant="outline" className="min-h-11" disabled={busy} aria-label={`None known: ${ALERT_LABELS[key]}`} onClick={() => void run(() => care.saveProfile({ none_known: [...(care.profile?.none_known ?? []), key] }))}>None known</Button>}</>}
      {care.alerts.every(a => a.kind !== key) && care.profile?.none_known.includes(key) && <Button variant="ghost" className="min-h-11 px-0" disabled={busy} aria-label={`Clear None known: ${ALERT_LABELS[key]}`} onClick={() => void run(() => care.saveProfile({ none_known: care.profile!.none_known.filter(k => k !== key) }))}>Clear</Button>}
    </div>
  </div>;
  return <div className="space-y-4 text-[#26201a]">
    <header className="flex items-start gap-3"><div className="min-w-0 flex-1"><h1 className="break-words text-[30px] font-normal">About {careRecipientName}</h1><p className="text-sm text-[#8b8175]">{ageLabel(care.profile?.date_of_birth)}</p></div><Button variant="ghost" onClick={editProfile}>Edit</Button></header>
    <ProfileSection title="Must know" danger>{list('allergy')}<div><h3 className="[font-family:inherit] text-sm font-semibold text-[#8b8175]">Fall risk</h3><p className="break-words py-2">{fallRiskValue(care.profile)}</p></div>{list('contagious')}</ProfileSection>
    <ProfileSection title="Health and diet">{list('condition')}{list('disability')}{list('diet')}</ProfileSection>
    <ProfileSection title="Emergency notes"><p className="whitespace-pre-wrap break-words">{care.profile?.emergency_notes || 'Not recorded'}</p></ProfileSection>
    <Button className="min-h-[52px] w-full bg-[#26201a]" onClick={onEmergency}>Emergency card</Button>
    <Button variant="outline" className="min-h-[52px] w-full" onClick={onContacts}>Contacts</Button>
    <Dialog open={edit || kind !== null} onOpenChange={close}>
      <DialogContent className={profileDialog} onEscapeKeyDown={e => { if (busy) e.preventDefault(); }} onPointerDownOutside={e => { if (busy) e.preventDefault(); }}>
        <DialogHeader className="pr-10"><DialogTitle>{kind ? `Add ${ALERT_LABELS[kind]}` : `Edit About ${careRecipientName}`}</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={async e => {
          e.preventDefault();
          const changed = {
            ...(draft.date_of_birth !== baseline.date_of_birth ? { date_of_birth: draft.date_of_birth || null } : {}),
            ...(draft.fall_risk !== baseline.fall_risk ? { fall_risk: draft.fall_risk === '' ? null : draft.fall_risk === 'true' } : {}),
            ...(draft.fall_risk_note !== baseline.fall_risk_note ? { fall_risk_note: draft.fall_risk_note.trim() } : {}),
            ...(draft.emergency_notes !== baseline.emergency_notes ? { emergency_notes: draft.emergency_notes.trim() } : {}),
          };
          if (!kind && !Object.keys(changed).length) { toast.info('Nothing changed'); setEdit(false); return; }
          const ok = await run(() => kind ? care.addAlert(kind, text, note) : care.saveProfile(changed));
          if (ok) { setKind(null); setEdit(false); toast.success('Saved'); }
        }}><fieldset disabled={busy} className="space-y-4">
          {kind ? <><div className="space-y-1"><Label htmlFor="alert-text">{ALERT_LABELS[kind]}</Label><Input id="alert-text" autoFocus className="min-h-11" maxLength={120} required value={text} onChange={e => setText(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="alert-note">Note (optional)</Label><Textarea id="alert-note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></div></> : <>
            <div className="space-y-1"><Label htmlFor="birth-date">Date of birth</Label><Input id="birth-date" type="date" max={format(new Date(), 'yyyy-MM-dd')} className="min-h-11 min-w-0 max-w-full" value={draft.date_of_birth} onChange={e => setDraft(p => ({ ...p, date_of_birth: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="fall-risk">Fall risk</Label><select id="fall-risk" className="min-h-11 w-full rounded-md border bg-background px-3 text-base" value={draft.fall_risk} onChange={e => setDraft(p => ({ ...p, fall_risk: e.target.value }))}><option value="">Not filled in</option><option value="true">Yes</option><option value="false">No</option></select></div>
            <div className="space-y-1"><Label htmlFor="fall-note">Fall risk note</Label><Textarea id="fall-note" maxLength={500} value={draft.fall_risk_note} onChange={e => setDraft(p => ({ ...p, fall_risk_note: e.target.value }))} /></div>
            <div className="space-y-1"><Label htmlFor="emergency-notes">Emergency notes</Label><Textarea id="emergency-notes" maxLength={4000} rows={4} value={draft.emergency_notes} onChange={e => setDraft(p => ({ ...p, emergency_notes: e.target.value }))} /></div>
          </>}
          <div className="flex gap-3"><Button type="button" variant="outline" className="min-h-11 flex-1" onClick={() => close(false)}>Cancel</Button><Button type="submit" className="min-h-11 flex-1" disabled={!!kind && !text.trim()}>Save</Button></div>
        </fieldset></form>
      </DialogContent>
    </Dialog>
  </div>;
}
