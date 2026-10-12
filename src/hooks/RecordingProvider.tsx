import {
  createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  pickRecordingMimeType, SPEECH_BITS_PER_SECOND, MAX_TRANSCRIBABLE_BYTES, describeBytes,
} from '@/lib/recording';
import {
  recordingJobReducer, idleJob, isBusy, isResolved, isRecoverable,
  RecordingJob, JobMetadata, JobAction,
} from '@/lib/recordingJob';
import { persistJob, loadPersistedJob, clearPersistedJob } from '@/lib/recordingJobStore';
import { useHousehold } from '@/hooks/HouseholdProvider';
import { useUpdateBusy, holdUpdateWork, withUpdateWork } from '@/hooks/useUpdateBusy';
import { domainKeys } from '@/lib/domainKeys';
import { transcriptionError } from '@/lib/transcriptionError';

const MIME_EXT: Record<string, string> = {
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'm4a', 'audio/x-caf': 'm4a',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'video/mp4': 'mp4',
};

/** Content-type Supabase storage should tag the file with (base type, no codec suffix). */
function contentTypeForExt(ext: string): string {
  const map: Record<string, string> = {
    m4a: 'audio/mp4', mp4: 'audio/mp4', mp3: 'audio/mpeg', mpeg: 'audio/mpeg',
    wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', flac: 'audio/flac',
  };
  return map[ext] ?? 'application/octet-stream';
}

function extFromMime(type: string): string {
  return MIME_EXT[type.split(';')[0]] ?? 'webm';
}

function extFromFile(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'].includes(fromName)) {
    return fromName;
  }
  return extFromMime(file.type);
}

interface RecordingContextValue {
  job: RecordingJob;
  elapsed: number;
  isRecording: boolean;
  busy: boolean;
  setMetadata: (m: Partial<JobMetadata>) => void;
  startRecording: (metadata: JobMetadata) => Promise<void>;
  stopRecording: () => void;
  processFile: (file: File, metadata: JobMetadata) => Promise<void>;
  retry: () => Promise<void>;
  discard: () => void;
  downloadAudio: () => Promise<void>;
}

const RecordingContext = createContext<RecordingContextValue | null>(null);

export function RecordingProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user, householdId } = useHousehold();
  const identity = useRef({ user_id: user.id, household_id: householdId! }).current;
  const [job, reduceDispatch] = useReducer(recordingJobReducer, idleJob);
  const [elapsed, setElapsed] = useState(0);
  const [restoring, setRestoring] = useState(true);
  useUpdateBusy(restoring || isBusy(job.status));

  // Async callbacks read the LATEST job (fixes stale title/recordedBy at stop).
  const jobRef = useRef(job);
  const mounted = useRef(true);
  const recovering = useRef(true);
  const dispatch = useCallback((action: JobAction) => {
    jobRef.current = recordingJobReducer(jobRef.current, action);
    if (mounted.current) reduceDispatch(action);
  }, []);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const finishCaptureRef = useRef<(() => void) | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const runningRef = useRef(false); // guards the upload/transcribe pipeline
  const startingRef = useRef(false); // start lock — no double recorders

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: domainKeys.transcripts(identity.household_id) });
    queryClient.invalidateQueries({ queryKey: domainKeys.transcriptCount(identity.household_id) });
  }, [queryClient, identity]);

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    lock?.release().catch(() => {});
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      const lock = await nav.wakeLock?.request('screen');
      // Guard the race: if we stopped while awaiting, release immediately.
      if (lock && recorderRef.current?.state === 'recording') wakeLockRef.current = lock;
      else await lock?.release().catch(() => {});
    } catch { /* unsupported/denied — recording still works while awake */ }
  }, []);

  // Wake locks auto-release when the tab hides; re-acquire on return.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && recorderRef.current?.state === 'recording' && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [requestWakeLock]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── Server pipeline ────────────────────────────────────────────────

  const checkIdentity = useCallback(async (current: RecordingJob) => {
    const mismatch = 'This recording belongs to another account or family. Sign back in to continue.';
    if (!mounted.current || current.user_id !== identity.user_id || current.household_id !== identity.household_id) throw new Error(mismatch);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== current.user_id) throw new Error(mismatch);
    const { data: membership, error } = await supabase.from('household_members').select('household_id').eq('user_id', session.user.id).maybeSingle();
    if (error) throw new Error('Could not check your family. Your audio is kept. Please try again.');
    if (!mounted.current || membership?.household_id !== current.household_id) throw new Error(mismatch);
    return session;
  }, [identity]);

  const transcribeAndSave = useCallback(async (current: RecordingJob) => withUpdateWork(async () => {
    dispatch({ type: 'TRANSCRIBE_START' });
    const { storagePath, ext, metadata } = current;
    let result: { transcript: string; summary: string; action_items: string[]; follow_ups: string[] };
    try {
      const session = await checkIdentity(current);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ storagePath, fileName: `recording.${ext}` }),
      });
      if (!res.ok) {
        let msg = `Server error (${res.status})`;
        try { msg = transcriptionError(await res.json(), msg); } catch { /* keep default */ }
        throw new Error(msg);
      }
      result = await res.json();
    } catch (e) {
      dispatch({ type: 'TRANSCRIBE_FAILED', error: e instanceof Error ? e.message : 'Transcription failed.' });
      return;
    }

    dispatch({ type: 'SAVE_START' });
    try {
      await checkIdentity(current);
      const { error } = await supabase.from('audio_transcripts').insert({
        household_id: identity.household_id,
        caregiver_id: metadata.caregiverId,
        date: metadata.date,
        title: metadata.title || null,
        audio_path: storagePath,
        transcript: result.transcript,
        summary: result.summary,
        action_items: result.action_items,
        follow_ups: result.follow_ups,
        recorded_by: metadata.recordedBy || 'Unknown',
      });
      if (error) throw error;
    } catch (e) {
      dispatch({ type: 'TRANSCRIBE_FAILED', error: e instanceof Error ? e.message : 'Could not save the transcript.' });
      return;
    }

    await clearPersistedJob(identity);
    dispatch({ type: 'SAVED' });
    if (mounted.current) { invalidate(); toast.success('Transcript saved.'); }
  }), [invalidate, checkIdentity, dispatch, identity]);

  const uploadAndProcess = useCallback(async (blob: Blob, ext: string, metadata: JobMetadata) => withUpdateWork(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    const current = jobRef.current;
    try {
      dispatch({ type: 'UPLOAD_START' });
      const id = current.id;
      await persistJob({ ...identity, id, metadata, ext, bytes: blob.size, blob, savedAt: Date.now() });
      await checkIdentity(current);

      const storagePath = `${current.household_id}/${metadata.date}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('audio-files')
        .upload(storagePath, blob, { contentType: contentTypeForExt(ext) });
      if (uploadError) {
        dispatch({ type: 'UPLOAD_FAILED', error: uploadError.message });
        return; // blob is still persisted → retry re-uploads, or download it
      }

      dispatch({ type: 'UPLOAD_OK', storagePath });
      await persistJob({ ...identity, id, metadata, ext, bytes: blob.size, storagePath, savedAt: Date.now() });
      await transcribeAndSave({ ...current, storagePath, ext, metadata });
    } catch (e) {
      dispatch({ type: 'UPLOAD_FAILED', error: e instanceof Error ? e.message : 'Could not upload. Your audio is kept.' });
    } finally {
      runningRef.current = false;
    }
  }), [transcribeAndSave, checkIdentity, dispatch, identity]);

  // ── Recording ──────────────────────────────────────────────────────

  const finalizeRecording = useCallback((mimeType: string | undefined) => {
    const releaseCapture = finishCaptureRef.current ?? (() => {});
    finishCaptureRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    stopTimer();
    releaseWakeLock();

    const type = mimeType ?? recorderRef.current?.mimeType ?? 'audio/webm';
    const blob = new Blob(chunksRef.current, { type });
    chunksRef.current = [];
    recorderRef.current = null;

    if (blob.size === 0) {
      if (mounted.current) toast.error('No audio was captured. Please try again.');
      dispatch({ type: 'DISCARD' });
      releaseCapture();
      return;
    }

    const ext = extFromMime(type);
    const metadata = jobRef.current.metadata; // current at STOP, not record time
    if (!mounted.current) {
      void withUpdateWork(() => persistJob({ ...identity, id: jobRef.current.id, metadata, ext, bytes: blob.size, blob, savedAt: Date.now() }))
        .catch(error => { console.error(error); toast.error('Could not keep the audio on this device.'); }).finally(releaseCapture);
      return;
    }
    if (blob.size > MAX_TRANSCRIBABLE_BYTES) {
      dispatch({ type: 'TOO_LARGE', blob, bytes: blob.size, ext });
      void withUpdateWork(() => persistJob({ ...identity, id: jobRef.current.id, metadata, ext, bytes: blob.size, blob, savedAt: Date.now() }))
        .catch(error => { console.error(error); toast.error('Could not keep the audio on this device.'); }).finally(releaseCapture);
      toast.error(`Recording is ${describeBytes(blob.size)} — over the ${describeBytes(MAX_TRANSCRIBABLE_BYTES)} transcription limit. You can download the audio and split it.`);
      return;
    }

    dispatch({ type: 'CAPTURED', blob, bytes: blob.size, ext });
    uploadAndProcess(blob, ext, metadata);
    releaseCapture();
  }, [releaseWakeLock, stopTimer, uploadAndProcess, dispatch, identity]);

  const startRecording = useCallback(async (metadata: JobMetadata) => {
    const current = jobRef.current;
    if (recovering.current || isBusy(current.status) || (!isResolved(current.status) && isRecoverable(current.status))) {
      toast.error('Finish or discard the current recording first.');
      return;
    }
    if (startingRef.current) return;
    startingRef.current = true;

    const id = `rec-${Date.now()}`;
    dispatch({ type: 'ACQUIRE', id, metadata, identity });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    } catch {
      startingRef.current = false;
      dispatch({ type: 'ACQUIRE_FAILED', error: 'mic' });
      toast.error('Microphone is blocked. Allow it for this site in your browser settings, then try again.');
      return;
    }

    const mimeType = pickRecordingMimeType();
    if (!mounted.current) { stream.getTracks().forEach(t => t.stop()); startingRef.current = false; return; }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: SPEECH_BITS_PER_SECOND,
      });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onerror = () => {
        toast.error('Recording stopped unexpectedly. Whatever was captured will still be processed.');
        try { recorder.stop(); } catch { /* already stopped */ }
      };
      recorder.onstop = () => finalizeRecording(mimeType);
      recorder.start(1000); // 1s chunks — an unexpected stop keeps the audio
    } catch {
      stream.getTracks().forEach(t => t.stop());
      startingRef.current = false;
      dispatch({ type: 'ACQUIRE_FAILED', error: 'recorder' });
      toast.error("This browser can't record audio. Use Upload with a voice memo instead.");
      return;
    }

    recorderRef.current = recorder;
    streamRef.current = stream;
    dispatch({ type: 'RECORDING_STARTED' });
    setElapsed(0);
    stopTimer();
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    requestWakeLock();
    startingRef.current = false;
  }, [requestWakeLock, stopTimer, finalizeRecording, dispatch, identity]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const processFile = useCallback(async (file: File, metadata: JobMetadata) => {
    const current = jobRef.current;
    if (isBusy(current.status) || (!isResolved(current.status) && isRecoverable(current.status))) {
      toast.error('Finish or discard the current recording first.');
      return;
    }
    const ext = extFromFile(file);
    if (recovering.current) return;
    dispatch({ type: 'ACQUIRE', id: `file-${Date.now()}`, metadata, identity });
    if (file.size > MAX_TRANSCRIBABLE_BYTES) {
      dispatch({ type: 'TOO_LARGE', blob: file, bytes: file.size, ext });
      await persistJob({ ...identity, id: jobRef.current.id, metadata, ext, bytes: file.size, blob: file, savedAt: Date.now() });
      toast.error(`That file is ${describeBytes(file.size)} — over the ${describeBytes(MAX_TRANSCRIBABLE_BYTES)} transcription limit.`);
      return;
    }
    dispatch({ type: 'CAPTURED', blob: file, bytes: file.size, ext });
    await uploadAndProcess(file, ext, metadata);
  }, [uploadAndProcess, dispatch, identity]);

  const retry = useCallback(async () => {
    const current = jobRef.current;
    if (current.status === 'transcribe-failed' && current.storagePath) {
      if (runningRef.current) return;
      runningRef.current = true;
      try {
        await transcribeAndSave(current);
      } finally {
        runningRef.current = false;
      }
    } else if ((current.status === 'upload-failed' || current.status === 'captured') && current.blob) {
      await uploadAndProcess(current.blob, current.ext ?? 'webm', current.metadata);
    }
  }, [transcribeAndSave, uploadAndProcess]);

  const discard = useCallback(() => {
    if (runningRef.current || startingRef.current || isBusy(jobRef.current.status)) return;
    clearPersistedJob(identity);
    dispatch({ type: 'DISCARD' });
  }, [dispatch, identity]);

  const downloadAudio = useCallback(async () => {
    const current = jobRef.current;
    let { blob } = current;
    const { ext } = current;
    try {
      await checkIdentity(current);
      if (!blob && current.storagePath) {
        const { data, error } = await supabase.storage.from('audio-files').download(current.storagePath);
        if (error) throw error;
        blob = data;
      }
    } catch { if (mounted.current) toast.error('Could not download the audio. Sign in to the same family and try again.'); return; }
    if (!blob || !mounted.current) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${jobRef.current.metadata.date || 'recording'}.${ext ?? 'webm'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [checkIdentity]);

  const setMetadata = useCallback((m: Partial<JobMetadata>) => {
    dispatch({ type: 'UPDATE_METADATA', metadata: m });
  }, []);

  // On load, recover an interrupted job (reload/crash mid-upload).
  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    loadPersistedJob(identity).then(stored => {
      if (cancelled) return;
      recovering.current = false;
      setRestoring(false);
      if (!stored) return;
      const status = stored.storagePath ? 'transcribe-failed'
        : stored.bytes > MAX_TRANSCRIBABLE_BYTES ? 'too-large'
        : 'upload-failed';
      dispatch({
        type: 'RESTORE',
        job: {
          id: stored.id, status, metadata: stored.metadata, ext: stored.ext,
          user_id: stored.user_id, household_id: stored.household_id,
          bytes: stored.bytes, blob: stored.blob, storagePath: stored.storagePath,
          error: 'Recovered an unfinished recording from your last session.',
        },
      });
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      stopTimer(); releaseWakeLock();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        finishCaptureRef.current = holdUpdateWork();
        try { recorderRef.current.stop(); }
        catch { finishCaptureRef.current(); finishCaptureRef.current = null; }
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [identity, dispatch, stopTimer, releaseWakeLock]);

  const value: RecordingContextValue = {
    job,
    elapsed,
    isRecording: job.status === 'recording',
    busy: restoring || isBusy(job.status),
    setMetadata,
    startRecording,
    stopRecording,
    processFile,
    retry,
    discard,
    downloadAudio,
  };

  return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>;
}

export function useRecording(): RecordingContextValue {
  const ctx = useContext(RecordingContext);
  if (!ctx) throw new Error('useRecording must be used within a RecordingProvider');
  return ctx;
}
