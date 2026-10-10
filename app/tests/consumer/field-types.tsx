import { useEffect, useRef, useState } from 'react';
import { NTable, type Field, type TableRecord, type TableView } from '@kun/ntable';

const fields: Field[] = [
  { id: 'name', title: '记录名称', type: 'text', width: 180 },
  { id: 'amount', title: '数值', type: 'number', width: 110 },
  { id: 'status', title: '单选', type: 'singleSelect', width: 160, options: [{ value: 'draft', label: '待处理', color: '#dbeafe' }, { value: 'ready', label: '已完成' }] },
  { id: 'tags', title: '多选', type: 'multiSelect', width: 200, options: [{ value: 'web', label: '网页端' }, { value: 'mobile', label: '移动端' }] },
  { id: 'day', title: '日期', type: 'date', width: 160 },
];
const rows: TableRecord[] = [
  { id: 'typed-normal', name: '标准值', amount: 0, status: 'draft', tags: ['web', 'mobile'], day: '2026-10-08' },
  { id: 'typed-empty', name: '空值', amount: null, status: null, tags: [], day: null },
  { id: 'typed-unknown', name: '未匹配选项', amount: -1.25, status: 'unknown', tags: ['web', 'legacy'], day: '2026-10-07' },
  { id: 'typed-long', name: '用于验证截断和完整值提示的长文本记录名称', amount: 12.5, status: 'ready', tags: ['mobile'], day: '2026-10-08T10:30:00+08:00' },
];
const initialView: TableView = { id: 'typed', name: '字段类型', visibleFieldIds: fields.map(field => field.id), columnOrder: fields.map(field => field.id), filters: [], sorts: [] };

export function FieldTypesConsumer() {
  const [view, setView] = useState(initialView);
  const [schema, setSchema] = useState(fields);
  const schemaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (schemaTimer.current !== null) clearTimeout(schemaTimer.current); }, []);
  const toggleSchema = () => {
    const next = schema.some(field => field.id === 'amount') ? fields.filter(field => field.id !== 'amount') : fields;
    const ids = new Set(next.map(field => field.id));
    setSchema(next);
    setView(value => ({ ...value, visibleFieldIds:next.map(field => field.id), columnOrder:next.map(field => field.id),
      filters:value.filters.filter(rule => ids.has(rule.fieldId)), sorts:value.sorts.filter(rule => ids.has(rule.fieldId)) }));
  };
  return <section aria-label="字段类型验收">
    <h2>五种字段类型</h2>
    <button type="button" onClick={toggleSchema}>切换数值字段 schema</button>
    <button type="button" onClick={() => {
      if (schemaTimer.current !== null) clearTimeout(schemaTimer.current);
      schemaTimer.current=setTimeout(() => { schemaTimer.current=null; toggleSchema(); }, 1500);
    }}>延迟切换数值字段 schema</button>
    <button type="button" onClick={() => {
      if (schemaTimer.current !== null) clearTimeout(schemaTimer.current);
      schemaTimer.current=setTimeout(() => {
        schemaTimer.current=null;
        setView(value => ({ ...value, columnOrder:[...value.columnOrder.slice(1), value.columnOrder[0]] }));
      }, 1500);
    }}>延迟旋转列序</button>
    <div className="table-host"><NTable fields={schema} rows={rows} views={[view]} activeView={view}
      onActiveViewChange={() => {}} onCreateView={() => {}}
      onUpdateView={(_, patch) => setView(value => ({ ...value, ...patch }))} onOpenRecord={() => {}} /></div>
    <pre aria-label="字段类型视图状态">{JSON.stringify(view, null, 2)}</pre>
  </section>;
}
