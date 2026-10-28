import { Tooltip } from "../components/Tooltip";
import { Button } from "../components/Button";
import { useId, useLayoutEffect, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Columns3, MoreHorizontal, Plus } from "lucide-react";
import type { TableView, ViewBarProps, ViewVisibility } from "./types";
const VISIBILITY_OPTIONS: { value: ViewVisibility; label: string }[] = [{ value: "private", label: "仅自己" }, { value: "public", label: "所有人" }];
/** 可视范围的分段切换：新建与视图管理共用。Enter 键只用于提交名称，这里不拦截 */
function VisibilityControl({ value, onChange }: { value: ViewVisibility; onChange: (value: ViewVisibility) => void }) {
  const labelId = useId();
  return <div className="panel-field"><div className="panel-field-label" id={labelId}>可视范围</div><RadioGroup.Root className="view-visibility" aria-labelledby={labelId} value={value} onValueChange={(next) => onChange(next as ViewVisibility)}>{VISIBILITY_OPTIONS.map(option => <RadioGroup.Item key={option.value} className="view-visibility-item" value={option.value}>{option.label}</RadioGroup.Item>)}</RadioGroup.Root></div>;
}
/** 输入法组字中的 Enter 不提交 */
function isSubmitEnter(event: { key: string; nativeEvent: KeyboardEvent; keyCode: number }) {
  return event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229;
}
function revealViewItem(item: HTMLElement) {
  const group = item.closest<HTMLElement>(".view-tabs");
  if (!group || !group.clientWidth) return;
  const bounds = group.getBoundingClientRect(), cell = item.getBoundingClientRect();
  if (cell.width > bounds.width || cell.left < bounds.left) group.scrollLeft += cell.left - bounds.left;
  else if (cell.right > bounds.right) group.scrollLeft += cell.right - bounds.right;
}
export function ViewBar({ views, activeView, onActiveViewChange, onCreateView, onDeleteView, onUpdateView, viewManagement = false, viewVisibilityEditable = false }: ViewBarProps) {
  const [newViewName, setNewViewName] = useState("");
  const [newViewVisibility, setNewViewVisibility] = useState<ViewVisibility>("private");
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
const create = () => {
    if (!newViewName.trim()) return;
    if (viewVisibilityEditable) onCreateView(newViewName.trim(), { visibility: newViewVisibility });
    else onCreateView(newViewName.trim());
    setNewViewName(""); setNewViewVisibility("private"); setViewMenuOpen(false);
  };
  return <div className="ntable-scope viewbar"><div className="view-tabs" ref={tabsRef} onFocusCapture={(event) => {
    const control = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (control && event.currentTarget.contains(control)) revealViewItem(control);
  }}>{views.map((view) => <div className={`view-tab-wrap${view.id === activeView.id ? " active" : ""}`} key={view.id}><Tooltip content={view.name} settleFocus><button type="button" ref={view.id === activeView.id ? activeTabRef : undefined} aria-pressed={view.id === activeView.id} className={view.id === activeView.id ? "view-tab active" : "view-tab"} onClick={() => onActiveViewChange(view.id)}><Columns3 size={15} /><span className="view-tab-label">{view.name}</span></button></Tooltip>{view.id === activeView.id && ((onDeleteView && view.deletable !== false) || (viewManagement && onUpdateView && view.manageable !== false)) && <ViewActions view={view} canDelete={views.length > 1} visibilityEditable={viewVisibilityEditable} onSave={viewManagement && onUpdateView && view.manageable !== false ? (patch) => onUpdateView(view.id, patch) : undefined} onDelete={onDeleteView && view.deletable !== false ? () => { pendingDeletion.current = view.id; onDeleteView(view.id); } : undefined} />}</div>)}
      <Popover.Root open={viewMenuOpen} onOpenChange={setViewMenuOpen}><Popover.Trigger asChild><button type="button" className="new-view"><Plus size={15} /> 新建视图</button></Popover.Trigger><Popover.Portal><Popover.Content className="ntable-portal panel new-view-panel" sideOffset={7} align="start"><div className="panel-title">新建表格视图</div><input autoFocus value={newViewName} onChange={(event) => setNewViewName(event.target.value)} aria-label="视图名称" placeholder="请输入视图名称" onKeyDown={(event) => { if (isSubmitEnter(event)) { event.preventDefault(); create(); } }} />{viewVisibilityEditable && <VisibilityControl value={newViewVisibility} onChange={setNewViewVisibility} />}<div className="panel-footer"><Button variant="outlined" onClick={() => setViewMenuOpen(false)}>取消</Button><Button variant="contained" color="primary" disabled={!newViewName.trim()} onClick={create}>创建</Button></div></Popover.Content></Popover.Portal></Popover.Root>
    </div></div>;
}
/**
 * 当前视图的「…」菜单：视图管理（名称、可视范围）在上，删除在下。
 * 视图管理在同一个浮层里切换成表单，样式与新建视图一致。
 */
function ViewActions({ view, canDelete, visibilityEditable, onSave, onDelete }: { view: TableView; canDelete: boolean; visibilityEditable: boolean; onSave?: (patch: Partial<TableView>) => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState(view.name);
  const [visibility, setVisibility] = useState<ViewVisibility>(view.visibility ?? "private");
  const openChange = (next: boolean) => { setOpen(next); if (!next) setManaging(false); };
  const startManaging = () => { setName(view.name); setVisibility(view.visibility ?? "private"); setManaging(true); };
  const save = () => {
    if (!name.trim() || !onSave) return;
    onSave({ name: name.trim(), ...(visibilityEditable ? { visibility } : {}) });
    openChange(false);
  };
  return <Popover.Root open={open} onOpenChange={openChange}><Popover.Trigger asChild><button type="button" className="view-menu-button" aria-label={`${view.name}菜单`}><MoreHorizontal size={16} /></button></Popover.Trigger><Popover.Portal>{managing
    ? <Popover.Content className="ntable-portal panel new-view-panel" sideOffset={5} align="start"><div className="panel-title">视图管理</div><input autoFocus value={name} onChange={(event) => setName(event.target.value)} aria-label="视图名称" placeholder="请输入视图名称" onKeyDown={(event) => { if (isSubmitEnter(event)) { event.preventDefault(); save(); } }} />{visibilityEditable && <VisibilityControl value={visibility} onChange={setVisibility} />}<div className="panel-footer"><Button variant="outlined" onClick={() => openChange(false)}>取消</Button><Button variant="contained" color="primary" disabled={!name.trim()} onClick={save}>保存</Button></div></Popover.Content>
    : <Popover.Content className="ntable-portal view-actions-menu" sideOffset={5} align="end">{onSave && <button type="button" className="view-action-item" onClick={startManaging}>视图管理</button>}{onDelete && <button type="button" className="view-action-item danger" disabled={!canDelete} onClick={() => { if (!canDelete) return; onDelete(); openChange(false); }}>删除视图</button>}</Popover.Content>}</Popover.Portal></Popover.Root>;
}
