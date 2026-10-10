import { Button } from "../components/Button";
import { useLayoutEffect, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { TableToolbarProps } from "./types";
import { useSearchInput } from "./useSearchInput";
import { FieldConfigPanel } from "./FieldConfigPanel";
import { FilterPanel } from "./FilterPanel";
import { SortPanel } from "./SortPanel";
export function TableToolbar({ fields, activeView, onUpdateView, onAddRecord, search = "", onSearchChange, searchDebounceMs = 300, searchResetKey = 0 }: TableToolbarProps) {
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
  return <div className="ntable-scope table-toolbar"><div className="toolbar-left" onFocusCapture={(event) => {
    const control = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!control || !event.currentTarget.contains(control)) return;
    const bounds = event.currentTarget.getBoundingClientRect(), cell = control.getBoundingClientRect();
    if (cell.left < bounds.left) event.currentTarget.scrollLeft += cell.left - bounds.left;
    else if (cell.right > bounds.right) event.currentTarget.scrollLeft += cell.right - bounds.right;
  }}>{onAddRecord && <Button size="small" color="primary" className="add-record" onClick={onAddRecord}><Plus size={17} /> 添加记录</Button>}<FieldConfigPanel key={`fields:${activeView.id}`} fields={fields} activeView={activeView} onUpdateView={onUpdateView} /><FilterPanel key={`filters:${activeView.id}`} filterMode={activeView.filterMode ?? "all"} onModeChange={(filterMode) => onUpdateView(activeView.id, { filterMode })} fields={fields} filters={activeView.filters} onChange={(filters) => onUpdateView(activeView.id, { filters })} /><SortPanel key={`sorts:${activeView.id}`} fields={fields} sorts={activeView.sorts} onChange={(sorts) => onUpdateView(activeView.id, { sorts })} /></div><div className="toolbar-right">{onSearchChange && (searchOpen ? <div className="search-box"><Search size={15} /><input autoFocus value={input.draft} onChange={(event) => input.update(event.target.value)} onCompositionStart={input.startComposition} onCompositionEnd={(event) => input.endComposition(event.currentTarget.value)} aria-label="搜索记录" placeholder="搜索" /><Button size="small" aria-label="关闭搜索" onClick={() => { input.clear(); restoreSearchFocus.current = true; setSearchOpen(false); }}><X size={14} /></Button></div> : <Button ref={searchTrigger} size="small" iconOnly className="toolbar-icon" aria-label="搜索" onClick={() => setSearchOpen(true)}><Search size={18} /></Button>)}</div></div>;
}
