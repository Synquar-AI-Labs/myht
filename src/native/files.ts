import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { jsPDF } from 'jspdf';
import { toast } from 'sonner';
import { isNativeApp } from './platform';

export const EXPORT_MAX_AGE_MS = 60 * 60 * 1000;
export async function cleanupExports(now = Date.now()) {
  if (!isNativeApp()) return;
  // Creating it first avoids treating a first launch as an error.
  // Existing-directory errors are harmless; readdir still surfaces access failures.
  await Filesystem.mkdir({ path: 'exports', directory: Directory.Cache, recursive: true }).catch(() => {});
  const { files } = await Filesystem.readdir({ path: 'exports', directory: Directory.Cache });
  for (const file of files) {
    if (file.type === 'file' && file.mtime < now - EXPORT_MAX_AGE_MS) {
      await Filesystem.deleteFile({ path: `exports/${file.name}`, directory: Directory.Cache });
    }
  }
}

function blobBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}

export async function shareFile(blob: Blob, filename: string) {
  await cleanupExports();
  const path = `exports/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const { uri } = await Filesystem.writeFile({ path, directory: Directory.Cache, data: await blobBase64(blob), recursive: true });
  // Cache is the shareable Android directory. Keep it after the sheet returns:
  // another app may still be reading the file.
  await Share.share({ title: filename, files: [uri], dialogTitle: 'Save or share' });
}

export async function savePdf(doc: jsPDF, filename: string) {
  if (!isNativeApp()) { doc.save(filename); return; }
  try { await shareFile(doc.output('blob'), filename); }
  catch { toast.error('Could not share the report. Try again.'); }
}

export async function saveAudio(blob: Blob, filename: string) {
  if (isNativeApp()) {
    try { await shareFile(blob, filename); }
    catch { toast.error('Could not share the audio. Your recording is safe.'); }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
