import test from 'node:test';
import assert from 'node:assert/strict';
import { projectTree, TreeProjectionCache, collectRecordIds, collectDefaultExpanded, selectionState, toggleVisibleSelection } from '../src/ntable/tree.ts';
const fields = [{ id: 'name', title: '名称', type: 'text' }];
const byId = new Map(fields.map(field => [field.id, field]));
const view = { id: 'all', name: '全部', visibleFieldIds: ['name'], columnOrder: ['name'], filters: [], sorts: [] };
const getChildren = row => row.children ?? [];
const rows = [{ id: 'p', name: 'parent', children: [{ id: 'c2', name: 'child 2' }, { id: 'c1', name: 'child 1', children: [{ id: 'g', name: 'needle' }] }] }, { id: 'q', name: 'other' }];
const project = (overrides = {}, search = '', expanded = new Set()) => projectTree(rows, { ...view, ...overrides }, fields, byId, search, expanded, getChildren);
test('collapsed tree counts all records and expanded rows preserve levels', () => {
  assert.deepEqual(project().rows.map(item => item.row.id), ['p', 'q']);
  assert.equal(project().matchedCount, 5);
  assert.deepEqual(project({}, '', new Set(['p', 'c1'])).rows.map(item => [item.row.id, item.depth]), [['p', 0], ['c2', 1], ['c1', 1], ['g', 2], ['q', 0]]);
  assert.deepEqual([...collectRecordIds(rows, getChildren)], ['p', 'c2', 'c1', 'g', 'q']);
});
test('descendant search keeps ancestors and parent search keeps subtree', () => {
  assert.deepEqual(project({}, 'needle').rows.map(item => item.row.id), ['p', 'c1', 'g']);
  assert.deepEqual(project({}, 'parent').rows.map(item => item.row.id), ['p', 'c2', 'c1', 'g']);
});
test('sorting changes siblings without mutating source', () => {
  assert.deepEqual(project({ sorts: [{ fieldId: 'name', direction: 'asc' }] }, '', new Set(['p', 'c1'])).rows.map(item => item.row.id), ['q', 'p', 'c1', 'g', 'c2']);
  assert.deepEqual(rows[0].children.map(row => row.id), ['c2', 'c1']);
});
test('select search matches labels and raw values, respecting field visibility and search exclusions', () => {
  const schema = [
    { id: 'status', type: 'singleSelect', options: [{ value: 'draft', label: '待处理' }] },
    { id: 'tags', type: 'multiSelect', options: [{ value: 'web', label: 'Website' }] },
    { id: 'secret', type: 'singleSelect', searchable: false, options: [{ value: 'private', label: '私密' }] },
  ];
  const records = [{ id: 'normal', status: 'draft', tags: ['web'], secret: 'private' }, { id: 'unknown', status: 'missing', tags: ['legacy'] }, { id: 'empty', status: null, tags: [] }];
  const map = new Map(schema.map(field => [field.id, field]));
  const search = (query, visible = schema) => projectTree(records, view, visible, map, query, new Set(), getChildren).rows.map(item => item.row.id);
  for (const query of ['待处理', 'DRAFT', 'website', ' WEB ']) assert.deepEqual(search(query), ['normal']);
  for (const query of ['missing', 'legacy']) assert.deepEqual(search(query), ['unknown']);
  for (const query of ['私密', 'private']) assert.deepEqual(search(query), []);
  assert.deepEqual(search('待处理', schema.slice(1)), []);
  assert.deepEqual(search('draft', schema.slice(1)), []);
  assert.deepEqual(search('未配置标签'), []);
});
test('label search keeps tree ancestry and still combines with raw-value filters', () => {
  const schema = [{ id: 'status', type: 'singleSelect', options: [{ value: 'draft', label: '待处理' }] }];
  const map = new Map(schema.map(field => [field.id, field]));
  const records = [{ id: 'parent', status: 'unknown', children: [{ id: 'child', status: 'draft' }] }];
  const search = filters => projectTree(records, { ...view, filters }, schema, map, '待处理', new Set(), getChildren).rows.map(item => item.row.id);
  assert.deepEqual(search([]), ['parent', 'child']);
  assert.deepEqual(search([{ fieldId: 'status', operator: 'equals', value: 'draft' }]), ['parent', 'child']);
  assert.deepEqual(search([{ fieldId: 'status', operator: 'equals', value: '待处理' }]), []);
});
test('number sorting handles negatives, decimals and missing values in both directions', () => {
  const numericFields = [{ id: 'quantity', title: '数量', type: 'number' }];
  const map = new Map(numericFields.map(field => [field.id, field]));
  const values = [null, -2, 1.2, -10, '', 1.11, 0, '2', undefined, NaN, 'invalid', false];
  const records = values.map((quantity, index) => ({ id: String(index), quantity }));
  const sorted = direction => projectTree(records, { ...view, sorts: [{ fieldId: 'quantity', direction }] }, numericFields, map, '', new Set(), getChildren).rows.map(item => item.row.id);
  assert.deepEqual(sorted('asc'), ['3', '1', '6', '5', '2', '7', '0', '4', '8', '9', '10', '11']);
  assert.deepEqual(sorted('desc'), ['7', '2', '5', '6', '1', '3', '0', '4', '8', '9', '10', '11']);
  assert.deepEqual(records.map(row => row.quantity), values);
});
test('multiple numeric sort priorities apply inside each sibling group', () => {
  const schema = [{ id: 'quantity', type: 'number' }, { id: 'name', type: 'text' }];
  const records = [{ id: 'p', quantity: 5, name: 'p', children: [{ id: 'c1', quantity: 1.2 }, { id: 'c2', quantity: -10 }] }, { id: 'a', quantity: 0, name: 'A' }, { id: 'b', quantity: 0, name: 'B' }];
  const result = projectTree(records, { ...view, sorts: [{ fieldId: 'quantity', direction: 'asc' }, { fieldId: 'name', direction: 'desc' }] }, schema, new Map(schema.map(field => [field.id, field])), '', new Set(['p']), getChildren);
  assert.deepEqual(result.rows.map(item => item.row.id), ['b', 'a', 'p', 'c2', 'c1']);
});
test('parent matches visit each descendant once and retain unmatched subtrees', () => {
  let root = { id: 'leaf', name: 'unmatched' };
  for (let index = 0; index < 150; index++) root = { id: String(index), name: 'needle', children: [root] };
  let calls = 0;
  const result = projectTree([root], view, fields, byId, 'needle', new Set(), row => { calls++; return getChildren(row); });
  assert.equal(calls, 151);
  assert.equal(result.matchedCount, 151);
  assert.equal(result.rows.length, 151);
  assert.equal(result.rows.at(-1).row.id, 'leaf');
});
test('cache invalidates getter, schema and data and bounds projections', () => {
  const cache = new TreeProjectionCache();
  const result = project();
  cache.get('first', rows, fields, getChildren); cache.set('first', result);
  assert.equal(cache.get('first', rows, fields, getChildren), result);
  const alternate = row => row.related ?? [];
  assert.equal(cache.get('first', rows, fields, alternate), undefined);
  cache.set('first', result);
  assert.equal(cache.get('first', [...rows], fields, alternate), undefined);
  cache.set('first', result);
  assert.equal(cache.get('first', rows, [...fields], alternate), undefined);
  cache.get('init', rows, fields, alternate);
  for (let i = 0; i < 30; i++) cache.set(String(i), result);
  assert.equal(cache.size, 8);
  assert.equal(cache.get('0', rows, fields, alternate), undefined);
  assert.equal(cache.get('29', rows, fields, alternate), result);
});
test('deep trees project and collect identities/default expansion without recursion or dense connectors', () => {
  let root = { id: 'leaf', name: 'needle', defaultExpanded: true };
  for (let index = 0; index < 10000; index++) root = { id: `deep-${index}`, name: 'branch', defaultExpanded: true, children: [root] };
  let calls = 0;
  const getter = row => { calls++; return getChildren(row); };
  const collapsed = projectTree([root], view, fields, byId, '', new Set(), getter);
  assert.equal(collapsed.matchedCount, 10001);
  assert.equal(collapsed.rows.length, 1);
  assert.equal(calls, 10001);
  const result = projectTree([root], view, fields, byId, 'needle', new Set(), getChildren);
  assert.equal(result.rows.length, 10001);
  assert.equal(result.rows.at(-1).depth, 10000);
  assert.equal(result.rows.at(-1).row.id, 'leaf');
  assert.ok(result.rows.every(row => row.ancestorContinuationLevels.length === 0));
  assert.equal(collectRecordIds([root], getChildren).size, 10001);
  const expanded = collectDefaultExpanded([root], getChildren);
  assert.equal(expanded.size, 10000);
  assert.equal(expanded.has('leaf'), false);
  assert.equal(projectTree([root], view, fields, byId, '', expanded, getChildren).rows.length, 10001);
});
test('sparse continuation levels preserve branching connectors and sibling order', () => {
  const records = [{ id: 'p', children: [{ id: 'a', children: [{ id: 'g1', children: [{ id: 'h' }] }, { id: 'g2' }] }, { id: 'b' }] }];
  const result = projectTree(records, view, fields, byId, '', new Set(['p', 'a', 'g1']), getChildren);
  assert.deepEqual(result.rows.map(row => [row.row.id, row.ancestorContinuationLevels]), [['p', []], ['a', []], ['g1', [0]], ['h', [0, 1]], ['g2', [0]], ['b', []]]);
  assert.deepEqual([...collectRecordIds(records, getChildren)], ['p', 'a', 'g1', 'h', 'g2', 'b']);
});
test('selection checks IDs and toggles only visible records', () => {
  const selected = new Set(['a']);
  assert.equal(selectionState(['b'], selected), false);
  assert.equal(selectionState(['a', 'b'], selected), 'indeterminate');
  assert.equal(selectionState([], selected), false);
  const all = toggleVisibleSelection(['b'], selected);
  assert.deepEqual([...all], ['a', 'b']);
  assert.equal(selectionState(['b'], all), true);
  assert.deepEqual([...toggleVisibleSelection(['b'], all)], ['a']);
  assert.deepEqual([...selected], ['a']);
});
