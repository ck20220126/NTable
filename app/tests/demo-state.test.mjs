import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDemoViews, readDemoStorage, writeDemoStorage, createRecordDraft, saveRecordDraft } from '../src/demoState.ts';

const fields = [
  { id: 'name', type: 'text', title: '名称' },
  { id: 'department', type: 'text', title: '部门' },
  { id: 'quantity', type: 'number', title: '数量' },
];
const fallback = [{ id: 'all', name: '全部', visibleFieldIds: ['name', 'department', 'quantity'], columnOrder: ['name', 'department', 'quantity'], columnWidths: {}, filters: [], sorts: [] }];

test('invalid and empty storage safely falls back to usable views', () => {
  for (const raw of [null, '{bad', '{}', '[]', '[null]', '[{"id":"x"}]']) {
    const actual = normalizeDemoViews(raw, fields, fallback);
    assert.equal(actual.length, 1);
    assert.equal(actual[0].id, "all");
    assert.deepEqual(actual[0].columnOrder, fallback[0].columnOrder);
    assert.deepEqual(actual[0].visibleFieldIds, fallback[0].visibleFieldIds);
  }
});

test('normalization preserves valid configuration and repairs schema references', () => {
  const view = { id: 'custom', name: '我的视图', visibleFieldIds: ['department', 'name', 'name', 'removed'], columnOrder: ['department', 'name', 'removed'],
    columnWidths: { name: 300, department: 1, removed: 200 }, frozenFieldCount: 999, filterMode: 'any',
    filters: [{ fieldId: 'quantity', operator: 'greaterThan', value: '2' }, { fieldId: 'removed', operator: 'equals', value: 'x' }],
    sorts: [{ fieldId: 'name', direction: 'desc' }, { fieldId: 'name', direction: 'asc' }, { fieldId: 'department', direction: 'invalid' }] };
  const [actual] = normalizeDemoViews(JSON.stringify([view, view]), fields, fallback);
  assert.equal(actual.name, view.name);
  assert.deepEqual(actual.columnOrder, ['department', 'quantity', 'name']);
  assert.deepEqual(actual.visibleFieldIds, ['department', 'quantity', 'name']);
  assert.deepEqual(actual.columnWidths, { name: 300, department: 88 });
  assert.equal(actual.frozenFieldCount, 2);
  assert.equal(actual.filterMode, 'any');
  assert.equal(actual.filters.length, 1);
  assert.equal(actual.filters[0].value, '2');
  assert.ok(actual.filters[0].id);
  assert.equal(actual.sorts.length, 1);
  assert.equal(actual.sorts[0].direction, 'desc');
  assert.equal(normalizeDemoViews(JSON.stringify([view, view]), fields, fallback).length, 1);
});

test('quantity migration runs once and keeps an explicitly hidden field hidden', () => {
  const view = { ...fallback[0], visibleFieldIds: ['name'], columnOrder: ['name', 'department', 'quantity'] };
  assert.deepEqual(normalizeDemoViews(JSON.stringify([view]), fields, fallback)[0].visibleFieldIds, ['name']);
  const migrated = normalizeDemoViews(JSON.stringify([{ ...view, columnOrder: ['name', 'department'] }]), fields, fallback);
  assert.deepEqual(normalizeDemoViews(JSON.stringify(migrated), fields, fallback), migrated);
});

test('storage access errors never escape and never delete user storage', () => {
  const storage = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('quota'); } };
  assert.equal(readDemoStorage('key', storage), null);
  assert.equal(writeDemoStorage('key', 'value', storage), false);
  const writes = [];
  assert.equal(writeDemoStorage('key', 'value', { setItem(key, value) { writes.push([key, value]); } }), true);
  assert.deepEqual(writes, [['key', 'value']]);
});

test('editing preserves zero, empty numeric values, child structure and empty selects', () => {
  for (const quantity of [0, 12.5, null]) {
    const record = { id: 'child', name: '子记录', quantity, category: undefined, status: undefined, children: [{ id: 'nested' }] };
    const draft = createRecordDraft(record);
    assert.equal(draft.category, '');
    assert.equal(draft.status, '');
    assert.equal(draft.department, '');
    assert.equal(draft.startDate, '');
    const saved = saveRecordDraft(draft);
    assert.equal(saved.quantity, quantity);
    assert.equal(saved.children, record.children);
  }
  assert.equal(saveRecordDraft({ ...createRecordDraft({}), quantity: '-2.5' }).quantity, -2.5);
  assert.equal(saveRecordDraft({ ...createRecordDraft({}), quantity: '   ' }).quantity, null);
});

test('restored filter rules receive unique identities and invalid numeric drafts are rejected', () => {
  const view = { ...fallback[0], filters: [
    { id: 'same', fieldId: 'name', operator: 'equals', value: 'a' },
    { id: 'same', fieldId: 'name', operator: 'notEquals', value: 'b' },
  ] };
  const [actual] = normalizeDemoViews(JSON.stringify([view]), fields, fallback);
  assert.notEqual(actual.filters[0].id, actual.filters[1].id);
  for (const quantity of ['invalid', 'Infinity', '1e999']) {
    assert.throws(() => saveRecordDraft({ ...createRecordDraft({}), quantity }), /有限数字/);
  }
});
