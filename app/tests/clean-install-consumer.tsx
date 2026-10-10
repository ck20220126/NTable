import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NTable, Table, TableToolbar, ViewBar, type Field, type TableRecord, type TableView } from '@kun/ntable';
import '@kun/ntable/style.css';

const fields: Field[] = [
  { id: 'name', title: '记录名称', type: 'text', width: 260 },
  { id: 'quantity', title: '数量', type: 'number', width: 150 },
  { id: 'status', title: '状态', type: 'singleSelect', width: 160, options: [{ value: 'ready', label: '待处理', color: '#e8f1ff' }, { value: 'done', label: '已完成', color: '#e7f6eb' }] },
];
const rows: TableRecord[] = [
  { id: 'alpha', name: 'Alpha', quantity: 0, status: 'ready', defaultExpanded: true, children: [{ id: 'child', name: 'Child', quantity: 2, status: 'done' }] },
  { id: 'beta', name: 'Beta', quantity: 5, status: 'done' },
];
const initial: TableView = { id: 'all', name: '全部记录', deletable: false, visibleFieldIds: fields.map(field => field.id), columnOrder: fields.map(field => field.id), filters: [], sorts: [], frozenFieldCount: 1 };

function Consumer() {
  const [views, setViews] = useState([initial]);
  const [activeId, setActiveId] = useState(initial.id);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState('未打开');
  const [retries, setRetries] = useState(0);
  const hostUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hostUpdate, setHostUpdate] = useState('未安排');
  const [viewUpdates, setViewUpdates] = useState<unknown[]>([]);
  const [captureEvents, setCaptureEvents] = useState<unknown[]>([]);
  const [showTable, setShowTable] = useState(true);
  useEffect(() => () => { if (hostUpdateTimer.current !== null) clearTimeout(hostUpdateTimer.current); }, []);
  const scheduleHostUpdate = (status: string, update: () => void) => {
    if (hostUpdateTimer.current !== null) clearTimeout(hostUpdateTimer.current);
    setHostUpdate('等待宿主更新');
    hostUpdateTimer.current = setTimeout(() => {
      hostUpdateTimer.current = null;
      update();
      setHostUpdate(status);
    }, 1200);
  };
  const [viewport, setViewport] = useState({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio });
  useEffect(() => {
    const measure = () => setViewport({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio });
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  const active = views.find(view => view.id === activeId) ?? views[0];
  return <main style={{ fontFamily: 'system-ui, sans-serif', margin: '24px auto', maxWidth: 1000 }}>
    <h1 style={{ fontSize: 22 }}>NTable 干净安装验收</h1>
    <p>实际 tarball 与独立安装的 React、依赖共同运行。</p>
    <button type="button" onClick={() => setError('请求失败，请重试')}>模拟请求失败</button>
    <button type="button" onClick={() => scheduleHostUpdate('宿主更新已提交', () => {
        setViews(current => current.map(view => view.id === activeId ? { ...view, columnWidths: { ...view.columnWidths, name: 420 } } : view));
    })}>延迟更新宿主列宽</button>
    <button type="button" onClick={() => scheduleHostUpdate('宿主等价更新已提交', () => {
        setViews(current => current.map(view => ({ ...view, columnOrder: [...view.columnOrder], visibleFieldIds: [...view.visibleFieldIds], columnWidths: { ...view.columnWidths } })));
    })}>延迟重建等价视图</button>
    <button type="button" onClick={() => setViews(current => current.map(view => ({ ...view, visibleFieldIds: view.visibleFieldIds.filter(id => id !== 'status') })))}>隐藏状态字段</button>
    <button type="button" onClick={() => scheduleHostUpdate('宿主隐藏列宽已提交', () => {
      setViews(current => current.map(view => view.id === activeId ? { ...view, columnWidths: { ...view.columnWidths, status: 640 } } : view));
    })}>延迟更新隐藏列宽</button>
    <button type="button" onClick={() => scheduleHostUpdate('宿主视图切换已提交', () => {
      const replacement = { ...initial, id: 'host-alternate', name: '宿主替换视图', columnWidths: { name: 360 } };
      setViews(current => [...current.filter(view => view.id !== replacement.id), replacement]);
      setActiveId(replacement.id);
    })}>延迟切换宿主视图</button>
    <button type="button" onClick={() => scheduleHostUpdate('宿主卸载已提交', () => setShowTable(false))}>延迟卸载表格</button>
    {!showTable && <button type="button" onClick={() => setShowTable(true)}>重新挂载表格</button>}
    <output aria-label="宿主更新状态">{hostUpdate}</output>
    <p>记录打开：<output aria-label="记录打开结果">{opened}</output>；重试次数：<output aria-label="重试次数">{retries}</output></p>
    <output aria-label="公共导出" style={{ display: 'block', fontSize: 13, color: '#555' }}>{JSON.stringify({ NTable: !!NTable, Table: !!Table, TableToolbar: !!TableToolbar, ViewBar: !!ViewBar })}</output>
    <output aria-label="验收视口" style={{ display: 'block', fontSize: 13 }}>{JSON.stringify(viewport)}</output>
    <section aria-label="干净安装表格" style={{ height: 420, minWidth: 0, marginTop: 20, border: '1px solid #ddd' }}
      onGotPointerCapture={event => setCaptureEvents(current => [...current, { type: 'got', pointerId: event.pointerId, trusted: event.isTrusted }].slice(-20))}
      onLostPointerCapture={event => setCaptureEvents(current => [...current, { type: 'lost', pointerId: event.pointerId, trusted: event.isTrusted }].slice(-20))}>
      {showTable && <NTable fields={fields} rows={rows} views={views} activeView={active} error={error}
        onRetry={() => { setRetries(value => value + 1); setError(null); }}
        onActiveViewChange={setActiveId}
        onUpdateView={(id, patch) => { setViewUpdates(current => [...current, { id, patch }].slice(-20)); setViews(current => current.map(view => view.id === id ? { ...view, ...patch } : view)); }}
        onCreateView={name => { const id = `view-${views.length}`; setViews(current => [...current, { ...initial, id, name }]); setActiveId(id); }}
        onOpenRecord={row => setOpened(row.id)} />}
    </section>
    <pre aria-label="当前视图">{JSON.stringify(active, null, 2)}</pre>
    <pre aria-label="视图更新回调">{JSON.stringify(viewUpdates, null, 2)}</pre>
    <pre aria-label="指针捕获事件">{JSON.stringify(captureEvents, null, 2)}</pre>
  </main>;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing clean consumer root');
createRoot(root).render(<Consumer />);
