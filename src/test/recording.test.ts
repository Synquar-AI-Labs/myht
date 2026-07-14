import { describe, it, expect } from 'vitest';
import {
  pickRecordingMimeType, formatDuration, describeBytes,
  MAX_TRANSCRIBABLE_BYTES, SPEECH_BITS_PER_SECOND,
} from '@/lib/recording';

describe('pickRecordingMimeType', () => {
  it('prefers webm/opus where supported (Chrome/Android)', () => {
    expect(pickRecordingMimeType(() => true)).toBe('audio/webm;codecs=opus');
  });

  it('falls back to audio/mp4 on Safari/iOS (no webm support)', () => {
    expect(pickRecordingMimeType(t => t === 'audio/mp4')).toBe('audio/mp4');
  });

  it('returns undefined when nothing matches, letting the browser choose', () => {
    expect(pickRecordingMimeType(() => false)).toBeUndefined();
  });

  it('treats a throwing isTypeSupported as unsupported', () => {
    expect(pickRecordingMimeType(() => { throw new Error('nope'); })).toBeUndefined();
  });
});

describe('formatDuration', () => {
  it('formats mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3600)).toBe('60:00');
  });
});

describe('size limits', () => {
  it('90 minutes at speech bitrate stays under the transcription cap', () => {
    const ninetyMinutesBytes = (SPEECH_BITS_PER_SECOND / 8) * 90 * 60;
    expect(ninetyMinutesBytes).toBeLessThan(MAX_TRANSCRIBABLE_BYTES);
  });

  it('describes sizes in MB', () => {
    expect(describeBytes(25 * 1024 * 1024)).toBe('25.0 MB');
  });
});
