import { Tooltip } from "../components/Tooltip";
import { Button } from "../components/Button";
import { useLayoutEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Columns3, MoreHorizontal, Plus } from "lucide-react";
import type { TableView, ViewBarProps } from "./types";
function revealViewItem(item: HTMLElement) {
  const group = item.closest<HTMLElement>(".view-tabs");
  if (!group || !group.clientWidth) return;
  const bounds = group.getBoundingClientRect(), cell = item.getBoundingClientRect();
  if (cell.width > bounds.width || cell.left < bounds.left) group.scrollLeft += cell.left - bounds.left;
  else if (cell.right > bounds.right) group.scrollLeft += cell.right - bounds.right;
}
export function ViewBar({ views, activeView, onActiveViewChange, onCreateView, onDeleteView }: ViewBarProps) {
  const [newViewName, setNewViewName] = useState("");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const pendingDeletion = useRef<string | null>(null);
  useLayoutEffect(() => {
    const wrapper = activeTabRef.current?.closest<HTMLElement>(".view-tab-wrap");
    if (wrapper) revealViewItem(wrapper);
    const deletedId = pendingDeletion.current;
    if (!deletedId) return;
    if (views.some(view => view.id === deletedId)) {
      if (activeView.id !== deletedId) pendingDeletion.current = null;
      return;
    }
    if (activeTabRef.current) {
      activeTabRef.current.focus({ preventScroll: true });
      pendingDeletion.current = null;
    }
  }, [views, activeView.id]);
  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const observer = new ResizeObserver(() => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && tabs.contains(focused)) revealViewItem(focused);
      else {
        const wrapper = activeTabRef.current?.closest<HTMLElement>(".view-tab-wrap");
        if (wrapper) revealViewItem(wrapper);
      }
    });
    observer.observe(tabs);
    return () => observer.disconnect();
  }, []);
const create = () => { if (!newViewName.trim()) return; onCreateView(newViewName.trim()); setNewViewName(""); setViewMenuOpen(false); };
  return <div className="ntable-scope viewbar"><div className="view-tabs" ref={tabsRef} onFocusCapture={(event) => {
    const control = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (control && event.currentTarget.contains(control)) revealViewItem(control);
  }}>{views.map((view) => <div className={`view-tab-wrap${view.id === activeView.id ? " active" : ""}`} key={view.id}><Tooltip content={view.name} settleFocus><button type="button" ref={view.id === activeView.id ? activeTabRef : undefined} aria-pressed={view.id === activeView.id} className={view.id === activeView.id ? "view-tab active" : "view-tab"} onClick={() => onActiveViewChange(view.id)}><Columns3 size={15} /><span className="view-tab-label">{view.name}</span></button></Tooltip>{view.id === activeView.id && onDeleteView && view.deletable !== false && <ViewActions view={view} canDelete={views.length > 1} onDelete={() => { pendingDeletion.current = view.id; onDeleteView?.(view.id); }} />}</div>)}
      <Popover.Root open={viewMenuOpen} onOpenChange={setViewMenuOpen}><Popover.Trigger asChild><button type="button" className="new-view"><Plus size={15} /> 新建视图</button></Popover.Trigger><Popover.Portal><Popover.Content className="ntable-portal panel new-view-panel" sideOffset={7} align="start"><div className="panel-title">新建表格视图</div><input autoFocus value={newViewName} onChange={(event) => setNewViewName(event.target.value)} aria-label="视图名称" placeholder="请输入视图名称" onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); create(); } }} /><div className="panel-footer"><Button variant="outlined" onClick={() => setViewMenuOpen(false)}>取消</Button><Button variant="contained" color="primary" disabled={!newViewName.trim()} onClick={create}>创建</Button></div></Popover.Content></Popover.Portal></Popover.Root>
    </div></div>;
}
function ViewActions({ view, canDelete, onDelete }: { view: TableView; canDelete: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><button type="button" className="view-menu-button" aria-label={`${view.name}菜单`}><MoreHorizontal size={16} /></button></Popover.Trigger><Popover.Portal><Popover.Content className="ntable-portal view-actions-menu" sideOffset={5} align="end"><button type="button" className="view-action-item danger" disabled={!canDelete || view.deletable === false} onClick={() => { if (!canDelete || view.deletable === false) return; onDelete(); setOpen(false); }}>删除视图</button></Popover.Content></Popover.Portal></Popover.Root>;
}
