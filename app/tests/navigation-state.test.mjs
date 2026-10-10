import test from 'node:test';
import assert from 'node:assert/strict';
import { moveGridPosition, resolveActiveRow, selectRowRange } from '../src/ntable/keyboard.ts';
import { tableDataState } from '../src/ntable/dataState.ts';

test('grid navigation includes headers and all virtual rows, with bounded edges', () => {
  const move = (position, key, edge = false) => moveGridPosition(position, key, 10000, 4, 8, edge);
  assert.deepEqual(move({row:0,column:1}, 'ArrowUp'), {row:-1,column:1});
  assert.deepEqual(move({row:-1,column:0}, 'ArrowLeft'), {row:-1,column:0});
  assert.deepEqual(move({row:0,column:1}, 'End', true), {row:9999,column:3});
  assert.deepEqual(move({row:9999,column:3}, 'Home', true), {row:-1,column:0});
  assert.deepEqual(move({row:0,column:1}, 'PageDown'), {row:8,column:1});
  assert.deepEqual(move({row:3,column:1}, 'PageUp'), {row:-1,column:1});
  assert.equal(move({row:0,column:1}, 'Tab'), null);
  assert.deepEqual(moveGridPosition({row:-1,column:0}, 'ArrowDown', 0, 1, 8, false), {row:-1,column:0});
});

test('focus follows stable record IDs, visible ancestors and removal fallback', () => {
  const row = (id, depth) => ({row:{id},depth});
  const previous = [row('p',0), row('c',1), row('g',2), row('q',0)];
  assert.equal(resolveActiveRow('g', [previous[3],...previous.slice(0,3)], previous), 3);
  assert.equal(resolveActiveRow('g', [previous[0],previous[3]], previous), 0);
  assert.equal(resolveActiveRow('g', [previous[3]], previous), 0);
  assert.equal(resolveActiveRow('g', [], previous), -1);
  assert.equal(resolveActiveRow(null, previous, []), -1);
});

test('range selection shrinks to the anchor without dropping previous independent selection', () => {
  const ids = ['a','b','c','d'];
  const base = new Set(['outside']);
  assert.deepEqual([...selectRowRange(ids, 1, 3, base)], ['outside','b','c','d']);
  assert.deepEqual([...selectRowRange(ids, 1, 2, base)], ['outside','b','c']);
  assert.deepEqual([...selectRowRange(ids, 2, 0, base)], ['outside','a','b','c']);
  assert.deepEqual([...base], ['outside']);
});

test('request states distinguish initial load, refresh, empty data and query misses', () => {
  assert.equal(tableDataState(0,0,true,'old error'), 'loading');
  assert.equal(tableDataState(2,2,true,'old error'), 'refreshing');
  assert.equal(tableDataState(0,0,false,'offline'), 'error');
  assert.equal(tableDataState(2,2,false,'offline'), 'refreshError');
  assert.equal(tableDataState(0,0,false,null), 'empty');
  assert.equal(tableDataState(2,0,false,null), 'noResults');
  assert.equal(tableDataState(2,2,false,null), 'ready');
});
