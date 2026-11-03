import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeCrop } from '../public/js/utils/cropGeometry.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const W = 400, H = 300;

test('1:1 resize into the bottom edge keeps ratio', () => {
  const r = resizeCrop({ x: 50, y: 150, w: 100, h: 100 }, 'br', 400, 400, '1:1', W, H);
  near(r.w / r.h, 1);
  assert.ok(r.y + r.h <= H + 1e-6 && r.x + r.w <= W + 1e-6);
});
test('16:9 resize past the right edge keeps ratio', () => {
  const r = resizeCrop({ x: 200, y: 20, w: 160, h: 90 }, 'br', 300, 0, '16:9', W, H);
  near(r.w / r.h, 16 / 9);
  assert.ok(r.x + r.w <= W + 1e-6);
});
test('top-left drag keeps ratio and anchors bottom-right corner', () => {
  const r = resizeCrop({ x: 100, y: 100, w: 100, h: 100 }, 'tl', -50, -10, '1:1', W, H);
  near(r.w / r.h, 1);
  near(r.x + r.w, 200); near(r.y + r.h, 200);
});
test('top-left drag to the image edge keeps ratio', () => {
  const r = resizeCrop({ x: 100, y: 100, w: 100, h: 100 }, 'tl', -500, -500, '1:1', W, H);
  near(r.w / r.h, 1);
  assert.ok(r.x >= -1e-6 && r.y >= -1e-6);
});
test('free mode unchanged', () => {
  const r = resizeCrop({ x: 10, y: 10, w: 100, h: 100 }, 'br', 50, 20, 'free', W, H);
  assert.deepEqual(r, { x: 10, y: 10, w: 150, h: 120 });
});
