// imageCompress.js — Quality-based compression using Canvas API
export async function compressImage(file, { quality = 0.75, format } = {}) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width  = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  const fmt = format || file.type || 'image/jpeg';
  if (fmt !== 'image/png') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), fmt, quality)
  );
}
