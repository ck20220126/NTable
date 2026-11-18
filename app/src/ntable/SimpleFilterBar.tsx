import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Filter, Search, X } from "lucide-react";
import { Button } from "../components/Button";
import type { Field, FilterUi, SimpleFilterValues, TableRecord, TableView } from "./types";
import { fieldOptions } from "./booleanOptions";
import { optionTagColor } from "./tagColors";
import { moveOptionFocus } from "./PanelControls";
import { useSearchInput } from "./useSearchInput";
import { simpleOptionCounts, summarizeSelection, type ResolvedSimpleField } from "./simpleFilter";

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
  values: SimpleFilterValues;
  onChange: (values: SimpleFilterValues) => void;
  rows?: TableRecord[];
  getSubRows: (row: TableRecord) => TableRecord[];
  search: string;
}

/** 简单筛选控件：值是临时的，只经 onChange 交给宿主，不改视图；视图自己的条件照常生效，并参与选项计数 */
export function SimpleFilterBar({ simpleFields, fieldById, activeView, values, onChange, rows, getSubRows, search }: SimpleFilterBarProps) {
  // 与 Table 一致的列顺序：计数里的搜索只看当前可见列
  const orderedFields = useMemo(() => activeView.columnOrder.filter((id) => activeView.visibleFieldIds.includes(id)).map((id) => fieldById.get(id)).filter((field): field is Field => field !== undefined), [activeView.columnOrder, activeView.visibleFieldIds, fieldById]);
  const write = (fieldId: string, next: string[]) => {
    const { [fieldId]: _previous, ...rest } = values;
    onChange(next.some((value) => value !== "") ? { ...rest, [fieldId]: next } : rest);
  };
  return <div className="simple-filters">
    {simpleFields.map((item) => {
      const label = item.label ?? item.field.title;
      const selected = values[item.fieldId] ?? [];
      if (item.field.type === "text") return <SimpleText key={item.fieldId} label={label} value={selected[0] ?? ""} onChange={(next) => write(item.fieldId, next ? [next] : [])} />;
      return item.field.type === "boolean"
        ? <SimpleBoolean key={item.fieldId} label={label} trueLabel={item.trueLabel ?? "是"} falseLabel={item.falseLabel ?? "否"} value={selected[0]} onChange={(next) => write(item.fieldId, next)} />
        : <SimpleSelect key={item.fieldId} item={item} label={label} selected={selected} onChange={(next) => write(item.fieldId, next)}
          rows={rows} view={activeView} values={values} orderedFields={orderedFields} fieldById={fieldById} search={search} getSubRows={getSubRows} />;
    })}
  </div>;
}

/**
 * 文本字段：带标签的输入框，写「包含」条件。输入停顿 300ms 后提交，输入法组合中不提交；
 * 清空即删掉这条条件。外部改了值（清空）时输入框跟着变。
 */
function SimpleText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const input = useSearchInput(value, onChange, 300, 0);
  return <div className={`simple-filter-text${value ? " set" : ""}`}>
    <span className="simple-filter-label">{label}</span>
    <input aria-label={label} placeholder="包含…" value={input.draft}
      onChange={(event) => input.update(event.target.value)}
      onCompositionStart={input.startComposition}
      onCompositionEnd={(event) => input.endComposition(event.currentTarget.value)}
      onKeyDown={(event) => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); } }} />
    {input.draft && <button type="button" className="simple-filter-text-clear" aria-label={`清除${label}`} onClick={input.clear}><X size={12} /></button>}
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
  values: SimpleFilterValues;
  orderedFields: Field[];
  fieldById: Map<string, Field>;
  search: string;
  getSubRows: (row: TableRecord) => TableRecord[];
}
function SimpleSelect({ item, label, selected, onChange, rows, view, values, orderedFields, fieldById, search, getSubRows }: SimpleSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const options = fieldOptions(item.field);
  // 只在菜单打开时统计，菜单内搜索输入不会重算；没有记录时没有计数，选项全部显示
  const counts = useMemo(() => open && rows?.length ? simpleOptionCounts(rows, view, orderedFields, fieldById, search, getSubRows, item.fieldId, values) : undefined,
    [open, rows, view.filters, view.filterMode, values, orderedFields, fieldById, search, getSubRows, item.fieldId]);
  const keyword = query.trim().toLocaleLowerCase();
  const chosen = new Set(selected);
  // 未选且数量为 0 的选项隐藏（天然实现联动）；已选的始终保留，方便取消
  const visible = options.filter((option) => (chosen.has(option.value) || !counts || (counts.get(option.value) ?? 0) > 0) && (!keyword || option.label.toLocaleLowerCase().includes(keyword)));
  const chosenOptions = options.filter((option) => chosen.has(option.value));
  const summary = summarizeSelection(chosenOptions.map((option) => option.label));
  const changeOpen = (next: boolean) => { setQuery(""); setOpen(next); };
  // 保持已选值的原顺序，新选的追加在后面
  const toggle = (value: string) => onChange(chosen.has(value) ? selected.filter((entry) => entry !== value) : [...selected, value]);
  return <Popover.Root open={open} onOpenChange={changeOpen}>
    <Popover.Trigger asChild>
      <button type="button" className={`simple-filter-trigger${selected.length ? " set" : ""}${open ? " open" : ""}`} aria-label={`${label}：${summary}`} title={`${label}：${summary}`}
        onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); changeOpen(true); } }}>
        <span className="simple-filter-label">{label}</span>
        {chosenOptions.length ? <SelectedTags field={item.field} options={chosenOptions} /> : <span className="simple-filter-value">全部</span>}<ChevronDown size={14} />
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

/** 已选的选项按表格多选列的样子平铺成标签：最多两个，多出的用灰色「+n」，每个标签过长省略 */
const MAX_TAGS = 2;
const tagStyle = (color: string) => ({ "--tag-bg": color }) as import("react").CSSProperties;
function SelectedTags({ field, options }: { field: Field; options: { value: string; label: string }[] }) {
  const shown = options.slice(0, MAX_TAGS);
  const hidden = options.length - shown.length;
  return <span className="simple-filter-tags">
    {shown.map((option) => <span key={option.value} className="tag" style={tagStyle(optionTagColor(field.options, option.value))}>{option.label}</span>)}
    {hidden > 0 && <span className="tag tag-more" style={tagStyle("#eff0f1")}>+{hidden}</span>}
  </span>;
}
