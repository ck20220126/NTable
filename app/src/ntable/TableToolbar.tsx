import { Button } from "../components/Button";
import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { TableToolbarProps } from "./types";
import { FieldConfigPanel } from "./FieldConfigPanel";
import { FilterPanel } from "./FilterPanel";
import { SortPanel } from "./SortPanel";
export function TableToolbar({ fields, activeView, onUpdateView, onAddRecord, search = "", onSearchChange }: TableToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const setSearch = (value: string) => onSearchChange?.(value);
  return <div className="table-toolbar"><div className="toolbar-left"><Button size="small" color="primary" className="add-record" onClick={onAddRecord}><Plus size={17} /> 添加记录</Button><FieldConfigPanel fields={fields} activeView={activeView} onUpdateView={onUpdateView} /><FilterPanel fields={fields} filters={activeView.filters} onChange={(filters) => onUpdateView(activeView.id, { filters })} /><SortPanel fields={fields} sorts={activeView.sorts} onChange={(sorts) => onUpdateView(activeView.id, { sorts })} /></div><div className="toolbar-right">{searchOpen ? <div className="search-box"><Search size={15} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索" /><Button size="small" aria-label="关闭搜索" onClick={() => { setSearch(""); setSearchOpen(false); }}><X size={14} /></Button></div> : <Button size="small" iconOnly className="toolbar-icon" aria-label="搜索" onClick={() => setSearchOpen(true)}><Search size={18} /></Button>}</div></div>;
}
