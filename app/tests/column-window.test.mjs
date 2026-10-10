import test from 'node:test';
import assert from 'node:assert/strict';
import { windowedColumns, fittingFrozenCount, columnGeometry, columnDropTarget } from '../src/ntable/columnWindow.ts';

test('column window retains frozen and active columns while limiting offscreen mounting', () => {
  const widths = Array(42).fill(140);
  const start = windowedColumns(widths, 0, 958, 2, [41, -1, 99]);
  assert.ok(start.includes(0) && start.includes(1) && start.includes(41));
  assert.ok(start.length < 12);
  const end = windowedColumns(widths, 4964, 958, 2, [0]);
  assert.ok(end.includes(0) && end.includes(1) && end.includes(41));
  assert.equal(end.includes(20), false);
  assert.deepEqual(windowedColumns([250,130],0,958,0),[0,1]);
  assert.deepEqual(windowedColumns([100,100],0,0,0),[0,1]);
});

test('every ordinary column intersecting the unobscured viewport is mounted', () => {
  const widths = Array.from({length:60},(_,index) => 88 + index*7);
  for (const frozenCount of [0,1,3]) {
    const boundary = 42 + widths.slice(0,frozenCount).reduce((a,b)=>a+b,0);
    for (let offset=0;offset<14000;offset+=93) {
      const mounted = windowedColumns(widths,offset,900,frozenCount);
      let left = 42;
      widths.forEach((width,index) => {
        if (index >= frozenCount && left+width > offset+boundary && left < offset+900) assert.ok(mounted.includes(index));
        left += width;
      });
    }
  }
});

test('narrow viewports keep an ordinary field accessible and restore configured freezing', () => {
  const widths=[250,130,140,140];
  assert.equal(fittingFrozenCount(widths,2,900),2);
  assert.equal(fittingFrozenCount(widths,2,500),1);
  assert.equal(fittingFrozenCount(widths,2,320),0);
  assert.equal(fittingFrozenCount(widths,2,562),2);
  assert.equal(fittingFrozenCount(widths,2,561),1);
  assert.equal(fittingFrozenCount(widths,2,0),2);
  assert.equal(fittingFrozenCount([140],2,900),0);
  assert.equal(fittingFrozenCount([],2,900),0);
  assert.equal(fittingFrozenCount([2000,140],1,900),0);
});


test('column geometry preserves unequal widths, gutter and end insertion boundary', () => {
  assert.deepEqual(columnGeometry([180, 110, 160]), {
    offsets: [42, 222, 332, 492], totalWidth: 492,
    gridTemplate: '42px 180px 110px 160px',
  });
  assert.deepEqual(columnGeometry([]), { offsets: [42], totalWidth: 42, gridTemplate: '42px' });
  let reads = 0;
  const widths = Array.from({ length: 10000 }, (_, index) => index % 2 ? 110 : 180);
  const tracked = new Proxy(widths, { get(target, key, receiver) {
    if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
    return Reflect.get(target, key, receiver);
  } });
  const geometry = columnGeometry(tracked);
  assert.equal(reads, widths.length);
  assert.equal(geometry.offsets.length, widths.length + 1);
  assert.equal(geometry.totalWidth, 1450042);
});


test('drag targets use visible frozen boundaries after horizontal scrolling', () => {
  const offsets=columnGeometry([250,130,...Array(40).fill(140)]).offsets;
  assert.deepEqual(columnDropTarget(offsets,2,5064,393),{slot:2,left:5486});
  assert.deepEqual(columnDropTarget(offsets,2,5064,100),{slot:0,left:5106});
  assert.deepEqual(columnDropTarget(offsets,2,5064,320),{slot:1,left:5356});
  const ordinary=columnDropTarget(offsets,2,5064,500);
  assert.ok(ordinary.slot>2);assert.ok(ordinary.left>=5486);
  assert.deepEqual(columnDropTarget(offsets,0,0,393),{slot:2,left:422});
  assert.deepEqual(columnDropTarget([42],0,100,10),{slot:0,left:42});
});
