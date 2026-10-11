/**
 * The recording job state machine.
 *
 * A doctor conversation is unrepeatable, so this models the ENTIRE lifecycle
 * as one explicit machine (not a scatter of booleans): the captured audio is
 * retained until storage confirms it, every failure is recoverable, and the
 * whole thing lives above the tab/collapsible subtree so navigation can never
 * destroy it.
 */

export type JobStatus =
  | 'idle'
  | 'acquiring'          // getUserMedia / recorder start in flight (start lock)
  | 'recording'
  | 'captured'           // stopped; blob in hand, not yet uploaded
  | 'uploading'
  | 'upload-failed'      // blob retained → retry upload, or download the audio
  | 'transcribing'
  | 'transcribe-failed'  // uploaded → retry transcription (no re-upload)
  | 'saving'
  | 'saved'              // terminal success
  | 'too-large';         // blob retained → download the audio (retry won't help)

export interface JobMetadata {
  title: string;
  recordedBy: string;
  date: string; // yyyy-MM-dd — the day this conversation is filed under
  caregiverId: string;
}
export interface RecordingIdentity { user_id: string; household_id: string }

export interface RecordingJob extends Partial<RecordingIdentity> {
  id: string;
  status: JobStatus;
  metadata: JobMetadata;
  /** Kept until an upload is confirmed; the only copy of the audio. */
  blob?: Blob;
  bytes?: number;
  ext?: string;
  /** Set once the audio is safely in storage. */
  storagePath?: string;
  error?: string;
}

export type JobAction =
  | { type: 'ACQUIRE'; id: string; metadata: JobMetadata; identity: RecordingIdentity }
  | { type: 'ACQUIRE_FAILED'; error: string }
  | { type: 'RECORDING_STARTED' }
  | { type: 'UPDATE_METADATA'; metadata: Partial<JobMetadata> }
  | { type: 'CAPTURED'; blob: Blob; bytes: number; ext: string }
  | { type: 'TOO_LARGE'; blob: Blob; bytes: number; ext: string }
  | { type: 'UPLOAD_START' }
  | { type: 'UPLOAD_OK'; storagePath: string }
  | { type: 'UPLOAD_FAILED'; error: string }
  | { type: 'TRANSCRIBE_START' }
  | { type: 'TRANSCRIBE_FAILED'; error: string }
  | { type: 'SAVE_START' }
  | { type: 'SAVED' }
  | { type: 'RESTORE'; job: RecordingJob }
  | { type: 'DISCARD' };

export const idleJob: RecordingJob = { id: '', status: 'idle', metadata: { title: '', recordedBy: '', date: '', caregiverId: '' } };

/** True while any work is in flight — the UI blocks starting a second job. */
export function isBusy(status: JobStatus): boolean {
  return status === 'acquiring' || status === 'recording' ||
    status === 'uploading' || status === 'transcribing' || status === 'saving';
}

/** True when the job is finished with (or empty) and a new one may start. */
export function isResolved(status: JobStatus): boolean {
  return status === 'idle' || status === 'saved';
}

/** The audio can still be recovered by the caregiver (retry or download). */
export function isRecoverable(status: JobStatus): boolean {
  return status === 'upload-failed' || status === 'transcribe-failed' ||
    status === 'too-large' || status === 'captured';
}

export function recordingJobReducer(state: RecordingJob, action: JobAction): RecordingJob {
  switch (action.type) {
    case 'ACQUIRE':
      return { id: action.id, status: 'acquiring', metadata: action.metadata, ...action.identity };
    case 'ACQUIRE_FAILED':
      return { ...idleJob, error: action.error };
    case 'RECORDING_STARTED':
      return state.status === 'acquiring' ? { ...state, status: 'recording' } : state;
    case 'UPDATE_METADATA':
      return { ...state, metadata: { ...state.metadata, ...action.metadata } };
    case 'CAPTURED':
      return { ...state, status: 'captured', blob: action.blob, bytes: action.bytes, ext: action.ext };
    case 'TOO_LARGE':
      return { ...state, status: 'too-large', blob: action.blob, bytes: action.bytes, ext: action.ext, error: 'Recording exceeds the transcription size limit.' };
    case 'UPLOAD_START':
      return { ...state, status: 'uploading', error: undefined };
    case 'UPLOAD_OK':
      // Audio is safe in storage now; the local blob is no longer the only copy.
      return { ...state, status: 'transcribing', storagePath: action.storagePath, blob: undefined };
    case 'UPLOAD_FAILED':
      return { ...state, status: 'upload-failed', error: action.error };
    case 'TRANSCRIBE_START':
      return { ...state, status: 'transcribing', error: undefined };
    case 'TRANSCRIBE_FAILED':
      return { ...state, status: 'transcribe-failed', error: action.error };
    case 'SAVE_START':
      return { ...state, status: 'saving' };
    case 'SAVED':
      return { ...idleJob };
    case 'RESTORE':
      return action.job;
    case 'DISCARD':
      return { ...idleJob };
    default:
      return state;
  }
}
