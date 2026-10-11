import { describe, expect, it } from 'vitest';
import { claimBeforeTranscription } from '../../supabase/functions/transcribe-audio/claim';
import { transcriptionError } from '@/lib/transcriptionError';

describe('transcription quota responses', () => {
  it('returns 429 with a stable code for an exhausted claim, and plain UI text', async () => {
    const response = await claimBeforeTranscription(async () => ({ error: { message: 'transcription_limit_reached' } }), {});
    expect(response?.status).toBe(429);
    const body = await response!.json();
    expect(body.code).toBe('transcription_limit_reached');
    expect(transcriptionError(body, 'fallback')).toBe("Today's transcription limit for this family has been reached. Your audio is safe. Try again tomorrow.");
  });
  it('allows a successful claim to proceed', async () => {
    expect(await claimBeforeTranscription(async () => ({ error: null }), {})).toBeNull();
  });
  it('refuses other claim errors and thrown failures without leaking details', async () => {
    for (const claim of [async () => ({ error: { message: 'household_access_denied' } }), async () => { throw new Error('private details'); }]) {
      const response = await claimBeforeTranscription(claim, {});
      expect(response?.status).toBe(403);
      expect(await response!.json()).toEqual({ error: 'Audio is unavailable or you do not have access.' });
    }
  });
  it('maps missing configuration and preserves other errors', () => {
    expect(transcriptionError({ code: 'transcription_not_configured' }, 'fallback')).toBe('Transcription is not set up on this server yet. Your audio is safe.');
    expect(transcriptionError({ error: 'Upload failed' }, 'fallback')).toBe('Upload failed');
    expect(transcriptionError({}, 'fallback')).toBe('fallback');
  });
});
