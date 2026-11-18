import { Button } from "../components/Button";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { Plus, Search, X } from "lucide-react";
import type { TableToolbarProps } from "./types";
import { useSearchInput } from "./useSearchInput";
import { FieldConfigPanel } from "./FieldConfigPanel";
import { FilterPanel } from "./FilterPanel";
import { SortPanel } from "./SortPanel";
import { FilterUiSwitch, SimpleFilterBar } from "./SimpleFilterBar";
import { resolveSimpleFields } from "./simpleFilter";
import { defaultGetSubRows } from "./tree";
import type { FilterUi } from "./types";
export function TableToolbar({ fields, activeView, onUpdateView, onAddRecord, search = "", onSearchChange, searchDebounceMs = 300, searchResetKey = 0, captureFindShortcut = false, simpleFilterFields, filterUi, onFilterUiChange, rows, getSubRows = defaultGetSubRows }: TableToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const restoreSearchFocus = useRef(false);
  useLayoutEffect(() => {
    if (!searchOpen && restoreSearchFocus.current) {
      restoreSearchFocus.current = false;
      searchTrigger.current?.focus({ preventScroll: true });
    }
  }, [searchOpen]);
  const input = useSearchInput(search, onSearchChange, searchDebounceMs, searchResetKey);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchEnabled = Boolean(onSearchChange);
  useEffect(() => {
    if (!captureFindShortcut || !searchEnabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "f" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.isComposing) return;
      // A modal dialog (record editor etc.) owns the page; let the browser find inside it.
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      setSearchOpen(true);
      // Already open: focus and select so typing replaces the previous query. Just opened: autoFocus handles it.
      searchInput.current?.focus();
      searchInput.current?.select();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [captureFindShortcut, searchEnabled]);
  const fieldById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const simpleFields = useMemo(() => resolveSimpleFields(simpleFilterFields, fieldById), [simpleFilterFields, fieldById]);
  const simpleEnabled = simpleFields.length > 0;
  // 传入 filterUi 即受控；否则内部维护，默认简单
  const [internalUi, setInternalUi] = useState<FilterUi>("simple");
  const ui = filterUi ?? internalUi;
  const changeUi = (next: FilterUi) => { if (filterUi === undefined) setInternalUi(next); onFilterUiChange?.(next); };
  const addRecord = onAddRecord && <Button size="small" color="primary" className="add-record" onClick={onAddRecord}><Plus size={17} /> 添加记录</Button>;
  const filterPanel = <FilterPanel key={`filters:${activeView.id}`} filterMode={activeView.filterMode ?? "all"} onModeChange={(filterMode) => onUpdateView(activeView.id, { filterMode })} fields={fields} filters={activeView.filters} onChange={(filters) => onUpdateView(activeView.id, { filters })} />;
  const fieldConfig = <FieldConfigPanel key={`fields:${activeView.id}`} fields={fields} activeView={activeView} onUpdateView={onUpdateView} />;
  const sortPanel = <SortPanel key={`sorts:${activeView.id}`} fields={fields} sorts={activeView.sorts} onChange={(sorts) => onUpdateView(activeView.id, { sorts })} />;
  const searchNode = onSearchChange && (searchOpen ? <div className="search-box" onBlur={(event) => {
    // 焦点离开整个搜索框（不是移到关闭按钮）且没有有效搜索词：收起成搜索按钮，回到初始状态
    if (event.currentTarget.contains(event.relatedTarget as Node | null) || input.draft.trim()) return;
    input.clear();
    setSearchOpen(false);
  }}><Search size={15} /><input ref={searchInput} autoFocus value={input.draft} onKeyDown={(event) => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); } }} onChange={(event) => input.update(event.target.value)} onCompositionStart={input.startComposition} onCompositionEnd={(event) => input.endComposition(event.currentTarget.value)} aria-label="搜索记录" placeholder="搜索" /><Button size="small" aria-label="关闭搜索" onClick={() => { input.clear(); restoreSearchFocus.current = true; setSearchOpen(false); }}><X size={14} /></Button></div> : <Button ref={searchTrigger} size="small" iconOnly className="toolbar-icon" aria-label="搜索" onClick={() => setSearchOpen(true)}><Search size={18} /></Button>);
  // 工具栏始终单行：左侧超出时横向滚动，聚焦到被遮住的按钮会把它滚进视野
  const scrollFocusedIntoView = (event: FocusEvent<HTMLDivElement>) => {
    const control = (event.target as HTMLElement).closest<HTMLElement>("button, input");
    if (!control || !event.currentTarget.contains(control)) return;
    const bounds = event.currentTarget.getBoundingClientRect(), cell = control.getBoundingClientRect();
    if (cell.left < bounds.left) event.currentTarget.scrollLeft += cell.left - bounds.left;
    else if (cell.right > bounds.right) event.currentTarget.scrollLeft += cell.right - bounds.right;
  };
  if (!simpleEnabled) return <div className="ntable-scope table-toolbar"><div className="toolbar-left" onFocusCapture={scrollFocusedIntoView}>{addRecord}{fieldConfig}{filterPanel}{sortPanel}</div><div className="toolbar-right">{searchNode}</div></div>;
  // 简单筛选：切换、添加记录、筛选控件、搜索依次排在左侧，字段配置和排序留在右侧
  return <div className="ntable-scope table-toolbar"><div className="toolbar-left" onFocusCapture={scrollFocusedIntoView}>
    <FilterUiSwitch ui={ui} onChange={changeUi} />{addRecord}
    {ui === "simple"
      ? <SimpleFilterBar simpleFields={simpleFields} fieldById={fieldById} activeView={activeView} onUpdateView={onUpdateView} rows={rows} getSubRows={getSubRows} search={search} onShowAdvanced={() => changeUi("advanced")} />
      : filterPanel}
    {searchNode}
  </div><div className="toolbar-right">{fieldConfig}{sortPanel}</div></div>;
}
