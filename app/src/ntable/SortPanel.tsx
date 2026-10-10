import type { Field, SortRule } from "./types";
import type { ComponentProps } from "react";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Button } from "../components/Button";
import { ArrowDownAZ, GripVertical, X } from "lucide-react";
import { ToolbarPopover } from "./ToolbarPopover";
import { SelectControl, useOptimisticList, type SelectOption } from "./PanelControls";
import { iconForType } from "./fieldIcons";

export function SortPanel({ fields, sorts, onChange }: { fields: Field[]; sorts: SortRule[]; onChange: (sorts: SortRule[]) => void }) {
  const [draft, commit] = useOptimisticList(sorts, onChange);
  const fieldOptions = fields.map((field) => ({ value: field.id, label: field.title, icon: iconForType[field.type] }));
  const availableOptions = fieldOptions.filter((field) => !draft.some((sort) => sort.fieldId === field.value));
  const patch = (index: number, value: Partial<SortRule>) => commit(draft.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item));
  const reorder: NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]> = (event) => {
    const source = event.operation.source;
    if (event.canceled || !source || !isSortable(source)) return;
    const from = source.initialIndex;
    const to = source.index;
    if (from === to || from < 0 || to < 0 || to >= draft.length) return;
    const next = [...draft];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commit(next);
  };
  return <ToolbarPopover icon={ArrowDownAZ} label="排序" active={draft.length > 0} width={516} className="sort-panel">
    <div className="panel-header"><strong>排序规则</strong>{draft.length > 0 && <Button size="small" color="primary" className="text-button" onClick={() => commit([])}>清空</Button>}</div>
    <DragDropProvider onDragEnd={reorder}>
      <div className="condition-list">{draft.map((sort, index) => <SortRow key={sort.id ?? sort.fieldId} sort={sort} index={index}
        options={fieldOptions.filter((field) => field.value === sort.fieldId || availableOptions.some((option) => option.value === field.value))}
        onChange={(value) => patch(index, value)} onRemove={() => commit(draft.filter((_, itemIndex) => itemIndex !== index))} />)}</div>
    </DragDropProvider>
    {availableOptions.length > 0 && <div className="sort-add-field"><SelectControl searchable fluidLabels value="" placeholder="选择条件" ariaLabel="选择排序字段" options={availableOptions}
      onChange={(fieldId) => commit([...draft, { id: crypto.randomUUID(), fieldId, direction: "asc" }])} /></div>}
  </ToolbarPopover>;
}

function SortRow({ sort, index, options, onChange, onRemove }: { sort: SortRule; index: number; options: SelectOption[]; onChange: (patch: Partial<SortRule>) => void; onRemove: () => void }) {
  const { ref, handleRef, isDragging } = useSortable({ id: sort.id ?? sort.fieldId, index, group: "sort-rules" });
  return <div ref={ref} className={`condition-row sort-row${isDragging ? " dragging" : ""}`}>
    <button type="button" ref={handleRef} className="sort-grip" aria-label={`拖动排序规则 ${index + 1}`}><GripVertical size={15} /></button>
    <SelectControl fluidLabels searchable value={sort.fieldId} options={options} onChange={(fieldId) => onChange({ fieldId })} ariaLabel="排序字段" />
    <RadioGroup.Root className="sort-direction-segments" aria-label="排序方向" orientation="horizontal"
      value={sort.direction} onValueChange={(direction) => { if (direction === "asc" || direction === "desc") onChange({ direction }); }}>
      <RadioGroup.Item value="asc" aria-label="顺序">顺序</RadioGroup.Item>
      <RadioGroup.Item value="desc" aria-label="倒序">倒序</RadioGroup.Item>
    </RadioGroup.Root>
    <Button size="small" iconOnly aria-label="删除排序规则" className="condition-remove" onClick={onRemove}><X size={14} /></Button>
  </div>;
}
