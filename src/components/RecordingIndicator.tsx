import { Loader2, Mic } from 'lucide-react';
import { useRecording } from '@/hooks/RecordingProvider';
import { formatDuration } from '@/lib/recording';

/**
 * A fixed, app-wide pill so an in-progress recording or transcription is
 * visible from every tab — the job lives above the tab subtree, so without
 * this a caregiver could forget it's still recording after navigating away.
 */
export function RecordingIndicator() {
  const { isRecording, busy, elapsed, job } = useRecording();
  if (!isRecording && !busy) return null;

  const label = isRecording
    ? `Recording ${formatDuration(elapsed)} — keep the phone unlocked`
    : job.status === 'uploading' ? 'Uploading audio…'
    : job.status === 'transcribing' ? 'Transcribing…'
    : job.status === 'saving' ? 'Saving transcript…'
    : 'Working…';

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold text-white shadow-lg ${
        isRecording ? 'bg-[#c2410c]' : 'bg-[#26201a]'
      }`}>
        {isRecording
          ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {isRecording && <Mic className="h-3.5 w-3.5" />}
        {label}
      </div>
    </div>
  );
}
