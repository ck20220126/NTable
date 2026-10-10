import test from 'node:test';
import assert from 'node:assert/strict';
import { scrollbarMetrics, scrollFromThumb, resizedScrollOffset } from '../src/ntable/scrollbar.ts';

test('viewport resizing retains existing edges but never jumps intermediate positions or changed data', () => {
  assert.equal(resizedScrollOffset(700, 300, 1000, 200, 1000), 800);
  assert.equal(resizedScrollOffset(699.5, 300, 1000, 400, 1000), 600);
  assert.equal(resizedScrollOffset(250, 300, 1000, 200, 1000), 250);
  assert.equal(resizedScrollOffset(700, 300, 1000, 200, 2000), 700);
  assert.equal(resizedScrollOffset(700, 300, 1000, 200, 500), 300);
  assert.equal(resizedScrollOffset(0, 300, 300, 200, 300), 0);
});

test('scroll thumbs fit tracks at small sizes and clamp overscroll', () => {
  for (const track of [1, 10, 27, 28, 100, 320]) {
    for (const scroll of [-100, 0, 500, 1000, 2000]) {
      const thumb = scrollbarMetrics(100, 1100, track, scroll);
      assert.ok(thumb.size > 0 && thumb.size <= track);
      assert.ok(thumb.offset >= 0 && thumb.offset + thumb.size <= track);
    }
  }
  assert.equal(scrollbarMetrics(100, 100, 96, 0), null);
  assert.equal(scrollbarMetrics(100, 1100, 0, 0), null);
  assert.equal(scrollbarMetrics(0, 100, 28, 0), null);
});

test('thumb endpoints and drag mapping use actual available travel', () => {
  const start = scrollbarMetrics(300, 1300, 289, 0);
  const end = scrollbarMetrics(300, 1300, 289, 1000);
  const travel = 289 - start.size;
  assert.equal(start.offset, 0);
  assert.equal(end.offset, travel);
  assert.equal(scrollFromThumb(0, travel, 1000, travel), 1000);
  assert.equal(scrollFromThumb(500, -travel / 2, 1000, travel), 0);
  assert.equal(scrollFromThumb(500, travel, 1000, travel), 1000);
  assert.equal(scrollFromThumb(500, 999, 1000, 0), 500);
});
