import { useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Eye, EyeOff, GripVertical, Search, Settings, TextCursorInput } from "lucide-react";
import { iconForType } from "./fieldIcons";
import { ToolbarPopover } from "./ToolbarPopover";
export function FieldConfigPanel({ fields, activeView, onUpdateView, onSelectField }: any) {
  const [query, setQuery] = useState("");
  const fieldById = new Map<string, any>(fields.map((field) => [field.id, field]));
  const orderedFields = [...activeView.columnOrder.map((id) => fieldById.get(id)).filter(Boolean), ...fields.filter((field) => !activeView.columnOrder.includes(field.id))];
  const matchingFields = orderedFields.filter((field) => field.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const toggle = (fieldId) => { const visible = activeView.visibleFieldIds.includes(fieldId); if (visible && activeView.visibleFieldIds.length === 1) return; onUpdateView(activeView.id, { visibleFieldIds: visible ? activeView.visibleFieldIds.filter((id) => id !== fieldId) : [...activeView.visibleFieldIds, fieldId] }); };
  const reorder = (event) => {
    if (query || event.canceled) return;
    const source = event.operation.source;
    if (!source || !isSortable(source)) return;
    const from = source.initialIndex; const to = source.index;
    if (from === to || from < 0 || to < 0) return;
    const next = orderedFields.map((field) => field.id);
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
    onUpdateView(activeView.id, { columnOrder: next });
  };
  return <ToolbarPopover icon={Settings} label="字段配置" active={fields.some((field) => !activeView.visibleFieldIds.includes(field.id))} width={320}><div className="field-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" /></div><DragDropProvider onDragEnd={reorder}><div className="field-list">{matchingFields.map((field, index) => <FieldOption key={field.id} field={field} index={index} checked={activeView.visibleFieldIds.includes(field.id)} onToggle={() => toggle(field.id)} onSelect={() => onSelectField?.(field.id)} disabled={Boolean(query)} />)}{matchingFields.length === 0 && <div className="panel-empty">没有匹配的字段</div>}</div></DragDropProvider></ToolbarPopover>;
}

function FieldOption({ field, index, checked, onToggle, onSelect, disabled }: any) {
  const Icon = iconForType[field.type] ?? TextCursorInput;
  const { ref, isDragging, isDropTarget } = useSortable({ id: field.id, index, group: "view-fields", disabled });
  const VisibilityIcon = checked ? Eye : EyeOff;
  return <div ref={ref} className={`field-option${checked ? "" : " hidden"}${isDragging ? " dragging" : ""}${isDropTarget ? " drop-target" : ""}`} role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(); } }}><GripVertical size={14} className={disabled ? "muted disabled-grip" : "muted field-grip"} /><Icon size={15} /><span>{field.title}</span><button type="button" className="visibility-toggle" aria-label={`${checked ? "隐藏" : "显示"}${field.title}`} onClick={(event) => { event.stopPropagation(); onToggle(); }}><VisibilityIcon size={15} /></button></div>;
}
