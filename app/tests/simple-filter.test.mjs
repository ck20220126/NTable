import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSimpleFields, simpleFilterRules, simpleOptionCounts, summarizeSelection, hasSimpleActive } from '../src/ntable/simpleFilter.ts';
import { defaultGetSubRows, projectTree } from '../src/ntable/tree.ts';

const options = (...values) => values.map((value) => ({ value, label: value.toUpperCase() }));
const fields = [
  { id: 'region', title: '大区', type: 'singleSelect', options: options('n', 's', 'w') },
  { id: 'tags', title: '标签', type: 'multiSelect', options: options('a', 'b', 'c') },
  { id: 'live', title: '上线', type: 'boolean' },
  { id: 'name', title: '名称', type: 'text' },
];
const fieldById = new Map(fields.map((field) => [field.id, field]));
const simple = [{ fieldId: 'region' }, { fieldId: 'tags' }, { fieldId: 'live' }];
const rule = (fieldId, operator, value, id = `${fieldId}-${operator}`) => ({ id, fieldId, operator, value });

test('resolveSimpleFields drops unknown, unsupported and duplicate fields', () => {
  const withDate = new Map([...fieldById, ['day', { id: 'day', title: '日期', type: 'date' }]]);
  const result = resolveSimpleFields([{ fieldId: 'nope' }, { fieldId: 'day' }, { fieldId: 'name' }, { fieldId: 'live' }, { fieldId: 'live', label: 'x' }, { fieldId: 'region' }], withDate);
  assert.deepEqual(result.map((item) => item.fieldId), ['name', 'live', 'region']);
  assert.deepEqual(resolveSimpleFields(undefined, fieldById), []);
});

test('simpleFilterRules maps values to canonical rules with stable ids', () => {
  assert.deepEqual(simpleFilterRules({ region: ['n', 's'], tags: ['a'], live: ['true'], name: ['ab'] }, fieldById), [
    { id: 'simple:region', fieldId: 'region', operator: 'equals', value: ['n', 's'] },
    { id: 'simple:tags', fieldId: 'tags', operator: 'contains', value: ['a'] },
    { id: 'simple:live', fieldId: 'live', operator: 'equals', value: ['true'] },
    { id: 'simple:name', fieldId: 'name', operator: 'contains', value: 'ab' },
  ]);
  // 空值、未知字段、不支持的字段类型都跳过
  const withDate = new Map([...fieldById, ['day', { id: 'day', title: '日期', type: 'date' }]]);
  assert.deepEqual(simpleFilterRules({ region: [], name: [''], nope: ['x'], day: ['2026-01-01'] }, withDate), []);
  assert.deepEqual(simpleFilterRules(undefined, fieldById), []);
});

test('extra filters narrow the view with AND, even when the view uses any', () => {
  const rows = [
    { id: '1', region: 'n', tags: ['a'] },
    { id: '2', region: 's', tags: ['b'] },
    { id: '3', region: 'w', tags: ['a'] },
  ];
  const view = { id: 'v', name: 'v', visibleFieldIds: ['region'], columnOrder: ['region'], filters: [rule('region', 'equals', ['n']), rule('region', 'equals', ['s'], 'r2')], filterMode: 'any', sorts: [] };
  const ids = (extra) => projectTree(rows, view, fields.slice(0, 1), fieldById, '', new Set(), defaultGetSubRows, extra).matchedRoots.map((row) => row.id);
  assert.deepEqual(ids(), ['1', '2']);
  assert.deepEqual(ids(simpleFilterRules({ tags: ['a'] }, fieldById)), ['1']);
  // 视图没有条件时，额外条件单独生效
  assert.deepEqual(projectTree(rows, { ...view, filters: [] }, fields.slice(0, 1), fieldById, '', new Set(), defaultGetSubRows, simpleFilterRules({ tags: ['a'] }, fieldById)).matchedRoots.map((row) => row.id), ['1', '3']);
});

test('summaries and active flag', () => {
  assert.equal(summarizeSelection([]), '全部');
  assert.equal(summarizeSelection(['A']), 'A');
  assert.equal(summarizeSelection(['A', 'B']), 'A、B');
  assert.equal(summarizeSelection(['A', 'B', 'C']), 'A、B 等 3 个');
  assert.equal(hasSimpleActive({}), false);
  assert.equal(hasSimpleActive({ region: [] }), false);
  assert.equal(hasSimpleActive({ name: [''] }), false);
  assert.equal(hasSimpleActive({ region: ['n'] }), true);
});

test('option counts match the table projection and cascade with view filters and other simple values', () => {
  const rows = [
    { id: '1', region: 'n', tags: ['a'], live: true },
    { id: '2', region: 'n', tags: ['a', 'b'], live: false },
    { id: '3', region: 's', tags: ['b'], live: true, children: [{ id: '3-1', region: 'w', tags: ['c'], live: false }] },
    { id: '4', region: 'w', tags: [], live: null },
  ];
  const view = { id: 'v', name: 'v', visibleFieldIds: ['region', 'tags', 'live'], columnOrder: ['region', 'tags', 'live'], filters: [], sorts: [{ fieldId: 'region', direction: 'desc' }] };
  const ordered = fields.slice(0, 3);
  const count = (v, fieldId, values = {}, search = '') => Object.fromEntries(simpleOptionCounts(rows, v, ordered, fieldById, search, defaultGetSubRows, fieldId, values));
  // 子记录命中时父记录保留，按顶层记录计数
  assert.deepEqual(count(view, 'region'), { n: 2, s: 1, w: 2 });
  assert.deepEqual(count(view, 'live'), { true: 2, false: 2 });
  // 视图条件照常缩小范围
  assert.deepEqual(count({ ...view, filters: [rule('tags', 'contains', ['a'])] }, 'region'), { n: 2, s: 0, w: 0 });
  // 其它简单筛选的值联动；自己字段上已选的值被替换而不是叠加
  assert.deepEqual(count(view, 'region', { tags: ['a'] }), { n: 2, s: 0, w: 0 });
  assert.deepEqual(count(view, 'region', { region: ['s'] }), { n: 2, s: 1, w: 2 });
  // 视图里同字段的条件仍然生效（两者同时满足）
  assert.deepEqual(count({ ...view, filters: [rule('region', 'equals', ['s'])] }, 'region'), { n: 0, s: 1, w: 0 });
  // 搜索框里的词也参与：搜到 N（大区「N」的显示标签）
  assert.deepEqual(count(view, 'region', {}, 'n'), { n: 2, s: 0, w: 0 });
});
