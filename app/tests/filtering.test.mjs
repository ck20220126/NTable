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

test('select fields offer option operators and compare option values', () => {
  assert.deepEqual(filterOperators('singleSelect').map(x => x.value), ['equals', 'notEquals', 'isEmpty', 'isNotEmpty']);
  assert.deepEqual(filterOperators('multiSelect').map(x => x.value), ['contains', 'notContains', 'isEmpty', 'isNotEmpty']);
  assert.equal(matchesFilter('ready', 'equals', 'ready', 'singleSelect'), true);
  assert.equal(matchesFilter('already', 'equals', 'ready', 'singleSelect'), false);
  assert.equal(matchesFilter('draft', 'notEquals', 'ready', 'singleSelect'), true);
  assert.equal(matchesFilter(undefined, 'notEquals', 'ready', 'singleSelect'), true);
  assert.equal(matchesFilter(['app', 'web'], 'contains', 'web', 'multiSelect'), true);
  assert.equal(matchesFilter(['webview'], 'contains', 'web', 'multiSelect'), false);
  assert.equal(matchesFilter('web', 'contains', 'web', 'multiSelect'), false);
  assert.equal(matchesFilter(['app'], 'notContains', 'web', 'multiSelect'), true);
  assert.equal(matchesFilter(null, 'notContains', 'web', 'multiSelect'), true);
});

test('select conditions match any chosen option and negatives exclude every choice', () => {
  const queries = ['web', 'app'];
  for (const [type, positive, negative, matches, misses] of [
    ['singleSelect', 'equals', 'notEquals', ['web', 'app'], ['webview', 'web,app', null, '']],
    ['multiSelect', 'contains', 'notContains', [['web'], ['app'], ['other', 'web']], [['other'], ['webview'], [], null, 'web']],
  ]) {
    for (const value of matches) {
      assert.equal(matchesFilter(value, positive, queries, type), true);
      assert.equal(matchesFilter(value, negative, queries, type), false);
    }
    for (const value of misses) {
      assert.equal(matchesFilter(value, positive, queries, type), false);
      assert.equal(matchesFilter(value, negative, queries, type), true);
    }
    assert.equal(matchesFilter(matches[0], positive, [], type), false);
    assert.equal(matchesFilter(misses[0], negative, [], type), false);
  }
});

test('option arrays compose with other rules in all and any modes without string coercion', () => {
  const schema = new Map([...fields, ['status', { id: 'status', type: 'singleSelect' }], ['tags', { id: 'tags', type: 'multiSelect' }]]);
  const status = { fieldId: 'status', operator: 'equals', value: ['draft', 'ready'] };
  const tags = { fieldId: 'tags', operator: 'contains', value: ['app', 'web'] };
  const row = { id: 'r', status: 'ready', tags: ['web'], quantity: 12 };
  assert.equal(matchesFilters(row, [status, tags, conditions[0]], schema, 'all'), true);
  assert.equal(matchesFilters({ ...row, quantity: 2 }, [status, tags, conditions[0]], schema, 'all'), false);
  assert.equal(matchesFilters({ ...row, status: 'other', tags: ['mobile'], quantity: 2 }, [status, tags, conditions[0]], schema, 'any'), false);
  assert.equal(matchesFilters({ ...row, status: 'other', quantity: 2 }, [status, tags, conditions[0]], schema, 'any'), true);
  assert.equal(matchesFilters({ ...row, status: 'draft,ready' }, [status], schema), false);
});

test('cleared option arrays are inactive in both conjunction modes', () => {
  const cleared = { fieldId: 'status', operator: 'notEquals', value: [] };
  assert.equal(isActiveFilter(cleared), false);
  assert.equal(isActiveFilter({ ...cleared, value: ['ready'] }), true);
  assert.equal(isActiveFilter({ ...cleared, operator: 'isEmpty' }), true);
  for (const mode of ['all', 'any']) {
    assert.equal(matchesFilters({ id: 'r', quantity: 7 }, [cleared], fields, mode), true);
    assert.equal(matchesFilters({ id: 'r', quantity: 7 }, [...conditions, cleared], fields, mode), false);
  }
  assert.equal(matchesFilter('a,b', 'equals', ['a', 'b'], 'text'), false);
  assert.equal(matchesFilter(1, 'equals', ['1'], 'number'), false);
});
