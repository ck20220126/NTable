import { Button } from "../components/Button";
import { Filter, Plus, X } from "lucide-react";
import { ToolbarPopover } from "./ToolbarPopover";
import { SelectControl, useOptimisticList } from "./PanelControls";
export function FilterPanel({ fields, filters, onChange }: any) {
  const [draft, commit] = useOptimisticList(filters, onChange);
  const add = () => commit([...draft, { id: crypto.randomUUID(), fieldId: fields[0].id, operator: "contains", value: "" }]);
  const patch = (id, value) => commit(draft.map((item) => item.id === id ? { ...item, ...value } : item));
  const fieldOptions = fields.map((field) => ({ value: field.id, label: field.title }));
  const operatorOptions = [{ value: "contains", label: "包含" }, { value: "equals", label: "等于" }, { value: "notEquals", label: "不等于" }];
  return <ToolbarPopover icon={Filter} label="筛选" active={draft.some((filter) => filter.fieldId && filter.value !== "")} width={500}><div className="panel-header"><strong>筛选条件</strong>{draft.length > 0 && <Button size="small" color="primary" className="text-button" onClick={() => commit([])}>清空</Button>}</div><div className="condition-list">{draft.length === 0 && <div className="panel-empty">暂无筛选条件</div>}{draft.map((filter) => <div className="condition-row" key={filter.id}><SelectControl value={filter.fieldId} options={fieldOptions} onChange={(fieldId) => patch(filter.id, { fieldId })} ariaLabel="筛选字段" /><SelectControl value={filter.operator} options={operatorOptions} onChange={(operator) => patch(filter.id, { operator })} ariaLabel="筛选关系" /><input value={filter.value} onChange={(event) => patch(filter.id, { value: event.target.value })} placeholder="请输入筛选值" /><Button size="small" iconOnly className="condition-remove" onClick={() => commit(draft.filter((item) => item.id !== filter.id))}><X size={14} /></Button></div>)}</div><Button size="small" color="primary" className="add-condition" onClick={add}><Plus size={14} /> 添加筛选条件</Button></ToolbarPopover>;
}
