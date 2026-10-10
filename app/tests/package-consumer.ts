import { createElement } from 'react';
import { NTable, type Field, type TableRecord, type TableView } from '@kun/ntable';
import '@kun/ntable/style.css';

const fields: Field[] = [{ id: 'name', title: '名称', type: 'text' }];
const rows: TableRecord[] = [{ id: 'r1', name: '独立包接入' }];
const view: TableView = {
  id: 'all', name: '全部记录', deletable: false, visibleFieldIds: ['name'], columnOrder: ['name'],
  filters: [], sorts: [],
};
export const table = createElement(NTable, {
  fields, rows, views: [view], activeView: view,
  searchDebounceMs: 300, loading: false, error: null, onRetry() {},
  onActiveViewChange() {}, onUpdateView() {}, onCreateView() {}, onOpenRecord() {},
});
