export const MAX_PREPARED_PHOTO_BYTES = 1.5 * 1024 * 1024;
export const PHOTO_OPEN_ERROR = 'This photo cannot be opened here. Take a new photo, or choose a JPEG or PNG.';
export function photoDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error(PHOTO_OPEN_ERROR);
  const scale = Math.min(1, 2048 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
export async function preparePhoto(file: File): Promise<Blob> {
  let image: ImageBitmap | HTMLImageElement | undefined;
  let temporary: string | undefined;
  try {
    try { image = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      temporary = URL.createObjectURL(file);
      const fallback = new Image(); fallback.src = temporary;
      await fallback.decode(); image = fallback;
    }
    const dimensions = photoDimensions(image instanceof HTMLImageElement ? image.naturalWidth : image.width, image instanceof HTMLImageElement ? image.naturalHeight : image.height);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width; canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(PHOTO_OPEN_ERROR);
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.92, 0.8, 0.68, 0.56, 0.44, 0.32, 0.2, 0.08]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.type === 'image/jpeg' && blob.size <= MAX_PREPARED_PHOTO_BYTES) return blob;
    }
    throw new Error(PHOTO_OPEN_ERROR);
  } catch { throw new Error(PHOTO_OPEN_ERROR); }
  finally { if (image && 'close' in image) image.close(); if (temporary) URL.revokeObjectURL(temporary); }
}
