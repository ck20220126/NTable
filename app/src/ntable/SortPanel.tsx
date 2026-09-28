import { Button } from "../components/Button";
import { ArrowDownAZ, ArrowUpAZ, GripVertical, Plus, X } from "lucide-react";
import { ToolbarPopover } from "./ToolbarPopover";
import { SelectControl, useOptimisticList } from "./PanelControls";
export function SortPanel({ fields, sorts, onChange }: any) {
  const [draft, commit] = useOptimisticList(sorts, onChange);
  const add = () => commit([...draft, { id: crypto.randomUUID(), fieldId: fields.find((field) => !draft.some((sort) => sort.fieldId === field.id))?.id ?? fields[0].id, direction: "asc" }]);
  const patch = (index, value) => commit(draft.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item));
  const fieldOptions = fields.map((field) => ({ value: field.id, label: field.title }));
  return <ToolbarPopover icon={ArrowDownAZ} label="排序" active={draft.length} width={420}><div className="panel-header"><strong>排序规则</strong>{draft.length > 0 && <Button size="small" color="primary" className="text-button" onClick={() => commit([])}>清空</Button>}</div><div className="condition-list">{draft.length === 0 && <div className="panel-empty">暂无排序规则</div>}{draft.map((sort, index) => <div className="condition-row sort-row" key={sort.id ?? `${sort.fieldId}-${index}`}><GripVertical size={15} className="muted" /><SelectControl value={sort.fieldId} options={fieldOptions} onChange={(fieldId) => patch(index, { fieldId })} ariaLabel="排序字段" /><button className="direction-button" onClick={() => patch(index, { direction: sort.direction === "asc" ? "desc" : "asc" })}>{sort.direction === "asc" ? <ArrowUpAZ size={15} /> : <ArrowDownAZ size={15} />}{sort.direction === "asc" ? "升序" : "降序"}</button><Button size="small" iconOnly className="condition-remove" onClick={() => commit(draft.filter((_, itemIndex) => itemIndex !== index))}><X size={14} /></Button></div>)}</div><Button size="small" color="primary" className="add-condition" onClick={add}><Plus size={14} /> 添加排序规则</Button></ToolbarPopover>;
}
