import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesFilters, matchesFilter, filterOperators, isActiveFilter } from '../src/ntable/filtering.ts';

const fields = new Map([['quantity', { id: 'quantity', type: 'number' }]]);
const conditions = [
  { fieldId: 'quantity', operator: 'greaterThan', value: '10' },
  { fieldId: 'quantity', operator: 'lessThan', value: '5' },
];

test('all is the default and any matches either condition', () => {
  const row = { id: 'r', quantity: 12 };
  assert.equal(matchesFilters(row, conditions, fields), false);
  assert.equal(matchesFilters(row, conditions, fields, 'all'), false);
  assert.equal(matchesFilters(row, conditions, fields, 'any'), true);
  assert.equal(matchesFilters({ id: 'r', quantity: 7 }, conditions, fields, 'any'), false);
});

test('unfinished conditions do not make OR match every row', () => {
  const filters = [...conditions, { fieldId: 'quantity', operator: 'equals', value: '' }];
  assert.equal(matchesFilters({ id: 'r', quantity: 7 }, filters, fields, 'any'), false);
  for (const mode of ['all', 'any']) {
    assert.equal(matchesFilters({ id: 'r' }, [], fields, mode), true);
    assert.equal(matchesFilters({ id: 'r' }, filters.slice(-1), fields, mode), true);
  }
});

test('empty conditions are active without a value and zero is not empty', () => {
  assert.equal(isActiveFilter({ fieldId: 'quantity', operator: 'isEmpty', value: '' }), true);
  for (const value of [null, undefined, '', []]) assert.equal(matchesFilter(value, 'isEmpty', '', 'number'), true);
  for (const value of [0, '0', false, ['x']]) assert.equal(matchesFilter(value, 'isNotEmpty', '', 'number'), true);
});

test('number operators compare numerically and exclude contains', () => {
  assert.deepEqual(filterOperators('number').map(x => x.value), ['equals', 'notEquals', 'greaterThan', 'lessThan', 'isEmpty', 'isNotEmpty']);
  assert.equal(matchesFilter(12, 'greaterThan', '2', 'number'), true);
  assert.equal(matchesFilter(2, 'equals', '2.0', 'number'), true);
  assert.equal(matchesFilter('', 'equals', '0', 'number'), false);
  assert.equal(matchesFilter('invalid', 'notEquals', '0', 'number'), false);
});
