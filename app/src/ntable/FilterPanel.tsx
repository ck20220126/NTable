import { useId, useRef } from "react";
import type { Field, FilterRule, TableView } from "./types";
import { Tooltip } from "../components/Tooltip";
import { iconForType } from "./fieldIcons";
import { filterOperators, isActiveFilter, isEmptyOperator } from "./filtering";
import { Button } from "../components/Button";
import { Filter, Info, Plus, X } from "lucide-react";
import { ToolbarPopover } from "./ToolbarPopover";
import { SelectControl, useOptimisticList } from "./PanelControls";
export function FilterPanel({ fields, filters, onChange, filterMode = "all", onModeChange }: { fields: Field[]; filters: FilterRule[]; onChange: (filters: FilterRule[]) => void; filterMode?: TableView["filterMode"]; onModeChange: (mode: TableView["filterMode"]) => void }) {
  const [draft, commit] = useOptimisticList(filters, onChange);
  const keyPrefix = useId();
  const keyCounter = useRef(0);
  const localKeys = useRef<string[]>([]);
  while (localKeys.current.length < draft.length) localKeys.current.push(`${keyPrefix}-${keyCounter.current++}`);
  const remove = (index: number) => {
    localKeys.current.splice(index, 1);
    commit(draft.filter((_, itemIndex) => itemIndex !== index));
  };
  const add = () => commit([...draft, { id: crypto.randomUUID(), fieldId: fields[0].id, operator: filterOperators(fields[0].type)[0].value, value: "" }]);
  const patch = (index: number, value: Partial<FilterRule>) => commit(draft.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item));
  const fieldOptions = fields.map((field) => ({ value: field.id, label: field.title, icon: iconForType[field.type] }));
  return <ToolbarPopover icon={Filter} label="筛选" active={draft.some(isActiveFilter)} width={516} className="filter-panel"><div className="panel-header"><div className="filter-panel-title"><strong>筛选条件</strong><Tooltip content="此次筛选仅对自己生效。"><button type="button" className="filter-info" aria-label="此次筛选仅对自己生效。"><Info size={14} /></button></Tooltip></div>{draft.length > 0 && <Button size="small" color="primary" className="text-button" onClick={() => commit([])}>清空</Button>}</div>{draft.length > 1 && <div className="filter-conjunction">符合以下<SelectControl compact inline ariaLabel="条件匹配方式" value={filterMode} options={[{ value: "all", label: "所有" }, { value: "any", label: "任意" }]} onChange={onModeChange} />条件</div>}<div className="condition-list">{draft.length === 0 && <div className="panel-empty">暂无筛选条件</div>}{draft.map((filter, index) => <div className="condition-row" key={filter.id ?? localKeys.current[index]}><SelectControl searchable value={filter.fieldId} options={fieldOptions} onChange={(fieldId) => patch(index, { fieldId, operator: filterOperators(fields.find((field) => field.id === fieldId)?.type).some((option) => option.value === filter.operator) ? filter.operator : filterOperators(fields.find((field) => field.id === fieldId)?.type)[0].value })} ariaLabel="筛选字段" /><SelectControl compact value={filter.operator} options={filterOperators(fields.find((field) => field.id === filter.fieldId)?.type)} onChange={(operator) => patch(index, { operator, value: isEmptyOperator(operator) ? "" : filter.value })} ariaLabel="筛选关系" />{!isEmptyOperator(filter.operator) && <input aria-label={`筛选值 ${index + 1}`} value={filter.value} onChange={(event) => patch(index, { value: event.target.value })} placeholder="请输入" />}<Button size="small" iconOnly aria-label="删除筛选条件" className="condition-remove" onClick={() => remove(index)}><X size={14} /></Button></div>)}</div><Button size="small" color="primary" className="add-condition" disabled={fields.length === 0} onClick={add}><Plus size={14} /> 添加筛选条件</Button></ToolbarPopover>;
}
