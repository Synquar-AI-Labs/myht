import { describe, it, expect } from 'vitest';
import {
  recordingJobReducer, idleJob, isBusy, isResolved, isRecoverable,
  RecordingJob,
} from '@/lib/recordingJob';

const meta = { title: 'Doctor conversation', recordedBy: 'Caregiver A', date: '2026-07-14' };
const blob = new Blob(['x'], { type: 'audio/mp4' });

describe('status predicates', () => {
  it('isBusy covers every in-flight state', () => {
    (['acquiring', 'recording', 'uploading', 'transcribing', 'saving'] as const).forEach(s =>
      expect(isBusy(s)).toBe(true));
    (['idle', 'captured', 'upload-failed', 'transcribe-failed', 'saved', 'too-large'] as const).forEach(s =>
      expect(isBusy(s)).toBe(false));
  });

  it('isResolved only for idle/saved', () => {
    expect(isResolved('idle')).toBe(true);
    expect(isResolved('saved')).toBe(true);
    expect(isResolved('upload-failed')).toBe(false);
  });

  it('isRecoverable for states holding retrievable audio', () => {
    (['captured', 'upload-failed', 'transcribe-failed', 'too-large'] as const).forEach(s =>
      expect(isRecoverable(s)).toBe(true));
    expect(isRecoverable('recording')).toBe(false);
  });
});

describe('recordingJobReducer — happy path', () => {
  it('acquire → recording → captured → upload → transcribe → save → saved(idle)', () => {
    let s: RecordingJob = idleJob;
    s = recordingJobReducer(s, { type: 'ACQUIRE', id: 'j1', metadata: meta });
    expect(s.status).toBe('acquiring');
    s = recordingJobReducer(s, { type: 'RECORDING_STARTED' });
    expect(s.status).toBe('recording');
    s = recordingJobReducer(s, { type: 'CAPTURED', blob, bytes: 1, ext: 'm4a' });
    expect(s.status).toBe('captured');
    expect(s.blob).toBe(blob);
    s = recordingJobReducer(s, { type: 'UPLOAD_START' });
    expect(s.status).toBe('uploading');
    s = recordingJobReducer(s, { type: 'UPLOAD_OK', storagePath: '2026-07-14/1.m4a' });
    expect(s.status).toBe('transcribing');
    expect(s.storagePath).toBe('2026-07-14/1.m4a');
    // Uploaded → the local blob is dropped (storage is now the copy of record).
    expect(s.blob).toBeUndefined();
    s = recordingJobReducer(s, { type: 'SAVE_START' });
    expect(s.status).toBe('saving');
    s = recordingJobReducer(s, { type: 'SAVED' });
    expect(s.status).toBe('idle');
  });
});

describe('recordingJobReducer — failures keep the audio recoverable', () => {
  it('upload failure retains the blob for retry/download', () => {
    let s = recordingJobReducer(idleJob, { type: 'ACQUIRE', id: 'j', metadata: meta });
    s = recordingJobReducer(s, { type: 'CAPTURED', blob, bytes: 10, ext: 'm4a' });
    s = recordingJobReducer(s, { type: 'UPLOAD_START' });
    s = recordingJobReducer(s, { type: 'UPLOAD_FAILED', error: 'network' });
    expect(s.status).toBe('upload-failed');
    expect(s.blob).toBe(blob);
    expect(isRecoverable(s.status)).toBe(true);
  });

  it('transcription failure after upload keeps the storagePath (retry needs no re-upload)', () => {
    let s = recordingJobReducer(idleJob, { type: 'ACQUIRE', id: 'j', metadata: meta });
    s = recordingJobReducer(s, { type: 'CAPTURED', blob, bytes: 10, ext: 'm4a' });
    s = recordingJobReducer(s, { type: 'UPLOAD_OK', storagePath: 'p.m4a' });
    s = recordingJobReducer(s, { type: 'TRANSCRIBE_FAILED', error: 'whisper 500' });
    expect(s.status).toBe('transcribe-failed');
    expect(s.storagePath).toBe('p.m4a');
  });

  it('oversize recording keeps the blob so it can be downloaded and split', () => {
    let s = recordingJobReducer(idleJob, { type: 'ACQUIRE', id: 'j', metadata: meta });
    s = recordingJobReducer(s, { type: 'TOO_LARGE', blob, bytes: 30_000_000, ext: 'm4a' });
    expect(s.status).toBe('too-large');
    expect(s.blob).toBe(blob);
  });
});

describe('recordingJobReducer — metadata stays current', () => {
  it('UPDATE_METADATA merges without touching the audio', () => {
    let s = recordingJobReducer(idleJob, { type: 'ACQUIRE', id: 'j', metadata: meta });
    s = recordingJobReducer(s, { type: 'CAPTURED', blob, bytes: 1, ext: 'm4a' });
    s = recordingJobReducer(s, { type: 'UPDATE_METADATA', metadata: { recordedBy: 'Caregiver B' } });
    expect(s.metadata.recordedBy).toBe('Caregiver B');
    expect(s.metadata.title).toBe('Doctor conversation');
    expect(s.blob).toBe(blob);
  });

  it('DISCARD returns to a clean idle job', () => {
    let s = recordingJobReducer(idleJob, { type: 'TOO_LARGE', blob, bytes: 1, ext: 'm4a' });
    s = recordingJobReducer(s, { type: 'DISCARD' });
    expect(s.status).toBe('idle');
    expect(s.blob).toBeUndefined();
  });
});
