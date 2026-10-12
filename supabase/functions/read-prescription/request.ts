export const MAX_REQUEST_BYTES = 9 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export class PhotoInvalid extends Error {}
export class RequestTooLarge extends Error {}
export const isJpeg = (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

export async function readBoundedBody(request: Request, limit = MAX_REQUEST_BYTES): Promise<Uint8Array> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) throw new RequestTooLarge();
  if (!request.body) throw new PhotoInvalid();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        throw new RequestTooLarge();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function parsePhotoRequest(request: Request) {
  const bytes = await readBoundedBody(request);
  let form: FormData;
  try { form = await new Response(bytes, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData(); }
  catch { throw new PhotoInvalid(); }
  if ([...form.keys()].some(key => key !== 'household_id' && key !== 'photo')) throw new PhotoInvalid();
  const households = form.getAll('household_id');
  const photos = form.getAll('photo');
  if (households.length !== 1 || typeof households[0] !== 'string' || !households[0].trim() || photos.length < 1 || photos.length > 4) throw new PhotoInvalid();
  for (const photo of photos) {
    if (!(photo instanceof File) || photo.size > MAX_PHOTO_BYTES || !isJpeg(new Uint8Array(await photo.slice(0, 3).arrayBuffer()))) throw new PhotoInvalid();
  }
  return { householdId: households[0], photos: photos as File[] };
}
