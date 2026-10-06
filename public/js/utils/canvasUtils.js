// canvasUtils.js — Shared canvas utilities for mdothree-image

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function loadImageBitmap(file) {
  return createImageBitmap(file);
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, type, quality);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  // Revoking synchronously can cancel the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Output formats ─────────────────────────────────────────────────────────
// Canvas can only encode a few formats, and which ones varies by browser
// (e.g. older Safari has no WebP encoder and silently returns PNG bytes).
// No browser encodes GIF or SVG. Always name files from the blob's real type.

const EXT_FOR_TYPE = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };
const ENCODABLE = ['image/jpeg', 'image/png', 'image/webp'];
const _encodeSupport = {};

export function extensionFor(type) {
  return EXT_FOR_TYPE[type] || 'png';
}

export function canEncode(type) {
  if (type === 'image/png') return true;
  if (!ENCODABLE.includes(type)) return false;
  if (type in _encodeSupport) return _encodeSupport[type];
  let ok = false;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    ok = c.toDataURL(type).startsWith(`data:${type}`);
  } catch (e) { ok = false; }
  _encodeSupport[type] = ok;
  return ok;
}

/** Best encodable output type for a given input type ("Same as input"). */
export function outputTypeFor(inputType) {
  return canEncode(inputType) ? inputType : 'image/png';
}

/** Disable <option>s whose format this browser cannot encode. */
export function disableUnsupportedFormats(select) {
  if (!select) return;
  for (const opt of select.options) {
    if (opt.value.startsWith('image/') && !canEncode(opt.value)) {
      opt.disabled = true;
      if (!/not supported/.test(opt.textContent)) opt.textContent += ' (not supported in this browser)';
    }
  }
  if (select.selectedOptions[0]?.disabled) {
    const first = Array.from(select.options).find(o => !o.disabled);
    if (first) select.value = first.value;
  }
}

/**
 * Create a canvas for encoding to `type`. JPEG has no alpha channel, so
 * transparent pixels would turn black: fill white first for JPEG only
 * (PNG and WebP keep transparency).
 */
export function createOutputCanvas(width, height, type) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
  return { canvas, ctx };
}

export function isImageFile(file) {
  return !!file && ((file.type || '').startsWith('image/') ||
    /\.(jpe?g|png|gif|webp|bmp|avif|svg)$/i.test(file.name || ''));
}

export function baseName(name) {
  return (name || 'image').replace(/\.[^.]+$/, '');
}

// Draw image centered + fitted to canvas
export function drawFitted(ctx, img, canvasW, canvasH) {
  const scale = Math.min(canvasW / img.width, canvasH / img.height);
  const x = (canvasW - img.width * scale) / 2;
  const y = (canvasH - img.height * scale) / 2;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

// Color distance in RGB space
export function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
