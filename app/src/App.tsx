import { Button } from "./components/Button";
import type { Field, TableRecord, TableView } from "./ntable/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { NTable } from "./ntable";
import * as Dialog from "@radix-ui/react-dialog";
import { createRecordDraft, normalizeDemoViews, readDemoStorage, saveRecordDraft, writeDemoStorage } from "./demoState";

const categoryOptions = [
  { value: "visual", label: "视觉素材", color: "#d9e7ff" },
  { value: "copy", label: "文案", color: "#fee7bd" },
  { value: "reward", label: "奖励", color: "#d9f4e8" },
  { value: "rule", label: "规则", color: "#eadffd" },
  { value: "config", label: "配置", color: "#ffe1e8" },
];

const statusOptions = [
  { value: "draft", label: "草稿", color: "#e9ebef" },
  { value: "review", label: "评审中", color: "#fff0bf" },
  { value: "ready", label: "已就绪", color: "#d9f4e8" },
  { value: "online", label: "已上线", color: "#d9e7ff" },
];

export const fields: Field[] = [
  { id: "code", title: "元素编码", type: "text", width: 126, searchable: true },
  { id: "name", title: "活动元素完整名称", type: "text", width: 220, searchable: true },
  { id: "category", title: "元素分类", type: "singleSelect", width: 140, options: categoryOptions },
  { id: "status", title: "当前状态", type: "singleSelect", width: 128, options: statusOptions },
  { id: "owner", title: "负责人", type: "text", width: 132, searchable: true },
  { id: "department", title: "关注部门", type: "text", width: 140, searchable: true },
  { id: "quantity", title: "数量", type: "number", width: 112 },
  { id: "startDate", title: "开始日期", type: "date", width: 132 },
  { id: "endDate", title: "结束日期", type: "date", width: 132 },
  { id: "spec", title: "规格", type: "text", width: 168, searchable: true },
  { id: "attachment", title: "附件", type: "text", width: 116 },
];

const names = ["主视觉 KV", "预约页 Banner", "签到按钮", "积分奖励", "分享文案", "规则弹窗", "抽奖动效", "结果页插画", "短信模板", "渠道二维码", "活动角标", "数据埋点"];
const owners = ["林一", "陈曦", "王然", "沈悦", "周航", "苏妍"];
const departments = ["设计中心", "活动运营", "研发中心", "市场品牌"];

function createRows(count = 10000) {
  return Array.from({ length: count }, (_, index) => {
    const category = categoryOptions[index % categoryOptions.length].value;
    const status = statusOptions[(index + Math.floor(index / 7)) % statusOptions.length].value;
    const day = String((index % 27) + 1).padStart(2, "0");
    const row: TableRecord = {
      id: `element-${index + 1}`,
      code: `ACT-${String(index + 1).padStart(6, "0")}`,
      name: `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`,
      category,
      status,
      owner: owners[index % owners.length],
      department: departments[index % departments.length],
      quantity: index % 11 === 10 ? null : index % 101,
      startDate: `2026-10-${day}`,
      endDate: `2026-11-${String(((index + 7) % 27) + 1).padStart(2, "0")}`,
      spec: index % 3 === 0 ? "1440 × 560 px" : index % 3 === 1 ? "750 × 320 px" : "—",
      attachment: index % 4 === 0 ? `${(index % 3) + 1} 个文件` : "—",
    };
    if (index % 500 === 0) {
      row.defaultExpanded = index === 0;
      row.children = [
        { ...row, id: `${row.id}-desktop`, code: "01", name: "桌面端规格", status: undefined, owner: "", department: "", startDate: "", endDate: "", spec: "1440 × 560 px", attachment: "—", children: undefined, defaultExpanded: undefined },
        { ...row, id: `${row.id}-mobile`, code: "02", name: "移动端规格", category: undefined, status: undefined, owner: "", department: "", startDate: "", endDate: "", spec: "750 × 320 px", attachment: "—", children: undefined, defaultExpanded: undefined },
      ];
    }
    return row;
  });
}

function updateTreeRows(rows: TableRecord[], record: TableRecord): TableRecord[] {
  return rows.map((row) => {
    if (row.id === record.id) return { ...row, ...record };
    if (!row.children?.length) return row;
    return { ...row, children: updateTreeRows(row.children, record) };
  });
}

function insertChildRow(rows: TableRecord[], parentId: string, record: TableRecord): TableRecord[] {
  return rows.map((row) => {
    if (row.id === parentId) return { ...row, children: [...(row.children ?? []), record] };
    if (!row.children?.length) return row;
    return { ...row, children: insertChildRow(row.children, parentId, record) };
  });
}

const initialViews: TableView[] = [
  { id: "all", name: "全部元素", visibleFieldIds: fields.map((field) => field.id), columnOrder: fields.map((field) => field.id), columnWidths: {}, filters: [], sorts: [] },
  { id: "design", name: "设计关注", visibleFieldIds: ["code", "name", "category", "status", "owner", "spec", "attachment"], columnOrder: fields.map(field => field.id), columnWidths: {}, filters: [{ id: "design-dept", fieldId: "department", operator: "equals", value: "设计中心" }], sorts: [] },
  { id: "operation", name: "运营排期", visibleFieldIds: ["code", "name", "status", "owner", "department", "quantity", "startDate", "endDate"], columnOrder: fields.map(field => field.id), columnWidths: {}, filters: [], sorts: [{ fieldId: "startDate", direction: "asc" }] },
];

export function App() {
  const [rows, setRows] = useState(() => createRows());
  const [views, setViews] = useState(() => normalizeDemoViews(readDemoStorage("ntable:views"), fields, initialViews));
  const [activeViewId, setActiveViewId] = useState(() => readDemoStorage("ntable:active-view") || "all");
  const [editor, setEditor] = useState<Partial<TableRecord> | null>(null);
  const [storageError, setStorageError] = useState(false);
  const initialViewsRef = useRef(views);
  const initialActiveRef = useRef(activeViewId);
  const editorReturnFocusRef = useRef<HTMLElement | null>(null);
  const activeView = useMemo(() => views.find((view) => view.id === activeViewId) ?? views[0], [views, activeViewId]);
  useEffect(() => {
    if (views === initialViewsRef.current) return;
    setStorageError(!writeDemoStorage("ntable:views", JSON.stringify(views)));
  }, [views]);
  useEffect(() => {
    if (activeViewId === initialActiveRef.current) return;
    if (!writeDemoStorage("ntable:active-view", activeViewId)) setStorageError(true);
  }, [activeViewId]);
  const openEditor = (record: Partial<TableRecord>) => {
    editorReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditor(record);
  };
  const updateView = (viewId: string, patch: Partial<TableView>) => setViews((current) => current.map((view) => (view.id === viewId ? { ...view, ...patch } : view)));
  const createView = (name: string) => {
    const id = crypto.randomUUID();
    setViews((current) => [...current, { ...activeView, id, name, filters: [...activeView.filters], sorts: [...activeView.sorts] }]);
    setActiveViewId(id);
  };
  const deleteView = (viewId: string) => {
    if (views.length <= 1) return;
    const nextViews = views.filter((view) => view.id !== viewId);
    setViews(nextViews);
    if (activeViewId === viewId) setActiveViewId(nextViews[0].id);
  };
  const saveRecord = (record: Partial<TableRecord>) => {
    if (record.id) setRows((current) => updateTreeRows(current, record as TableRecord));
    else if (record.parentId) setRows((current) => insertChildRow(current, String(record.parentId), { ...record, id: crypto.randomUUID() }));
    else setRows((current) => [{ ...record, id: crypto.randomUUID(), code: record.code || `ACT-${String(current.length + 1).padStart(6, "0")}` }, ...current]);
    setEditor(null);
  };

  return <div className="app-shell">
    <main className="workspace"><NTable fields={fields} rows={rows} views={views} activeView={activeView} onActiveViewChange={setActiveViewId} onUpdateView={updateView} onCreateView={createView} onDeleteView={deleteView} onAddRecord={() => openEditor({})} onOpenRecord={openEditor} /></main>
    {storageError && <div role="status" className="demo-storage-status">浏览器存储不可用，当前修改仅在本次会话保留。</div>}
    {editor !== null && <RecordEditor record={editor} onClose={() => setEditor(null)} onSave={saveRecord} returnFocus={editorReturnFocusRef.current} />}
  </div>;
}

// Demo business page only. Never export this editor from the component library.
// Consumers implement their own forms via onAddRecord/onOpenRecord.
function RecordEditor({ record, onClose, onSave, returnFocus }: {
  record: Partial<TableRecord>; onClose: () => void; onSave: (record: Partial<TableRecord>) => void; returnFocus: HTMLElement | null;
}) {
  const isSubRecord = Boolean(record.parentId);
  const [draft, setDraft] = useState(() => createRecordDraft(record));
  const quantityInvalid = Boolean(draft.quantity.trim()) && !Number.isFinite(Number(draft.quantity));
  const set = (key: keyof typeof draft) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((value) => ({ ...value, [key]: event.target.value }));
  return <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Content className="editor-layer" aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); if (returnFocus?.isConnected) returnFocus.focus(); }} aria-label={record.id ? "编辑活动元素" : isSubRecord ? "添加子规格" : "添加活动元素"}>
    <div className="editor-header"><div><span className="editor-eyebrow">活动元素库</span><Dialog.Title asChild><h1>{record.id ? draft.name : isSubRecord ? "添加子规格" : "添加活动元素"}</h1></Dialog.Title></div><div className="editor-actions"><Button variant="outlined" onClick={onClose}>取消</Button><Button variant="contained" color="primary" onClick={() => onSave(saveRecordDraft(draft))} disabled={!draft.name.trim() || quantityInvalid}>保存</Button></div></div>
    <div className="editor-body"><section className="editor-card"><h2>基本信息</h2><div className="form-grid">
      <label><span>元素编码</span><input value={draft.code} onChange={set("code")} placeholder="保存后自动生成" /></label><label className="wide"><span>元素名称 *</span><input autoFocus value={draft.name} onChange={set("name")} placeholder="请输入元素名称" /></label>
      <label><span>元素分类</span><select value={draft.category} onChange={set("category")}><option value="">未设置</option>{categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label><span>当前状态</span><select value={draft.status} onChange={set("status")}><option value="">未设置</option>{statusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label><span>负责人</span><input value={draft.owner} onChange={set("owner")} /></label><label><span>关注部门</span><input value={draft.department} onChange={set("department")} /></label><label><span>数量</span><input type="number" step="any" value={draft.quantity} onChange={set("quantity")} aria-invalid={quantityInvalid} /></label><label><span>开始日期</span><input type="date" value={draft.startDate} onChange={set("startDate")} /></label><label><span>结束日期</span><input type="date" value={draft.endDate} onChange={set("endDate")} /></label><label className="wide"><span>规格</span><input value={draft.spec} onChange={set("spec")} /></label>
    </div></section></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}


