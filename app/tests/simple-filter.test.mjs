import test from 'node:test';
import assert from 'node:assert/strict';
import { applySimpleFilter, projectSimpleFilters, resolveSimpleFields, simpleOptionCounts, summarizeSelection, hasSimpleActive } from '../src/ntable/simpleFilter.ts';
import { defaultGetSubRows } from '../src/ntable/tree.ts';

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
const project = (filters, mode = 'all') => projectSimpleFilters(filters, mode, fieldById, simple);

test('resolveSimpleFields drops unknown, unsupported and duplicate fields', () => {
  const withDate = new Map([...fieldById, ['day', { id: 'day', title: '日期', type: 'date' }]]);
  const result = resolveSimpleFields([{ fieldId: 'nope' }, { fieldId: 'day' }, { fieldId: 'name' }, { fieldId: 'live' }, { fieldId: 'live', label: 'x' }, { fieldId: 'region' }], withDate);
  assert.deepEqual(result.map((item) => item.fieldId), ['name', 'live', 'region']);
  assert.deepEqual(resolveSimpleFields(undefined, fieldById), []);
});

test('canonical rules project to values per field', () => {
  assert.deepEqual(project([]), { ok: true, values: {} });
  assert.deepEqual(project([rule('region', 'equals', ['n', 's']), rule('tags', 'contains', ['a']), rule('live', 'equals', ['true'])]), { ok: true, values: { region: ['n', 's'], tags: ['a'], live: ['true'] } });
});

test('legacy string values count as one option and inactive rules are ignored', () => {
  assert.deepEqual(project([rule('region', 'equals', 'n')]), { ok: true, values: { region: ['n'] } });
  assert.deepEqual(project([rule('live', 'equals', 'false')]), { ok: true, values: { live: ['false'] } });
  // 空值规则、没选字段的规则都不算有效条件，哪怕写着不支持的运算符、在非简单字段上
  assert.deepEqual(project([rule('name', 'contains', ''), rule('region', 'notEquals', []), rule('', 'equals', 'x')]), { ok: true, values: {} });
  assert.deepEqual(project([rule('name', 'contains', ''), rule('region', 'equals', ['n'])], 'any'), { ok: true, values: { region: ['n'] } });
});

test('any mode is only fine with at most one active rule', () => {
  assert.deepEqual(project([rule('region', 'equals', ['n'])], 'any'), { ok: true, values: { region: ['n'] } });
  assert.deepEqual(project([rule('region', 'equals', ['n']), rule('tags', 'contains', ['a'])], 'any'), { ok: false, reasons: ['条件关系是「任意」'] });
});

test('every non-simple shape reports a reason, deduplicated and in order', () => {
  assert.deepEqual(project([rule('name', 'contains', 'x')]), { ok: false, reasons: ['有「名称」的条件'] });
  assert.deepEqual(project([rule('region', 'equals', ['n'], 'a'), rule('region', 'equals', ['s'], 'b')]), { ok: false, reasons: ['「大区」有多条条件'] });
  assert.deepEqual(project([rule('region', 'notEquals', ['n'])]), { ok: false, reasons: ['「大区」用了「不等于」'] });
  assert.deepEqual(project([rule('tags', 'notContains', ['a'])]), { ok: false, reasons: ['「标签」用了「不包含」'] });
  assert.deepEqual(project([rule('tags', 'equals', ['a'])]), { ok: false, reasons: ['「标签」用了「等于」'] });
  assert.deepEqual(project([rule('region', 'isEmpty', '')]), { ok: false, reasons: ['「大区」用了「为空」'] });
  assert.deepEqual(project([rule('live', 'isNotEmpty', '')]), { ok: false, reasons: ['「上线」用了「不为空」'] });
  assert.deepEqual(project([rule('live', 'equals', ['true', 'false'])]), { ok: false, reasons: ['「上线」同时选了是和否'] });
  assert.deepEqual(project([rule('name', 'contains', 'x', '1'), rule('name', 'contains', 'y', '2'), rule('live', 'equals', ['true', 'false']), rule('region', 'contains', ['n'])], 'any'),
    { ok: false, reasons: ['条件关系是「任意」', '有「名称」的条件', '「上线」同时选了是和否', '「大区」用了「包含」'] });
});

test('applySimpleFilter writes one canonical rule per field', () => {
  const single = applySimpleFilter([], 'all', 'region', ['n'], fieldById);
  assert.equal(single.filters.length, 1);
  assert.match(single.filters[0].id, /^[0-9a-f-]{36}$/);
  assert.deepEqual({ ...single.filters[0], id: undefined }, { id: undefined, fieldId: 'region', operator: 'equals', value: ['n'] });
  assert.equal(applySimpleFilter([], 'all', 'tags', ['a', 'b'], fieldById).filters[0].operator, 'contains');
  assert.deepEqual(applySimpleFilter([], 'all', 'live', ['true'], fieldById).filters[0].value, ['true']);
});

test('applySimpleFilter replaces in place, appends when absent and removes every rule on the field', () => {
  const name = rule('name', 'contains', 'x');
  const old1 = rule('region', 'notEquals', ['n'], 'old1');
  const old2 = rule('region', 'equals', '', 'old2');
  const tags = rule('tags', 'contains', ['a']);
  const replaced = applySimpleFilter([name, old1, tags, old2], 'all', 'region', ['s'], fieldById).filters;
  assert.deepEqual(replaced.map((item) => item.fieldId), ['name', 'region', 'tags']);
  assert.deepEqual(replaced[1].value, ['s']);
  assert.equal(replaced[1].operator, 'equals');
  assert.deepEqual(applySimpleFilter([name, tags], 'all', 'region', ['s'], fieldById).filters.map((item) => item.fieldId), ['name', 'tags', 'region']);
  assert.deepEqual(applySimpleFilter([name, old1, tags, old2], 'all', 'region', [], fieldById).filters, [name, tags]);
  assert.deepEqual(applySimpleFilter([], 'all', 'region', [], fieldById).filters, []);
});

test('applySimpleFilter turns any into all and keeps other modes', () => {
  assert.equal(applySimpleFilter([rule('region', 'equals', ['n'])], 'any', 'tags', ['a'], fieldById).filterMode, 'all');
  assert.equal(applySimpleFilter([], 'all', 'tags', ['a'], fieldById).filterMode, 'all');
  assert.equal(applySimpleFilter([], undefined, 'tags', ['a'], fieldById).filterMode, undefined);
});

test('a projection round-trips through applySimpleFilter', () => {
  let state = { filters: [], filterMode: 'any' };
  for (const [id, values] of [['region', ['n']], ['tags', ['a', 'b']], ['live', ['false']], ['region', []]]) state = applySimpleFilter(state.filters, state.filterMode, id, values, fieldById);
  assert.deepEqual(project(state.filters, state.filterMode), { ok: true, values: { tags: ['a', 'b'], live: ['false'] } });
});

test('summaries and active flag', () => {
  assert.equal(summarizeSelection([]), '全部');
  assert.equal(summarizeSelection(['A']), 'A');
  assert.equal(summarizeSelection(['A', 'B']), 'A、B');
  assert.equal(summarizeSelection(['A', 'B', 'C']), 'A、B 等 3 个');
  assert.equal(hasSimpleActive({}), false);
  assert.equal(hasSimpleActive({ region: [] }), false);
  assert.equal(hasSimpleActive({ region: ['n'] }), true);
});

test('option counts match the table projection and cascade with other filters', () => {
  const rows = [
    { id: '1', region: 'n', tags: ['a'], live: true },
    { id: '2', region: 'n', tags: ['a', 'b'], live: false },
    { id: '3', region: 's', tags: ['b'], live: true, children: [{ id: '3-1', region: 'w', tags: ['c'], live: false }] },
    { id: '4', region: 'w', tags: [], live: null },
  ];
  const view = { id: 'v', name: 'v', visibleFieldIds: ['region', 'tags', 'live'], columnOrder: ['region', 'tags', 'live'], filters: [], sorts: [{ fieldId: 'region', direction: 'desc' }] };
  const ordered = fields.slice(0, 3);
  const count = (v, fieldId, search = '') => Object.fromEntries(simpleOptionCounts(rows, v, ordered, fieldById, search, defaultGetSubRows, fieldId));
  // 子记录命中时父记录保留，按顶层记录计数
  assert.deepEqual(count(view, 'region'), { n: 2, s: 1, w: 2 });
  assert.deepEqual(count(view, 'live'), { true: 2, false: 2 });
  // 其它条件缩小范围后，选项数量联动；自己字段上的旧条件被替换而不是叠加
  const narrowed = { ...view, filters: [rule('tags', 'contains', ['a'])] };
  assert.deepEqual(count(narrowed, 'region'), { n: 2, s: 0, w: 0 });
  const own = { ...view, filters: [rule('region', 'equals', ['s'])] };
  assert.deepEqual(count(own, 'region'), { n: 2, s: 1, w: 2 });
  // 搜索框里的词也参与：搜到 N（大区「N」的显示标签）
  assert.deepEqual(count(view, 'region', 'n'), { n: 2, s: 0, w: 0 });
});

test('text fields use a contains rule with a string value', () => {
  const withText = [...simple, { fieldId: 'name' }];
  const projectText = (filters, mode = 'all') => projectSimpleFilters(filters, mode, fieldById, withText);
  assert.deepEqual(projectText([rule('name', 'contains', 'ab')]), { ok: true, values: { name: ['ab'] } });
  assert.deepEqual(projectText([rule('name', 'equals', 'ab')]), { ok: false, reasons: ['「名称」用了「等于」'] });
  assert.deepEqual(projectText([rule('name', 'contains', ['ab'])]), { ok: false, reasons: ['「名称」的条件格式不支持'] });
  // 写回：值是字符串，放在原位置；清空即删掉该字段的规则
  const written = applySimpleFilter([rule('region', 'equals', ['n']), rule('name', 'contains', 'x')], 'all', 'name', ['ab'], fieldById);
  assert.deepEqual(written.filters.map(({ id, ...rest }) => rest), [{ fieldId: 'region', operator: 'equals', value: ['n'] }, { fieldId: 'name', operator: 'contains', value: 'ab' }]);
  assert.deepEqual(applySimpleFilter(written.filters, 'all', 'name', [], fieldById).filters.map((item) => item.fieldId), ['region']);
  assert.deepEqual(applySimpleFilter(written.filters, 'all', 'name', [''], fieldById).filters.map((item) => item.fieldId), ['region']);
});
