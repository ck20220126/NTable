import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDateValue } from '../src/ntable/dateFormat.ts';
import { matchesFilter } from '../src/ntable/filtering.ts';
import { recordComparator } from '../src/ntable/sorting.ts';

const now = new Date(2026, 10, 3, 12, 0, 0);

test('date times drop the current year and seconds', () => {
  assert.equal(formatDateValue(new Date(2026, 10, 3, 0, 53, 19).toISOString(), now), '11/3 00:53');
  assert.equal(formatDateValue(new Date(2025, 0, 5, 9, 4, 59).toISOString(), now), '2025/1/5 09:04');
});

test('date-only values stay on their calendar day without a time', () => {
  assert.equal(formatDateValue('2026-10-05', now), '10/5');
  assert.equal(formatDateValue('2027-01-31', now), '2027/1/31');
});

test('empty and unparseable values', () => {
  assert.equal(formatDateValue(null, now), '');
  assert.equal(formatDateValue('', now), '');
  assert.equal(formatDateValue('待定', now), '待定');
});

test('date text filters match the shown text', () => {
  const value = new Date(new Date().getFullYear(), 10, 3, 0, 53, 19).toISOString();
  assert.equal(matchesFilter(value, 'contains', '11/3 00:53', 'date'), true);
  assert.equal(matchesFilter(value, 'contains', ':19', 'date'), false);
});

test('date sorting uses raw values, so years order correctly even when the year is hidden', () => {
  const fields = new Map([['at', { id: 'at', title: '时间', type: 'date' }]]);
  const rows = [{ id: 'old', at: '2025-12-30T10:00:00.000Z' }, { id: 'new', at: '2026-01-05T10:00:00.000Z' }];
  const sorted = [...rows].sort(recordComparator([{ fieldId: 'at', direction: 'desc' }], fields));
  assert.deepEqual(sorted.map((row) => row.id), ['new', 'old']);
});
