import { createElement } from 'react';
import { NTable, simpleFilterRules, type Field, type FilterRule, type FilterUi, type SimpleFilterField, type SimpleFilterValues, type TableRecord, type TableView } from '@kun/ntable';
import '@kun/ntable/style.css';

const fields: Field[] = [{ id: 'name', title: '名称', type: 'text' }];
const rows: TableRecord[] = [{ id: 'r1', name: '独立包接入' }];
const view: TableView = {
  id: 'all', name: '全部记录', deletable: false, visibleFieldIds: ['name'], columnOrder: ['name'],
  filters: [], sorts: [],
};
const simpleFilterFields: SimpleFilterField[] = [{ fieldId: 'name', label: '名称', trueLabel: '是', falseLabel: '否' }];
const filterUi: FilterUi = 'simple';
const simpleFilterValues: SimpleFilterValues = { name: ['接入'] };
export const extraFilters: FilterRule[] = simpleFilterRules(simpleFilterValues, new Map(fields.map((field) => [field.id, field])));
export const table = createElement(NTable, {
  fields, rows, views: [view], activeView: view,
  searchDebounceMs: 300, simpleFilterFields, filterUi, onFilterUiChange(ui: FilterUi) { void ui; }, simpleFilterValues, onSimpleFilterValuesChange(values: SimpleFilterValues) { void values; }, loading: false, error: null, onRetry() {},
  onActiveViewChange() {}, onUpdateView() {}, onCreateView() {}, onOpenRecord() {},
});
