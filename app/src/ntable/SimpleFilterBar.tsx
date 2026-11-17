import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Filter, Search } from "lucide-react";
import { Button } from "../components/Button";
import type { Field, FilterUi, TableRecord, TableView } from "./types";
import { fieldOptions } from "./booleanOptions";
import { moveOptionFocus } from "./PanelControls";
import { applySimpleFilter, hasSimpleActive, projectSimpleFilters, simpleOptionCounts, summarizeSelection, type ResolvedSimpleField } from "./simpleFilter";

/** 「简单 | 高级」切换：小分段控件，放在工具栏最左 */
export function FilterUiSwitch({ ui, onChange }: { ui: FilterUi; onChange: (ui: FilterUi) => void }) {
  return <div role="group" aria-label="筛选方式" className="filter-ui-switch">
    <Filter size={16} aria-hidden="true" />
    <div className="ntable-segmented">
      <button type="button" aria-pressed={ui === "simple"} onClick={() => onChange("simple")}>简单</button>
      <button type="button" aria-pressed={ui === "advanced"} onClick={() => onChange("advanced")}>高级</button>
    </div>
  </div>;
}

interface SimpleFilterBarProps {
  simpleFields: ResolvedSimpleField[];
  fieldById: Map<string, Field>;
  activeView: TableView;
  onUpdateView: (id: string, patch: Partial<TableView>) => void;
  rows?: TableRecord[];
  getSubRows: (row: TableRecord) => TableRecord[];
  search: string;
  onShowAdvanced: () => void;
}

export function SimpleFilterBar({ simpleFields, fieldById, activeView, onUpdateView, rows, getSubRows, search, onShowAdvanced }: SimpleFilterBarProps) {
  const projection = useMemo(() => projectSimpleFilters(activeView.filters, activeView.filterMode, fieldById, simpleFields), [activeView.filters, activeView.filterMode, fieldById, simpleFields]);
  // 与 Table 一致的列顺序：计数里的搜索只看当前可见列
  const orderedFields = useMemo(() => activeView.columnOrder.filter((id) => activeView.visibleFieldIds.includes(id)).map((id) => fieldById.get(id)).filter((field): field is Field => field !== undefined), [activeView.columnOrder, activeView.visibleFieldIds, fieldById]);
  if (!projection.ok) {
    const text = `当前条件超出简单筛选：${projection.reasons.join("；")}`;
    return <div className="simple-filter-notice"><span className="simple-filter-notice-text" title={text}>{text}</span>
      <Button size="small" color="primary" className="text-button" onClick={onShowAdvanced}>在高级里查看</Button>
      <Button size="small" color="primary" className="text-button" onClick={() => onUpdateView(activeView.id, { filters: [] })}>清空条件</Button></div>;
  }
  const values = projection.values;
  const write = (fieldId: string, next: string[]) => onUpdateView(activeView.id, applySimpleFilter(activeView.filters, activeView.filterMode, fieldId, next, fieldById));
  return <div className="simple-filters">
    {simpleFields.map((item) => {
      const label = item.label ?? item.field.title;
      const selected = values[item.fieldId] ?? [];
      return item.field.type === "boolean"
        ? <SimpleBoolean key={item.fieldId} label={label} trueLabel={item.trueLabel ?? "是"} falseLabel={item.falseLabel ?? "否"} value={selected[0]} onChange={(next) => write(item.fieldId, next)} />
        : <SimpleSelect key={item.fieldId} item={item} label={label} selected={selected} onChange={(next) => write(item.fieldId, next)}
          rows={rows} view={activeView} orderedFields={orderedFields} fieldById={fieldById} search={search} getSubRows={getSubRows} />;
    })}
    {hasSimpleActive(values) && <Button size="small" color="primary" className="text-button" onClick={() => onUpdateView(activeView.id, { filters: [] })}>清空</Button>}
  </div>;
}

function SimpleBoolean({ label, trueLabel, falseLabel, value, onChange }: { label: string; trueLabel: string; falseLabel: string; value?: string; onChange: (value: string[]) => void }) {
  const choices: { key: string; text: string; next: string[] }[] = [{ key: "", text: "全部", next: [] }, { key: "true", text: trueLabel, next: ["true"] }, { key: "false", text: falseLabel, next: ["false"] }];
  return <div role="group" aria-label={label} className="simple-filter-boolean">
    <span className="simple-filter-label">{label}</span>
    <div className="ntable-segmented">{choices.map((choice) => <button key={choice.key || "all"} type="button" aria-pressed={(value ?? "") === choice.key} onClick={() => onChange(choice.next)}>{choice.text}</button>)}</div>
  </div>;
}

interface SimpleSelectProps {
  item: ResolvedSimpleField;
  label: string;
  selected: string[];
  onChange: (value: string[]) => void;
  rows?: TableRecord[];
  view: TableView;
  orderedFields: Field[];
  fieldById: Map<string, Field>;
  search: string;
  getSubRows: (row: TableRecord) => TableRecord[];
}
function SimpleSelect({ item, label, selected, onChange, rows, view, orderedFields, fieldById, search, getSubRows }: SimpleSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = fieldOptions(item.field);
  // 只在菜单打开时统计，菜单内搜索输入不会重算；没有记录时没有计数，选项全部显示
  const counts = useMemo(() => open && rows?.length ? simpleOptionCounts(rows, view, orderedFields, fieldById, search, getSubRows, item.fieldId) : undefined,
    [open, rows, view.filters, view.filterMode, orderedFields, fieldById, search, getSubRows, item.fieldId]);
  const keyword = query.trim().toLocaleLowerCase();
  const chosen = new Set(selected);
  // 未选且数量为 0 的选项隐藏（天然实现联动）；已选的始终保留，方便取消
  const visible = options.filter((option) => (chosen.has(option.value) || !counts || (counts.get(option.value) ?? 0) > 0) && (!keyword || option.label.toLocaleLowerCase().includes(keyword)));
  const summary = summarizeSelection(options.filter((option) => chosen.has(option.value)).map((option) => option.label));
  const changeOpen = (next: boolean) => { setQuery(""); setOpen(next); };
  // 保持已选值的原顺序，新选的追加在后面
  const toggle = (value: string) => onChange(chosen.has(value) ? selected.filter((entry) => entry !== value) : [...selected, value]);
  return <Popover.Root open={open} onOpenChange={changeOpen}>
    <Popover.Trigger asChild>
      <button type="button" className={`simple-filter-trigger${selected.length ? " set" : ""}${open ? " open" : ""}`} aria-label={`${label}：${summary}`} title={`${label}：${summary}`}
        onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); changeOpen(true); } }}>
        <span className="simple-filter-label">{label}</span><span className="simple-filter-value">{summary}</span><ChevronDown size={14} />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="ntable-portal select-menu select-menu--fluid select-menu--fields simple-filter-menu" collisionPadding={8} sticky="always" sideOffset={4} align="start" onKeyDown={moveOptionFocus}>
        <div className="select-field-search"><Search size={16} /><input aria-label={`搜索${label}`} placeholder="搜索" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="select-field-options">
          {visible.map((option) => <button key={option.value} type="button" aria-label={option.label} aria-pressed={chosen.has(option.value)} className={chosen.has(option.value) ? "select-option selected" : "select-option"} onClick={() => toggle(option.value)}>
            <span className="select-label">{option.label}</span>{counts && <span className="simple-filter-count">{counts.get(option.value) ?? 0}</span>}{chosen.has(option.value) && <Check size={14} />}
          </button>)}
          {visible.length === 0 && <div className="select-no-results">无匹配选项</div>}
        </div>
        <div className="simple-filter-footer"><Button size="small" color="primary" className="text-button" disabled={!selected.length} onClick={() => onChange([])}>清除</Button></div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
