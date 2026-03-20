// imageResize.js
export async function resizeImage(file, options = {}) {
  const { width, height, quality = 0.92, format } = options;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const fmt = format || file.type || 'image/jpeg';
  return new Promise(resolve => canvas.toBlob(resolve, fmt, quality));
}
