// backgroundRemover.js — Tolerance-based flood fill background removal
import { colorDistance } from '../utils/canvasUtils.js';

export async function removeBackground(file, options = {}, onProgress = () => {}) {
  const { tolerance = 30, feather = 2 } = options;

  onProgress(10, 'Loading image...');
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  onProgress(20, 'Reading pixel data...');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Sample background color from corners (average of 4 corners)
  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  corners.forEach(([x, y]) => {
    const i = (y * width + x) * 4;
    bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2];
  });
  bgR = Math.round(bgR / 4); bgG = Math.round(bgG / 4); bgB = Math.round(bgB / 4);

  onProgress(40, 'Removing background pixels...');

  // Mark pixels close to background color
  const mask = new Uint8Array(width * height); // 1 = background
  for (let i = 0; i < width * height; i++) {
    const px = i * 4;
    const dist = colorDistance(data[px], data[px + 1], data[px + 2], bgR, bgG, bgB);
    if (dist <= tolerance) mask[i] = 1;
  }

  onProgress(60, 'Applying flood fill...');

  // Flood fill from corners to only remove connected background
  const floodMask = new Uint8Array(width * height);
  const stack = [];
  corners.forEach(([x, y]) => {
    const idx = y * width + x;
    if (mask[idx] && !floodMask[idx]) { floodMask[idx] = 1; stack.push(idx); }
  });

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % width, y = Math.floor(idx / width);
    const neighbors = [
      idx - 1, idx + 1, idx - width, idx + width
    ];
    for (const n of neighbors) {
      if (n < 0 || n >= width * height) continue;
      const nx = n % width;
      // Prevent wrap-around
      if (Math.abs(nx - x) > 1) continue;
      if (!floodMask[n] && mask[n]) { floodMask[n] = 1; stack.push(n); }
    }
  }

  onProgress(80, 'Applying transparency...');

  // Apply transparency with optional feather
  for (let i = 0; i < width * height; i++) {
    if (floodMask[i]) {
      data[i * 4 + 3] = 0;
    }
  }

  // Simple feather pass
  if (feather > 0) {
    for (let pass = 0; pass < feather; pass++) {
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (!floodMask[idx]) {
            // Check if any neighbor is transparent
            const neighbors = [idx - 1, idx + 1, idx - width, idx + width];
            const hasTranspNeighbor = neighbors.some(n => floodMask[n]);
            if (hasTranspNeighbor) {
              data[idx * 4 + 3] = Math.round(data[idx * 4 + 3] * 0.5);
            }
          }
        }
      }
    }
  }

  onProgress(100, 'Done!');
  return imageData;
}
