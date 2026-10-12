// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readBoundedBody, parsePhotoRequest, isJpeg, PhotoInvalid, RequestTooLarge, MAX_PHOTO_BYTES } from '../../supabase/functions/read-prescription/request';
import { validatePrescription, ReaderFailed } from '../../supabase/functions/read-prescription/validation';
import { prescriptionRequest, readCompletion, reportedTokens, safeErrorType, photoBase64 } from '../../supabase/functions/read-prescription/upstream';
import { claimBeforePrescription } from '../../supabase/functions/read-prescription/claim';

const medicine = { name: ' Synthetic tablet ', strength: '5 mg', amount: '1 tablet', days: 'daily', every_days: null, times_per_day: 2, every_hours: null, instructions: 'after meals', duration: 'for 7 days', unsure: [], source_text: 'Synthetic tablet 5 mg', photos: [1] };
const result = (entry = medicine) => ({ is_prescription: true, medicines: [entry] });
const jpeg = new Uint8Array([255, 216, 255, 224, 0, 0]);
const request = (photos: Blob[], household = 'synthetic-household') => {
  const form = new FormData(); form.set('household_id', household);
  photos.forEach((photo, i) => form.append('photo', photo, `${i}.jpg`));
  return new Request('http://localhost/read', { method: 'POST', body: form });
};
describe('bounded photo request', () => {
  it('rejects the declared length before consuming the body', async () => {
    const req = new Request('http://localhost/read', { method: 'POST', body: 'hello', headers: { 'content-length': '100' } });
    await expect(readBoundedBody(req, 10)).rejects.toBeInstanceOf(RequestTooLarge);
    expect(req.bodyUsed).toBe(false);
  });
  it('bounds an undeclared streaming body and cancels it', async () => {
    let cancelled = false;
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(8)); controller.enqueue(new Uint8Array(8)); }, cancel() { cancelled = true; } });
    const req = new Request('http://localhost/read', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
    await expect(readBoundedBody(req, 10)).rejects.toBeInstanceOf(RequestTooLarge);
    expect(cancelled).toBe(true);
  });
  it('keeps the exact bytes at the limit', async () => {
    expect(await readBoundedBody(new Request('http://localhost/read', { method: 'POST', body: jpeg }), 6)).toEqual(jpeg);
  });
  it('validates JPEG magic rather than trusting the extension or MIME type', async () => {
    expect(isJpeg(jpeg)).toBe(true); expect(isJpeg(new Uint8Array([137, 80, 78, 71]))).toBe(false);
    await expect(parsePhotoRequest(request([new Blob(['not a photo'], { type: 'image/jpeg' })]))).rejects.toBeInstanceOf(PhotoInvalid);
  });
  it.each([1, 4])('parses %s ordered files', async count => {
    const parsed = await parsePhotoRequest(request(Array.from({ length: count }, () => new Blob([jpeg]))));
    expect(parsed.photos.map(photo => photo.name)).toEqual(Array.from({ length: count }, (_, i) => `${i}.jpg`));
  });
  it.each([0, 5])('rejects %s files', async count => {
    await expect(parsePhotoRequest(request(Array.from({ length: count }, () => new Blob([jpeg]))))).rejects.toBeInstanceOf(PhotoInvalid);
  });
  it('rejects a file over the per-photo cap', async () => {
    await expect(parsePhotoRequest(request([new Blob([jpeg, new Uint8Array(MAX_PHOTO_BYTES)])]))).rejects.toBeInstanceOf(PhotoInvalid);
  });
});
describe('prescription validation', () => {
  it('trims text, bounds lengths and combines instructions/duration within 300', () => {
    const med = validatePrescription(result({ ...medicine, name: 'x'.repeat(121), strength: 'x'.repeat(61), amount: 'x'.repeat(61), instructions: 'x'.repeat(299), duration: 'for 7 days', source_text: 'x'.repeat(301) }), 1).medicines[0];
    expect([med.name.length, med.strength.length, med.amount.length, med.source_text.length]).toEqual([120, 60, 60, 300]);
    expect([med.instructions, med.duration].filter(Boolean).join(', ').length).toBeLessThanOrEqual(300);
    expect(med.duration).toBe(''); expect(med.unsure).toEqual(expect.arrayContaining(['name', 'strength', 'amount', 'instructions']));
    expect(validatePrescription(result(), 1).medicines[0].name).toBe('Synthetic tablet');
  });
  it.each([null, {}, { is_prescription: true, medicines: 'wrong' }, result({ ...medicine, name: 3 } as unknown as typeof medicine)])('rejects malformed answers', value => {
    expect(() => validatePrescription(value, 1)).toThrow(ReaderFailed);
  });
  it('handles non-prescriptions and drops entries with no name or source', () => {
    expect(validatePrescription({ is_prescription: false, medicines: [] }, 1).medicines).toEqual([]);
    expect(validatePrescription(result({ ...medicine, name: '', source_text: '' }), 1).medicines).toEqual([]);
  });
  it('keeps at most 30 entries', () => {
    expect(validatePrescription({ is_prescription: true, medicines: Array.from({ length: 31 }, () => medicine) }, 1).medicines).toHaveLength(30);
  });
  it('filters source photo numbers, removes duplicates and falls back to all', () => {
    expect(validatePrescription(result({ ...medicine, photos: [4, 2, 2, 0, 5, 1.5] }), 4).medicines[0].photos).toEqual([2, 4]);
    expect(validatePrescription(result({ ...medicine, photos: [99] }), 3).medicines[0].photos).toEqual([1, 2, 3]);
  });
  it('bounds numeric fields, marks invalid values and limits every-days to its own frequency', () => {
    const med = validatePrescription(result({ ...medicine, days: 'every_n_days', every_days: 8, times_per_day: 25, every_hours: 13 }), 1).medicines[0];
    expect([med.every_days, med.times_per_day, med.every_hours]).toEqual([null, null, null]); expect(med.unsure).toEqual(expect.arrayContaining(['days', 'times']));
    expect(validatePrescription(result({ ...medicine, every_days: 3 }), 1).medicines[0].every_days).toBeNull();
    expect(validatePrescription(result({ ...medicine, days: 'every_n_days', every_days: 2, times_per_day: 1, every_hours: 12 }), 1).medicines[0]).toMatchObject({ every_days: 2, times_per_day: 1, every_hours: 12 });
    expect(validatePrescription(result({ ...medicine, days: 'unknown' }), 1).medicines[0].unsure).toContain('days');
  });
  it.each([0, -1, 1.5, '2'])('rejects lower/non-integer time bounds %s without coercion', value => {
    const med = validatePrescription({ is_prescription: true, medicines: [{ ...medicine, days: 'every_n_days', every_days: value, times_per_day: value, every_hours: value }] }, 1).medicines[0];
    expect([med.every_days, med.times_per_day, med.every_hours]).toEqual([null, null, null]);
    expect(med.unsure).toEqual(expect.arrayContaining(['days', 'times']));
  });
});
describe('upstream boundaries without a key or network', () => {
  it('builds one ordered high-detail request, explicitly unstored, with a strict schema', () => {
    const body = prescriptionRequest(['first', 'second']);
    expect(body).toMatchObject({ model: 'gpt-5.2', store: false, max_completion_tokens: 6000 });
    expect(body).not.toHaveProperty('temperature');
    expect(body.messages[1].content).toEqual(['first', 'second'].map(photo => ({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${photo}`, detail: 'high' } })));
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.response_format.json_schema.schema.additionalProperties).toBe(false);
    expect(body.response_format.json_schema.schema.properties.medicines.items.required).toContain('photos');
  });
  it('rejects refusals, cut-off output and invalid JSON; accepts only validated content', () => {
    for (const value of [null, { choices: [{ finish_reason: 'length', message: { content: '{}' } }] }, { choices: [{ finish_reason: 'stop', message: { refusal: 'No' } }] }, { choices: [{ finish_reason: 'stop', message: { content: 'not JSON' } }] }]) expect(() => readCompletion(value, 1)).toThrow(ReaderFailed);
    expect(readCompletion({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result()) } }] }, 1).medicines).toHaveLength(1);
  });
  it('keeps only numeric usage counts and a bounded machine error type for logs', () => {
    expect(reportedTokens({ usage: { prompt_tokens: 123, completion_tokens: 'private text', total_tokens: -1 } })).toEqual({ prompt_tokens: 123, completion_tokens: 0, total_tokens: 0 });
    expect(safeErrorType({ error: { type: 'invalid_request_error', message: 'private text' } })).toBe('invalid_request_error');
    expect(safeErrorType({ error: { type: 'Private medicine text' } })).toBe('unknown');
    expect(photoBase64(jpeg)).toBe(Buffer.from(jpeg).toString('base64'));
  });
  it('maps real claim error shapes to 429 or one generic refusal', async () => {
    const limited = await claimBeforePrescription(async () => ({ error: { message: 'prescription_limit_reached' } }), {});
    expect(limited!.status).toBe(429); expect(await limited!.json()).toMatchObject({ code: 'prescription_limit_reached' });
    const refused = await claimBeforePrescription(async () => ({ error: { message: 'household_access_denied' } }), {});
    expect(refused!.status).toBe(403); expect(await refused!.json()).toEqual({ error: 'Reading is unavailable or you do not have access.' });
    expect(await claimBeforePrescription(async () => ({ error: null }), {})).toBeNull();
  });
});
