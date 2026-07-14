/**
 * Audio-recording helpers for the doctor-conversation transcriber.
 *
 * Platform reality this file encodes:
 * - iOS Safari does NOT support audio/webm — it records audio/mp4 (AAC).
 *   Hardcoding webm made the Record button silently dead on every iPhone.
 * - OpenAI's transcription API rejects files over 25 MB, so long
 *   conversations must be captured at speech bitrate and size-checked
 *   BEFORE spending minutes uploading.
 */

/** Candidate container/codec combos, most efficient first per platform. */
const MIME_CANDIDATES = [
  'audio/webm;codecs=opus', // Chrome / Android / Firefox — smallest for speech
  'audio/mp4',              // iOS / macOS Safari (AAC)
  'audio/webm',
  'audio/ogg;codecs=opus',
];

/**
 * First recording format this browser actually supports, or undefined to let
 * the browser pick its default.
 */
export function pickRecordingMimeType(
  isSupported: (type: string) => boolean = type =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type),
): string | undefined {
  return MIME_CANDIDATES.find(type => {
    try {
      return isSupported(type);
    } catch {
      return false;
    }
  });
}

/** Speech-quality bitrate: ~14 MB/hour keeps 90+ min under the 25 MB cap. */
export const SPEECH_BITS_PER_SECOND = 32_000;

/** OpenAI transcription hard limit is 25 MB; leave headroom for container overhead. */
export const MAX_TRANSCRIBABLE_BYTES = 24 * 1024 * 1024;

export function describeBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "7:05" style elapsed-recording label. */
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
