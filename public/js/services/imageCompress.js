// imageCompress.js — Quality-based compression using Canvas API
import { canvasToBlob, createOutputCanvas, outputTypeFor } from '../utils/canvasUtils.js';

/**
 * Re-encode an image at the given quality.
 * @param {Blob|ImageBitmap} source  File/Blob, or an already-decoded ImageBitmap
 * @param {{quality?: number, format?: string}} opts  format: target MIME type
 *   (defaults to the input type when the browser can encode it, else PNG)
 * @returns {Promise<Blob>} blob.type is the format actually produced
 */
export async function compressImage(source, { quality = 0.75, format } = {}) {
  const bitmap = source instanceof Blob
    ? await createImageBitmap(source, { imageOrientation: 'from-image' })
    : source;
  const fmt = format || outputTypeFor(source.type || 'image/jpeg');
  const { canvas, ctx } = createOutputCanvas(bitmap.width, bitmap.height, fmt);
  ctx.drawImage(bitmap, 0, 0);
  return canvasToBlob(canvas, fmt, quality);
}
