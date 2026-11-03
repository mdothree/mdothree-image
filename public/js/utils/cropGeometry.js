// utils/cropGeometry.js — pure crop-box resize math (no DOM) so it can be unit-tested.

/**
 * Resize a crop box by dragging one corner.
 * @param {{x,y,w,h}} start  box when the drag began (display pixels)
 * @param {string} corner    contains any of 'l','r','t','b'
 * @param {number} dx @param {number} dy  pointer movement since drag start
 * @param {string} ratio     'free' or 'W:H'
 * @param {number} displayW @param {number} displayH  image display bounds
 * @param {number} [min=20]  minimum box edge
 * @returns {{x,y,w,h}}
 */
export function resizeCrop(start, corner, dx, dy, ratio, displayW, displayH, min = 20) {
  let nx = start.x, ny = start.y, nw = start.w, nh = start.h;
  if (corner.includes('r')) nw = Math.max(min, start.w + dx);
  if (corner.includes('b')) nh = Math.max(min, start.h + dy);
  if (corner.includes('l')) { nx = start.x + dx; nw = Math.max(min, start.w - dx); }
  if (corner.includes('t')) { ny = start.y + dy; nh = Math.max(min, start.h - dy); }

  if (ratio === 'free') {
    const x = Math.max(0, Math.min(nx, displayW - min));
    const y = Math.max(0, Math.min(ny, displayH - min));
    return { x, y, w: Math.min(nw, displayW - x), h: Math.min(nh, displayH - y) };
  }

  // Fixed ratio: derive height from width, keep the opposite corner anchored,
  // and clamp the WIDTH so both dimensions fit (never clamp one axis alone).
  const [rw, rh] = ratio.split(':').map(Number);
  const hasL = corner.includes('l'), hasT = corner.includes('t');
  const anchorX = hasL ? start.x + start.w : start.x;
  const anchorY = hasT ? start.y + start.h : start.y;
  const maxW = Math.min(hasL ? anchorX : displayW - anchorX, (hasT ? anchorY : displayH - anchorY) * rw / rh);
  const minW = Math.max(min, min * rw / rh);
  let w = Math.max(minW, Math.min(nw, maxW));
  if (w > maxW) w = maxW;
  const h = w * rh / rw;
  return { x: hasL ? anchorX - w : anchorX, y: hasT ? anchorY - h : anchorY, w, h };
}
