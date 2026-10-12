import type { Page } from '@playwright/test';
export const sourceMarker = 'Synthetic photo-only source marker';
export const photoMedicine = (overrides: Record<string, unknown> = {}) => ({ name: 'Synthetic photo medicine', strength: '5 mg', amount: '1 tablet', days: 'daily', every_days: null, times_per_day: 2, every_hours: 8, instructions: 'after meals', duration: 'for 7 days', unsure: ['strength'], source_text: sourceMarker + ' — synthetic tablet instructions', photos: [1, 2], ...overrides });
export const photoResult = { is_prescription: true, medicines: [
  photoMedicine(),
  photoMedicine({ source_text: 'Same medicine read twice', photos: [2] }),
  photoMedicine({ name: 'Synthetic interval medicine', days: 'every_n_days', every_days: 3, every_hours: null, unsure: ['strength', 'days'], source_text: 'Interval prescription line', photos: [1, 2] }),
  photoMedicine({ name: 'Existing synthetic tablet 500mg', every_hours: null, source_text: 'Already recorded prescription line', photos: [3] }),
  photoMedicine({ name: 'Discard synthetic tablet', every_hours: null, source_text: 'A line to remove', photos: [4] }),
] };
export async function syntheticPhoto(page: Page, name = 'synthetic', color = '#ffffff', width = 4000, height = 3000) {
  const encoded = await page.evaluate(({ name, color, width, height }) => {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d')!; context.fillStyle = color; context.fillRect(0, 0, width, height);
    context.fillStyle = '#111'; context.font = '80px sans-serif'; context.fillText(`Synthetic prescription ${name}`, 100, 150);
    return canvas.toDataURL('image/png').split(',')[1];
  }, { name, color, width, height });
  return { name: name + '.png', mimeType: 'image/png', buffer: Buffer.from(encoded, 'base64') };
}
export async function choosePhotos(page: Page, files: Awaited<ReturnType<typeof syntheticPhoto>>[]) {
  await page.getByLabel('Choose prescription photos').setInputFiles(files);
  await page.getByText('Preparing photos…', { exact: true }).waitFor({ state: 'hidden' });
}
