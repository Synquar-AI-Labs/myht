import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { useCareProfile, useContacts } from '@/hooks/useCareProfile';
import { medicineKeys, fetchMedicinesList } from '@/hooks/useMedicines';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import { emergencyCardRows } from '@/lib/emergencyCard';
import { cardReadiness } from '@/lib/careProfile';
import { savePdf } from '@/native/files';
import { Button } from '@/components/ui/button';
import { ProfileLoad } from './ProfileParts';

export function EmergencyCardTab() {
  const { householdId, careRecipientName } = useHousehold();
  const care = useCareProfile();
  const contacts = useContacts();
  const medicines = useQuery({ queryKey: medicineKeys.list(householdId), enabled: !!householdId, queryFn: () => fetchMedicinesList(householdId!) });
  const [busy, setBusy] = useState(false);
  useUpdateBusy(busy);
  const ready = cardReadiness([{ loading: care.profileQuery.isLoading, error: care.profileQuery.isError }, { loading: care.alertsQuery.isLoading, error: care.alertsQuery.isError }, { loading: medicines.isLoading, error: medicines.isError }, { loading: contacts.loading, error: contacts.error }]);
  const retry = () => { care.retry(); contacts.retry(); void medicines.refetch(); };
  if (ready !== 'ready') return <ProfileLoad error={ready === 'failed'} retry={retry} />;
  const model = emergencyCardRows(care.profile, care.alerts, medicines.data ?? [], contacts.contacts);
  const made = () => `Made ${format(new Date(), 'MMM d, yyyy, h:mm a')} · from MyHT`;
  const exportCard = async () => {
    setBusy(true);
    try {
      const doc = new jsPDF();
      const body = [
        ['Name', careRecipientName], ['Age / birth', model.age], ...model.facts,
        ['Current medicines', model.medicines.length ? model.medicines.map(m => m.join(' · ')).join('\n') : 'Not recorded'],
        ['Call first', model.contacts.length ? model.contacts.map(c => c.filter(Boolean).join(' · ')).join('\n') : 'Not recorded'],
        ['Notes', model.notes], ['Made', made().replace(/^Made /, '')],
      ];
      autoTable(doc, { head: [['Emergency card', 'Medical information']], body, margin: 14, styles: { fontSize: 11, cellPadding: 3, overflow: 'linebreak' }, columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 142 } }, headStyles: { fillColor: [180, 35, 24] } });
      await savePdf(doc, 'emergency-card.pdf');
    } catch { toast.error('Could not make the card. Try again.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4 text-[#26201a]">
    <header><h1 className="text-[30px] font-normal">Emergency card</h1><p className="mt-1 text-sm text-[#8b8175]">For paramedics or a new doctor. It fills itself from About, Contacts and the medicine list.</p></header>
    <article data-emergency-card className="overflow-hidden rounded-2xl border border-[#e9e2d6] bg-white">
      <header className="space-y-1 bg-[#b42318] p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider">Medical information</p><h2 className="break-words text-[26px] font-normal">{careRecipientName}</h2><p className="text-sm">{model.age}</p></header>
      <dl className="px-4 py-2">{model.facts.map(([label, value]) => <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 border-b border-[#f3ede2] py-2 last:border-0" key={label}><dt className="break-words text-sm font-semibold text-[#8b8175]">{label}</dt><dd className={`break-words text-[15px] ${label === 'Allergies' ? 'font-semibold text-[#b42318]' : ''}`}>{value}</dd></div>)}</dl>
      <section className="space-y-2 border-t border-[#e9e2d6] p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-[#8b8175]">Current medicines</h3>{model.medicines.length ? model.medicines.map((m, i) => <p className="break-words text-[15px]" key={i}><strong className="font-semibold">{m[0]}</strong> · {m[1]}<span className="block text-sm text-[#8b8175]">{m[2]}</span></p>) : <p>Not recorded</p>}</section>
      <section className="space-y-2 border-t border-[#e9e2d6] p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-[#8b8175]">Call first</h3>{model.contacts.length ? model.contacts.map((c, i) => <p className="break-words text-[15px]" key={i}><strong className="font-semibold">{c[0]}</strong>{c[1] && ` · ${c[1]}`}<span className="block select-text">{c[2]}</span></p>) : <p>Not recorded</p>}</section>
      <section className="space-y-2 border-t border-[#e9e2d6] p-4"><h3 className="text-xs font-bold uppercase tracking-wider text-[#8b8175]">Notes</h3><p className="whitespace-pre-wrap break-words">{model.notes}</p></section>
      <footer className="bg-[#f6f3ef] px-4 py-3 text-xs text-[#8b8175]">{made()}</footer>
    </article>
    <Button className="min-h-[52px] w-full bg-[#26201a]" disabled={busy} onClick={() => void exportCard()}>{busy ? 'Making PDF…' : 'Save or share PDF'}</Button>
    <p className="text-center text-sm text-[#8b8175]">Print one for the fridge door and one for the hospital bag.</p>
  </div>;
}
