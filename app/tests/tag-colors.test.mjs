import test from 'node:test';
import assert from 'node:assert/strict';
import { TAG_COLORS, tagColor, optionTagColor } from '../src/ntable/tagColors.ts';

test('tag colors cycle the Feishu palette, then a faded round, then repeat', () => {
  assert.equal(TAG_COLORS.length, 11);
  assert.deepEqual(TAG_COLORS.map((_, index) => tagColor(index)), [...TAG_COLORS]);
  assert.equal(tagColor(11), 'rgba(254, 227, 226, 0.5)');
  assert.equal(tagColor(21), 'rgba(239, 240, 241, 0.5)');
  assert.equal(tagColor(22), TAG_COLORS[0]);
});

test('explicit option colors win; defaults follow option order; unknown values are neutral', () => {
  const options = [{ value: 'a' }, { value: 'b', color: '#123456' }, { value: 'c' }];
  assert.equal(optionTagColor(options, 'a'), TAG_COLORS[0]);
  assert.equal(optionTagColor(options, 'b'), '#123456');
  assert.equal(optionTagColor(options, 'c'), TAG_COLORS[2]);
  assert.equal(optionTagColor(options, 'missing'), TAG_COLORS[10]);
  assert.equal(optionTagColor(undefined, 'a'), TAG_COLORS[10]);
});

test('multi-select tags use option colors like single-select tags', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/ntable/Table.tsx', import.meta.url), 'utf8');
  assert.equal(source.match(/style=\{tagStyle\(optionTagColor\(field\.options,/g)?.length, 2);
});
