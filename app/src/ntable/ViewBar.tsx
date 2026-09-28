import { Button } from "../components/Button";
import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Columns3, MoreHorizontal, Plus } from "lucide-react";
import type { ViewBarProps } from "./types";
export function ViewBar({ views, activeView, onActiveViewChange, onCreateView, onDeleteView }: ViewBarProps) {
  const [newViewName, setNewViewName] = useState("");
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
const create = () => { if (!newViewName.trim()) return; onCreateView(newViewName.trim()); setNewViewName(""); setViewMenuOpen(false); };
  return <div className="viewbar"><div className="view-tabs">{views.map((view) => <div className={`view-tab-wrap${view.id === activeView.id ? " active" : ""}`} key={view.id}><button className={view.id === activeView.id ? "view-tab active" : "view-tab"} onClick={() => onActiveViewChange(view.id)}><Columns3 size={15} />{view.name}</button>{view.id === activeView.id && <ViewActions view={view} canDelete={views.length > 1} onDelete={() => onDeleteView?.(view.id)} />}</div>)}
      <Popover.Root open={viewMenuOpen} onOpenChange={setViewMenuOpen}><Popover.Trigger asChild><button className="new-view"><Plus size={15} /> 新建视图</button></Popover.Trigger><Popover.Portal><Popover.Content className="panel new-view-panel" sideOffset={7} align="start"><div className="panel-title">新建表格视图</div><input autoFocus value={newViewName} onChange={(event) => setNewViewName(event.target.value)} placeholder="请输入视图名称" onKeyDown={(event) => event.key === "Enter" && create()} /><div className="panel-footer"><Button variant="outlined" onClick={() => setViewMenuOpen(false)}>取消</Button><Button variant="contained" color="primary" disabled={!newViewName.trim()} onClick={create}>创建</Button></div></Popover.Content></Popover.Portal></Popover.Root>
    </div></div>;
}
function ViewActions({ view, canDelete, onDelete }: any) {
  const [open, setOpen] = useState(false);
  return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><button className="view-menu-button" aria-label={`${view.name}菜单`}><MoreHorizontal size={16} /></button></Popover.Trigger><Popover.Portal><Popover.Content className="view-actions-menu" sideOffset={5} align="end"><button className="view-action-item danger" disabled={!canDelete} onClick={() => { if (!canDelete) return; onDelete(); setOpen(false); }}>删除视图</button></Popover.Content></Popover.Portal></Popover.Root>;
}
