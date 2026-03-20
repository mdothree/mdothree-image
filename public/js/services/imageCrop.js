// imageCrop.js — Canvas crop service
export async function cropImage(sourceImg, sx, sy, sw, sh, outputFormat = 'image/jpeg', quality = 0.92) {
  if (sw <= 0 || sh <= 0) throw new Error('Crop area must have positive width and height');
  const canvas = document.createElement('canvas');
  canvas.width  = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, sw, sh);
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Crop failed')), outputFormat, quality)
  );
}

export function scaleToDisplay(naturalW, naturalH, displayW, displayH) {
  return { scaleX: naturalW / displayW, scaleY: naturalH / displayH };
}
