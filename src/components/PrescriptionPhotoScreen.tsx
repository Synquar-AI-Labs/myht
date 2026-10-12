import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { useUpdateBusy } from '@/hooks/useUpdateBusy';
import type { MedicineSchedule } from '@/hooks/useMedicineSchedule';
import { preparePhoto, PHOTO_OPEN_ERROR } from '@/lib/preparePhoto';
import { photoSources, prescriptionDraft, prescriptionMessage, samePrescriptionName } from '@/lib/prescriptionDraft';
import { validatePrescription, type PrescriptionMedicine, type PrescriptionResult } from '../../supabase/functions/read-prescription/validation';
import { toast } from 'sonner';
import { useNativeBack } from '@/native/back';

export type PrescriptionPhoto = { blob: Blob; url: string; number: number };
export type PhotoFormContext = {
  medicine: PrescriptionMedicine; photos: PrescriptionPhoto[];
  draft: ReturnType<typeof prescriptionDraft>; onSaved: (medicine: MedicineSchedule) => void;
};
export function PrescriptionPhotoViewer({ photos, onClose }: { photos: PrescriptionPhoto[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [bigger, setBigger] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="flex h-[96dvh] w-[96vw] max-w-none flex-col gap-3 p-3 sm:p-4 [&>button:last-child]:right-1 [&>button:last-child]:top-1 [&>button:last-child]:flex [&>button:last-child]:h-11 [&>button:last-child]:w-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center">
    <DialogHeader><DialogTitle>Photo {photos[index].number}</DialogTitle></DialogHeader>
    <Button variant="outline" className="self-start" aria-pressed={bigger} onClick={() => setBigger(!bigger)}>{bigger ? 'Fit to screen' : 'Make bigger'}</Button>
    <div data-photo-scroll className="min-h-0 flex-1 overflow-auto">
      <img className={bigger ? 'block max-w-none' : 'h-full w-full object-contain'} src={photos[index].url} alt={`Photo ${photos[index].number}`} />
    </div>
    <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous photo</Button><Button variant="outline" disabled={index === photos.length - 1} onClick={() => setIndex(index + 1)}>Next photo</Button></div>
  </DialogContent></Dialog>;
}
export function PrescriptionPhotoScreen({ medicines, loaded, loadError, onRetry, onBack, onAdd, onEdit }: {
  medicines: MedicineSchedule[]; loaded: boolean; loadError: boolean; onRetry: () => void;
  onBack: () => void; onAdd: (context: PhotoFormContext) => void; onEdit: (medicine: MedicineSchedule) => void;
}) {
  const { householdId } = useHousehold();
  useUpdateBusy(true);
  const [photos, setPhotos] = useState<PrescriptionPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<PrescriptionResult | null>(null);
  const [added, setAdded] = useState<Record<number, MedicineSchedule>>({});
  const [removed, setRemoved] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [viewer, setViewer] = useState<PrescriptionPhoto[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const urls = useRef(new Set<string>());
  const mounted = useRef(true);
  const pendingRead = useRef<AbortController>();
  useNativeBack(() => {
    if (reading || preparing || pendingRead.current) return true;
    if (document.querySelector('[role="dialog"][data-state="open"]')) return false;
    onBack(); return true;
  }, 2, true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pendingRead.current?.abort(); for (const url of urls.current) URL.revokeObjectURL(url); urls.current.clear(); };
  }, []);
  const choose = async (files: File[]) => {
    if (preparing || reading) return;
    if (files.length > 4 - photos.length) toast.info('Only the first 4 photos were kept.');
    setPreparing(true); setMessage('');
    const prepared: PrescriptionPhoto[] = [];
    for (const file of files.slice(0, 4 - photos.length)) {
      try {
        const blob = await preparePhoto(file);
        if (!mounted.current) return;
        const url = URL.createObjectURL(blob); urls.current.add(url);
        prepared.push({ blob, url, number: photos.length + prepared.length + 1 });
      } catch { if (mounted.current) toast.error(PHOTO_OPEN_ERROR); }
    }
    if (mounted.current) { setPhotos(previous => [...previous, ...prepared]); setPreparing(false); }
  };
  const remove = (index: number) => {
    URL.revokeObjectURL(photos[index].url); urls.current.delete(photos[index].url);
    setPhotos(previous => previous.filter((_, i) => i !== index).map((photo, i) => ({ ...photo, number: i + 1 })));
  };
  const read = async () => {
    if (!householdId || !photos.length || pendingRead.current || preparing) return;
    const controller = new AbortController(); pendingRead.current = controller;
    setReading(true); setMessage('');
    try {
      const body = new FormData(); body.append('household_id', householdId);
      photos.forEach(photo => body.append('photo', photo.blob, `photo-${photo.number}.jpg`));
      const { data, error } = await supabase.functions.invoke('read-prescription', { body, signal: controller.signal });
      if (!mounted.current) return;
      if (error) {
        let code: string | undefined;
        if ('context' in error && error.context instanceof Response) { try { code = (await error.context.json()).code; } catch { /* no raw server text */ } }
        setMessage(prescriptionMessage(code)); return;
      }
      const parsed = validatePrescription(data, photos.length);
      if (!parsed.medicines.length) { setMessage(prescriptionMessage('unreadable')); return; }
      setResult(parsed); setAdded({}); setRemoved([]);
    } catch { if (mounted.current && !controller.signal.aborted) setMessage(prescriptionMessage()); }
    finally { pendingRead.current = undefined; if (mounted.current) setReading(false); }
  };
  const known = [...Object.values(added), ...medicines];
  return <section data-update-busy="true" className="space-y-4 pb-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{result ? 'Check each medicine' : 'Add from a photo'}</h2><Button variant="outline" disabled={reading || preparing} onClick={onBack}>{result ? 'Done' : 'Back to medicines'}</Button></div>
    <p className="text-sm">The photos are sent to OpenAI to be read. This app does not keep them.</p>
    {result && <p className="rounded-xl bg-[#f6eee4] p-3 font-semibold">Read by a computer. Check every line against the photos before adding.</p>}
    {!result && <p className="text-sm text-muted-foreground">One photo is usually enough. For a round bottle or a long page, add more photos so that every word is in one of them.</p>}
    <input ref={input} type="file" accept="image/*" multiple aria-label="Choose prescription photos" className="hidden" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void choose(files); }} />
    <input ref={camera} type="file" accept="image/*" capture="environment" aria-label="Take prescription photo" className="hidden" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void choose(files.slice(0, 1)); }} />
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{photos.map((photo, index) => <div key={photo.url} className="min-w-0 space-y-1 rounded-xl border p-2">
      <button className="w-full text-left" aria-label={`View photo ${index + 1}`} onClick={() => setViewer([photo])}><img className="h-24 w-full rounded-lg object-cover" src={photo.url} alt={`Photo ${index + 1}`} /><span className="flex min-h-11 items-center text-sm">Photo {index + 1}</span></button>
      {!result && <Button variant="ghost" className="w-full" disabled={reading || preparing} aria-label={`Remove photo ${index + 1}`} onClick={() => remove(index)}>Remove</Button>}
    </div>)}</div>
    {message && <p role="alert" className="text-sm font-medium">{message}</p>}
    {!result && <div className="flex flex-wrap gap-3">
      {photos.length < 4 && <><Button variant="outline" disabled={reading || preparing} onClick={() => camera.current?.click()}>Take a photo</Button><Button variant="outline" disabled={reading || preparing} onClick={() => input.current?.click()}>Choose photos</Button></>}
      {!!photos.length && <Button disabled={reading || preparing} onClick={() => void read()}>{reading ? 'Reading the photos…' : `Read ${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`}</Button>}
      {preparing && <p role="status" className="text-sm">Preparing photos…</p>}
    </div>}
    {result && <>
      {!loaded && !loadError && <p role="status">Loading your medicines…</p>}
      {loadError && <div role="alert" className="space-y-2"><p>Your medicines could not be loaded, so the app cannot tell which of these you already have. Check the connection.</p><Button variant="outline" onClick={onRetry}>Try again</Button></div>}
      {result.medicines.map((medicine, index) => {
        if (removed.includes(index)) return null;
        const existing = known.find(row => samePrescriptionName(row.name, medicine.name));
        const sources = medicine.photos.map(number => photos[number - 1]).filter(Boolean);
        return <article key={index} className="prescription-card space-y-2 rounded-xl border bg-white p-4">
          <h3 className="break-words text-base font-semibold">{medicine.name || 'Name not readable'}</h3>
          <p className="break-words text-sm">{[medicine.strength, medicine.amount].filter(Boolean).join(' · ')}</p>
          <p className="break-words text-sm">The prescription says: {medicine.source_text}</p>
          {photos.length > 1 && <p className="text-sm text-muted-foreground">{photoSources(medicine.photos)}</p>}
          {added[index] ? <p className="font-semibold text-[#2e7d4f]">Added</p> : <>
            {existing && <p className="break-words text-sm">Already in your medicines: {existing.name}</p>}
            <div className="prescription-card-actions flex flex-wrap justify-between gap-2">
              {existing ? <Button className="max-w-full whitespace-normal" variant="outline" onClick={() => onEdit(existing)}>Open it</Button> : <Button className="max-w-full whitespace-normal" disabled={!loaded || loadError} onClick={() => onAdd({ medicine, photos: sources, draft: prescriptionDraft(medicine, format(new Date(), 'yyyy-MM-dd')), onSaved: row => { if (mounted.current) setAdded(previous => ({ ...previous, [index]: row })); } })}>Check and add</Button>}
              <Button variant="ghost" className="ml-auto max-w-full whitespace-normal" onClick={() => setRemoved(previous => [...previous, index])}>Not this one</Button>
            </div>
          </>}
        </article>;
      })}
    </>}
    {viewer && <PrescriptionPhotoViewer photos={viewer} onClose={() => setViewer(null)} />}
  </section>;
}
