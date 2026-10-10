import { useState, type ComponentProps } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import { Eye, EyeOff, GripVertical, Search, Settings, TextCursorInput } from "lucide-react";
import { iconForType } from "./fieldIcons";
import { ToolbarPopover } from "./ToolbarPopover";
import type { Field, TableToolbarProps } from "./types";
type FieldConfigProps = Pick<TableToolbarProps, "fields" | "activeView" | "onUpdateView"> & { onSelectField?: (id: string) => void };
export function FieldConfigPanel({ fields, activeView, onUpdateView, onSelectField }: FieldConfigProps) {
  const [query, setQuery] = useState("");
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const orderedFields = [...activeView.columnOrder.map((id) => fieldById.get(id)).filter((field): field is Field => field !== undefined), ...fields.filter((field) => !activeView.columnOrder.includes(field.id))];
  const matchingFields = orderedFields.filter((field) => field.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const visibleCount = fields.filter(field => activeView.visibleFieldIds.includes(field.id)).length;
  const toggle = (fieldId: string) => { const visible = activeView.visibleFieldIds.includes(fieldId); if (visible && visibleCount <= 1) return; onUpdateView(activeView.id, { visibleFieldIds: visible ? activeView.visibleFieldIds.filter((id) => id !== fieldId) : [...activeView.visibleFieldIds, fieldId] }); };
  const reorder: NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]> = (event) => {
    if (query || event.canceled) return;
    const source = event.operation.source;
    if (!source || !isSortable(source)) return;
    const from = source.initialIndex; const to = source.index;
    if (from === to || from < 0 || to < 0 || from >= orderedFields.length || to >= orderedFields.length) return;
    const next = orderedFields.map((field) => field.id);
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
    onUpdateView(activeView.id, { columnOrder: next });
  };
  return <ToolbarPopover icon={Settings} label="字段配置" active={fields.some((field) => !activeView.visibleFieldIds.includes(field.id))} width={320}><div className="field-search"><Search size={14} /><input aria-label="搜索配置字段" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" /></div><DragDropProvider onDragEnd={reorder}><div className="field-list">{matchingFields.map((field, index) => <FieldOption key={field.id} field={field} index={index} checked={activeView.visibleFieldIds.includes(field.id)} hideDisabled={activeView.visibleFieldIds.includes(field.id) && visibleCount <= 1} onToggle={() => toggle(field.id)} onSelect={onSelectField ? () => onSelectField(field.id) : undefined} disabled={Boolean(query)} />)}{matchingFields.length === 0 && <div className="panel-empty">没有匹配的字段</div>}</div></DragDropProvider></ToolbarPopover>;
}

function FieldOption({ field, index, checked, hideDisabled, onToggle, onSelect, disabled }: { field: Field; index: number; checked: boolean; hideDisabled: boolean; onToggle: () => void; onSelect?: () => void; disabled: boolean }) {
  const Icon = iconForType[field.type] ?? TextCursorInput;
  const { ref, handleRef, isDragging, isDropTarget } = useSortable({ id: field.id, index, group: "view-fields", disabled });
  const VisibilityIcon = checked ? Eye : EyeOff;
  return <div ref={ref} className={`field-option${checked ? "" : " hidden"}${isDragging ? " dragging" : ""}${isDropTarget ? " drop-target" : ""}`} role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined} onClick={onSelect} onKeyDown={(event) => { if (event.target === event.currentTarget && onSelect && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onSelect(); } }}><button ref={handleRef} type="button" className="muted field-grip" aria-label={`拖动字段 ${field.title}`} disabled={disabled} onClick={(event) => event.stopPropagation()}><GripVertical size={14} /></button><Icon size={15} /><span>{field.title}</span><button type="button" className="visibility-toggle" disabled={hideDisabled} aria-label={`${checked ? "隐藏" : "显示"}${field.title}`} onClick={(event) => { event.stopPropagation(); onToggle(); }}><VisibilityIcon size={15} /></button></div>;
}
