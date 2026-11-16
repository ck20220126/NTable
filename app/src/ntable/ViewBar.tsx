import { Tooltip } from "../components/Tooltip";
import { Button } from "../components/Button";
import { useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { DragDropProvider, PointerSensor } from "@dnd-kit/react";
import { isSortable, useSortable } from "@dnd-kit/react/sortable";
import * as Popover from "@radix-ui/react-popover";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Check, ChevronRight, Columns3, Copy, Eye, MoreHorizontal, Plus, SquarePen, Trash2, User, Users } from "lucide-react";
import type { TableView, ViewBarProps, ViewVisibility } from "./types";
const VISIBILITY_OPTIONS: { value: ViewVisibility; label: string }[] = [{ value: "private", label: "仅自己" }, { value: "public", label: "所有人" }];
/** 视图菜单「可见范围」二级菜单的选项 */
const VISIBILITY_MENU = [
  { value: "public" as const, label: "公共视图", hint: "所有人可见", Icon: Users },
  { value: "private" as const, label: "个人视图", hint: "仅自己可见", Icon: User },
];
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
/**
 * 拖拽只用指针：键盘传感器会接管标签按钮上的 Enter / 空格，切换视图就失效了。
 * 菜单按钮上按下不起拖，点开菜单不受影响；标签本身沿用默认的移动 5px 或按住 200ms 才起拖，单击照常切换。
 */
const VIEW_TAB_SENSORS = [PointerSensor.configure({
  preventActivation: (event) => event.target instanceof Element && Boolean(event.target.closest(".view-menu-button, .view-rename-input")),
})];
function SortableViewTab({ id, index, className, children }: { id: string; index: number; className: string; children: ReactNode }) {
  const { ref, isDragging } = useSortable({ id, index, group: "view-tabs" });
  return <div ref={ref as Ref<HTMLDivElement>} className={`${className}${isDragging ? " dragging" : ""}`}>{children}</div>;
}
export function ViewBar({ views, activeView, onActiveViewChange, onCreateView, onDeleteView, onDuplicateView, onUpdateView, viewManagement = false, viewVisibilityEditable = false, onReorderViews }: ViewBarProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
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
  const reorder: NonNullable<ComponentProps<typeof DragDropProvider>["onDragEnd"]> = (event) => {
    if (event.canceled || !onReorderViews) return;
    const source = event.operation.source;
    if (!source || !isSortable(source)) return;
    const from = source.initialIndex; const to = source.index;
    if (from === to || from < 0 || to < 0 || from >= views.length || to >= views.length) return;
    const next = views.map((view) => view.id);
    const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
    onReorderViews(next);
  };
  const sortable = Boolean(onReorderViews);
  const renderTab = (view: TableView, index: number) => {
    const active = view.id === activeView.id;
    const className = `view-tab-wrap${active ? " active" : ""}`;
    const onSave = viewManagement && onUpdateView && view.manageable !== false ? (patch: Partial<TableView>) => onUpdateView(view.id, patch) : undefined;
    const onDelete = onDeleteView && view.deletable !== false ? () => { pendingDeletion.current = view.id; onDeleteView(view.id); } : undefined;
    const onDuplicate = onDuplicateView ? () => onDuplicateView(view.id) : undefined;
    const finishRename = (focusTab: boolean) => { setRenamingId(null); if (focusTab) requestAnimationFrame(() => activeTabRef.current?.focus({ preventScroll: true })); };
    const content = renamingId === view.id && onSave
      ? <RenameInput view={view} onCommit={(name) => { if (name !== view.name) onSave({ name }); finishRename(false); }} onCancel={() => finishRename(true)} />
      : <><Tooltip content={view.name} settleFocus><button type="button" ref={active ? activeTabRef : undefined} aria-pressed={active} className={active ? "view-tab active" : "view-tab"} onClick={() => onActiveViewChange(view.id)}><Columns3 size={15} /><span className="view-tab-label">{view.name}</span></button></Tooltip>{active && (onSave || onDelete || onDuplicate) && <ViewActions view={view} canDelete={views.length > 1} visibilityEditable={viewVisibilityEditable} onRename={onSave ? () => setRenamingId(view.id) : undefined} onSave={onSave} onDuplicate={onDuplicate} onDelete={onDelete} />}</>;
    return sortable ? <SortableViewTab key={view.id} id={view.id} index={index} className={className}>{content}</SortableViewTab> : <div className={className} key={view.id}>{content}</div>;
  };
const create = () => {
    if (!newViewName.trim()) return;
    if (viewVisibilityEditable) onCreateView(newViewName.trim(), { visibility: newViewVisibility });
    else onCreateView(newViewName.trim());
    setNewViewName(""); setNewViewVisibility("private"); setViewMenuOpen(false);
  };
  return <div className="ntable-scope viewbar"><div className="view-tabs" ref={tabsRef} onFocusCapture={(event) => {
    const control = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (control && event.currentTarget.contains(control)) revealViewItem(control);
  }}>{onReorderViews ? <DragDropProvider sensors={VIEW_TAB_SENSORS} onDragEnd={reorder}>{views.map(renderTab)}</DragDropProvider> : views.map(renderTab)}
      <Popover.Root open={viewMenuOpen} onOpenChange={setViewMenuOpen}><Popover.Trigger asChild><button type="button" className="new-view"><Plus size={15} /> 新建视图</button></Popover.Trigger><Popover.Portal><Popover.Content className="ntable-portal panel new-view-panel" sideOffset={7} align="start"><div className="panel-title">新建表格视图</div><input autoFocus value={newViewName} onChange={(event) => setNewViewName(event.target.value)} aria-label="视图名称" placeholder="请输入视图名称" onKeyDown={(event) => { if (isSubmitEnter(event)) { event.preventDefault(); create(); } }} />{viewVisibilityEditable && <VisibilityControl value={newViewVisibility} onChange={setNewViewVisibility} />}<div className="panel-footer"><Button variant="outlined" onClick={() => setViewMenuOpen(false)}>取消</Button><Button variant="contained" color="primary" disabled={!newViewName.trim()} onClick={create}>创建</Button></div></Popover.Content></Popover.Portal></Popover.Root>
    </div></div>;
}
/**
 * 视图标签就地改名：替换标签文字，聚焦并全选；Enter 或失焦保存，Esc 放弃，空名称不保存。
 */
function RenameInput({ view, onCommit, onCancel }: { view: TableView; onCommit: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(view.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    // 菜单关闭时会把焦点还给「…」按钮，等它还完再接管
    const frame = requestAnimationFrame(() => { inputRef.current?.focus({ preventScroll: true }); inputRef.current?.select(); });
    return () => cancelAnimationFrame(frame);
  }, []);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    const trimmed = name.trim();
    if (trimmed) onCommit(trimmed); else onCancel();
  };
  // 输入框没拿到焦点时（页面当时不在前台等）不会有失焦事件，在别处按下也当作结束编辑
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useLayoutEffect(() => {
    const onPointerDown = (event: PointerEvent) => { if (!inputRef.current?.contains(event.target as Node)) commitRef.current(); };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, []);
  return <span className="view-tab active view-tab-renaming"><Columns3 size={15} /><input ref={inputRef} className="view-rename-input" value={name} aria-label="视图名称" maxLength={100} onChange={(event) => setName(event.target.value)} onBlur={commit} onKeyDown={(event) => {
    if (isSubmitEnter(event)) { event.preventDefault(); commit(); }
    else if (event.key === "Escape") { event.preventDefault(); done.current = true; onCancel(); }
  }} /></span>;
}
/**
 * 当前视图的「…」菜单：重命名、复制视图、可见范围（二级菜单）、删除视图。
 * 重命名在标签上就地编辑；可见范围选中即保存。
 */
function ViewActions({ view, canDelete, visibilityEditable, onRename, onSave, onDuplicate, onDelete }: { view: TableView; canDelete: boolean; visibilityEditable: boolean; onRename?: () => void; onSave?: (patch: Partial<TableView>) => void; onDuplicate?: () => void; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const renaming = useRef(false);
  const current = view.visibility ?? "private";
  const openChange = (next: boolean) => { setOpen(next); if (!next) setVisibilityOpen(false); };
  const closeSubmenu = () => setVisibilityOpen(false);
  const showVisibility = Boolean(onSave && visibilityEditable);
  const hasItemsAboveDelete = Boolean(onRename || onDuplicate || showVisibility);
  return <Popover.Root open={open} onOpenChange={openChange}><Popover.Trigger asChild><button type="button" className="view-menu-button" aria-label={`${view.name}菜单`}><MoreHorizontal size={16} /></button></Popover.Trigger><Popover.Portal><Popover.Content className="ntable-portal view-actions-menu" role="menu" aria-label={`${view.name}视图菜单`} aria-hidden={!open || undefined} inert={!open} sideOffset={5} align="end" onCloseAutoFocus={(event) => { if (renaming.current) { event.preventDefault(); renaming.current = false; } }}>
    {onRename && <button type="button" role="menuitem" className="view-action-item" onPointerEnter={closeSubmenu} onClick={() => { renaming.current = true; openChange(false); onRename(); }}><SquarePen size={15} />重命名</button>}
    {onDuplicate && <button type="button" role="menuitem" className="view-action-item" onPointerEnter={closeSubmenu} onClick={() => { onDuplicate(); openChange(false); }}><Copy size={15} />复制视图</button>}
    {showVisibility && <Popover.Root open={visibilityOpen} onOpenChange={setVisibilityOpen}><Popover.Trigger asChild><button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={visibilityOpen} className={`view-action-item has-submenu${visibilityOpen ? " open" : ""}`} onPointerEnter={() => setVisibilityOpen(true)} onClick={(event) => { event.preventDefault(); setVisibilityOpen(true); }} onKeyDown={(event) => { if (event.key === "ArrowRight") { event.preventDefault(); setVisibilityOpen(true); } }}><Eye size={15} />可见范围<ChevronRight size={15} className="view-action-arrow" /></button></Popover.Trigger><Popover.Portal><Popover.Content className="ntable-portal view-actions-menu view-visibility-menu" role="menu" aria-label="视图可见范围" aria-hidden={!open || !visibilityOpen || undefined} inert={!open || !visibilityOpen} side="right" align="start" sideOffset={8} alignOffset={-5} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); setVisibilityOpen(false); } }}>
      {VISIBILITY_MENU.map(({ value, label, hint, Icon }) => <button key={value} type="button" role="menuitemradio" aria-checked={current === value} className="view-visibility-option" onClick={() => { if (value !== current) onSave?.({ visibility: value }); openChange(false); }}><Icon size={18} className="view-visibility-icon" /><span className="view-visibility-text"><span className="view-visibility-label">{label}</span><span className="view-visibility-hint">{hint}</span></span>{current === value && <Check size={16} className="view-visibility-check" />}</button>)}
    </Popover.Content></Popover.Portal></Popover.Root>}
    {onDelete && <>{hasItemsAboveDelete && <div role="separator" className="view-action-separator" />}<button type="button" role="menuitem" className="view-action-item danger" disabled={!canDelete} onPointerEnter={closeSubmenu} onClick={() => { if (!canDelete) return; onDelete(); openChange(false); }}><Trash2 size={15} />删除视图</button></>}
  </Popover.Content></Popover.Portal></Popover.Root>;
}
