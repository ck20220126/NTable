import { checkEmptyStateLayout, checkLastRecordLayout, checkFocusedResize, checkFocusedWidth, checkToolbarLayout, checkActiveViewLayout, checkViewTooltipFocus, checkViewTooltipCancellation, traceViewInput, traceKeyboardFocus } from './layout-checks';
import { useEffect, useRef, useState } from 'react';
import { checkSearchInput } from './search-checks';
import { checkKeyboard } from './keyboard-checks';
import { checkViewCreation } from './view-checks';
import { checkRenderPerformance, checkScrollPerformance, checkIdleFrames, observeWheelPerformance, traceScrollbarPointer } from './performance-checks';
import { traceColumnDrag } from './column-drag-checks';
import { FieldTypesConsumer } from './field-types';
import { createRoot } from 'react-dom/client';
import { NTable, Table, TableToolbar, ViewBar, type Field, type TableRecord, type TableView } from '@kun/ntable';
import '@kun/ntable/style.css';
import './host.css';
const fields: Field[] = [{ id: 'name', title: '名称', type: 'text', width: 250 }, { id: 'quantity', title: '数量', type: 'number', width: 130 }];
const initial: TableRecord[] = [{ id: 'a', name: 'Alpha', quantity: 0, defaultExpanded: true, children: [{id:'c', name:'Child',quantity:2}], alternate: [{id:'d', name:'Alternate',quantity:3}] }, { id: 'b', name: 'Beta', quantity: 5 }, { id: 'e', name: 'Gamma', quantity: 7 }];
const views: TableView[] = [{id:'all', name:'全部', visibleFieldIds:['name','quantity'], columnOrder:['name','quantity'], filters:[],sorts:[]}, {id:'filtered',name:'无 ID 筛选',visibleFieldIds:['name','quantity'],columnOrder:['name','quantity'],filters:[{fieldId:'name',operator:'contains',value:'a'}, {fieldId:'quantity',operator:'isNotEmpty',value:''}],sorts:[]}];
const children = (row: TableRecord) => row.children ?? [];
const alternate = (row: TableRecord) => row.alternate as TableRecord[] ?? [];
function Consumer() {
  const [schemaFields, setSchemaFields] = useState(fields);
  const schemaRemovalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (schemaRemovalTimer.current !== null) clearTimeout(schemaRemovalTimer.current); }, []);
  const [performanceReport, setPerformanceReport] = useState('未运行');
  const [performanceSummary, setPerformanceSummary] = useState('未运行');
  const [performanceRunning, setPerformanceRunning] = useState(false);
  const [scrollReport, setScrollReport] = useState('未运行');
  const [scrollRunning, setScrollRunning] = useState(false);
  const [rejectViewDeletion, setRejectViewDeletion] = useState(false);
  const [rows,setRows] = useState(initial);
  const [saved,setSaved] = useState(views);
  const [id,setId] = useState('all');
  const [getter,setGetter] = useState(false);
  const [opened,setOpened] = useState('');
  const [submits,setSubmits] = useState(0);
  const [tableInForm, setTableInForm] = useState(true);
  const TableContainer = tableInForm ? 'form' : 'div';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const [query, setQuery] = useState('');
  const [searches, setSearches] = useState<string[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const searchRoot = useRef<HTMLElement>(null);
  const searchEvents = useRef<string[]>([]);
  const [searchReport, setSearchReport] = useState('未运行');
  const [showSearchProbe, setShowSearchProbe] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [compactHost, setCompactHost] = useState(false);
  const [narrowHost, setNarrowHost] = useState(false);
  const [addEnabled, setAddEnabled] = useState(false);
  const [addRequests, setAddRequests] = useState(0);
  const [showTable, setShowTable] = useState(true);
  const [tableEpoch, setTableEpoch] = useState(0);
  const keyboardFocusStop = useRef<ReturnType<typeof traceKeyboardFocus> | null>(null);
  const [keyboardFocusReport, setKeyboardFocusReport] = useState("未运行");
  useEffect(() => () => { keyboardFocusStop.current?.(); }, []);
  const pointerTraceStop = useRef<ReturnType<typeof traceScrollbarPointer> | null>(null);
  const [pointerTraceReport, setPointerTraceReport] = useState("未运行");
  const columnTraceStop = useRef<ReturnType<typeof traceColumnDrag> | null>(null);
  const [columnTraceReport, setColumnTraceReport] = useState('未运行');
  useEffect(() => () => { columnTraceStop.current?.(); }, []);
  const [scrollbarEndState, setScrollbarEndState] = useState("未运行");
  useEffect(() => () => { pointerTraceStop.current?.(); }, []);
  const capturedScrollbar = useRef<{ element: HTMLElement; pointerId: number; primary: string; nativePrimary: string } | null>(null);
  const tableHost = useRef<HTMLDivElement>(null);
  const [keyboardReport, setKeyboardReport] = useState('未运行');
  const viewRoot = useRef<HTMLElement>(null);
  const createdViews = useRef<string[]>([]);
  const [viewReport, setViewReport] = useState('未运行');
  const [layoutReport, setLayoutReport] = useState('未运行');
  const viewUpdateCount = useRef(0);
  const stopViewTrace = useRef<ReturnType<typeof traceViewInput> | null>(null);
  const stopWheelProbe = useRef<ReturnType<typeof observeWheelPerformance> | null>(null);
  const wheelBaseline = useRef<HTMLDivElement>(null);
  useEffect(() => () => { stopWheelProbe.current?.(); }, []);
  useEffect(() => { if(!showTable) { stopWheelProbe.current?.(); stopWheelProbe.current=null; } }, [showTable]);
  useEffect(() => () => { stopViewTrace.current?.(); }, []);
  return <main><h1>Release 包接入验收</h1><p className="host-text">宿主样式：18px / 正常页面滚动</p>
    <button type="button" onClick={() => {
      setSaved([{...views[0],id:'long-name',name:'超长视图名称用于验证完整提示与菜单可达性'.repeat(8)},...views]);setId('long-name');
    }}>超长视图名称</button>
    <button type="button" onClick={() => {
      const list=Array.from({length:8},(_,index)=>({...views[0],id:`scroll-view-${index}`,name:index ? `验收视图 ${index+1}` : '超长视图名称用于验证完整提示与菜单可达性'.repeat(8)}));
      setSaved(list);setId(list[7].id);
    }}>长名称视图列表</button>
    <button type="button" onClick={() => {
      const list=Array.from({length:8},(_,index)=>({...views[0],id:`view-layout-${index}`,name:`验收视图 ${index+1}`}));
      setSaved(list);setId(list[7].id);
    }}>长视图列表</button>
    <button type="button" onClick={() => setGetter(value=>!value)}>切换子记录来源</button>
    <button type="button" onClick={() => { setSaved(views); setId('all'); }}>恢复视图</button>
    <button type="button" onClick={() => setRejectViewDeletion(value => !value)}>{rejectViewDeletion ? '允许视图删除' : '拒绝视图删除'}</button>
    <button type="button" onClick={() => setRows(value=>value.filter(row=>row.id!=='a'))}>移除 Alpha</button>
    <button type="button" onClick={() => { setRows([]); setLoading(true); setError(null); }}>首次加载</button>
    <button type="button" onClick={() => { setLoading(false); setError('连接中断，请重试'); }}>请求失败</button>
    <button type="button" onClick={() => { setRows([]); setLoading(false); setError(null); }}>空数据</button>
    <button type="button" onClick={() => { setRows(initial); setLoading(false); setError(null); }}>恢复数据</button>
    <button type="button" onClick={() => { setLoading(true); setError(null); }}>后台刷新</button>
    <button type="button" onClick={() => { setRows(Array.from({length:500}, (_,i) => ({id:`large-${i}`,name:`记录 ${i}`,quantity:i}))); setLoading(false); setError(null); }}>500 行数据</button>
    <button type="button" onClick={() => {
      let row: TableRecord = { id: 'deep-leaf', name: '深层目标', quantity: 5000 };
      for (let depth = 4999; depth >= 0; depth--) row = { id: `deep-${depth}`, name: `层级 ${depth}`, quantity: depth, children: [row] };
      setRows([row]); setSaved(views); setId('all'); setGetter(false); setLoading(false); setError(null);
    }}>5001 层记录</button>
    <button type="button" onClick={() => {
      const schema: Field[] = [...fields, ...Array.from({ length: 40 }, (_, index): Field => ({ id: `wide-${index}`, title: `业务字段 ${index + 1}`, type: 'text', width: 140 }))];
      const records = Array.from({ length: 2000 }, (_, index): TableRecord => ({ id: `wide-row-${index}`, name: `多列记录 ${index}`, quantity: index,
        ...Object.fromEntries(schema.slice(2).map(field => [field.id, `${field.title} / 记录 ${index}`])) }));
      setSchemaFields(schema); setRows(records); setSaved([{ ...views[0], visibleFieldIds: schema.map(field => field.id), columnOrder: schema.map(field => field.id), frozenFieldCount: 2 }]);
      setId('all'); setGetter(false); setLoading(false); setError(null); setTableEpoch(value => value + 1);
    }}>42 列完整数据</button>
    <button type="button" disabled={schemaFields.length < 4} onClick={() => setSaved(value => value.map(view => view.id === id ? { ...view, visibleFieldIds:schemaFields.slice(0,4).map(field => field.id) } : view))}>仅显示前 4 列</button>
    <button type="button" onClick={() => {
      let sequence = 0;
      const make = (depth: number): TableRecord => {
        const index = sequence++;
        return { id: `branch-${index}`, name: `分支记录 ${index}`, quantity: index, defaultExpanded: true,
          children: depth < 6 ? Array.from({ length: 4 }, () => make(depth + 1)) : [] };
      };
      setSchemaFields(fields); setRows([make(0)]); setSaved(views); setId('all'); setGetter(false); setLoading(false); setError(null); setTableEpoch(value => value + 1);
    }}>5461 条分支树</button>
    <button type="button" onClick={() => setAddEnabled(value => !value)}>切换添加记录入口</button>
    <button type="button" onClick={() => tableHost.current?.querySelector<HTMLButtonElement>(".add-record")?.focus({preventScroll:true})}>聚焦添加记录</button>
    <output aria-label="添加请求次数">{addRequests}</output>
    <button type="button" onClick={() => setNarrowHost(value => !value)}>切换窄容器</button>
    <button type="button" onClick={() => setCompactHost(value => !value)}>切换紧凑容器</button>
    <button type="button" onClick={() => setSchemaFields(value => value.length === 2 ? [...fields, ...Array.from({length:40}, (_,index): Field => ({id:`extra-${index}`, title:`扩展字段 ${index + 1}`, type:'text'}))] : fields)}>切换多字段</button>
    <button type="button" onClick={() => { if (schemaRemovalTimer.current !== null) clearTimeout(schemaRemovalTimer.current); schemaRemovalTimer.current = setTimeout(() => { schemaRemovalTimer.current = null; setSchemaFields(fields); }, 1500); }}>延迟移除普通字段</button>
    <button type="button" onClick={() => { keyboardFocusStop.current?.(); keyboardFocusStop.current=traceKeyboardFocus(tableHost.current!); }}>开始键盘焦点轨迹</button>
    <button type="button" onClick={() => tableHost.current?.querySelector<HTMLButtonElement>('.table-toolbar button')?.focus()}>聚焦工具栏起点</button>
    <button type="button" onClick={() => { setKeyboardFocusReport(JSON.stringify(keyboardFocusStop.current?.() ?? null)); keyboardFocusStop.current=null; }}>读取键盘焦点轨迹</button>
    <output aria-label="原生键盘焦点轨迹">{keyboardFocusReport}</output>
    <ul aria-label="原生键盘焦点事件">{(() => { try { const events: unknown[] = JSON.parse(keyboardFocusReport)?.events ?? []; return events.map((event,index) => <li key={index}>{JSON.stringify(event)}</li>); } catch { return []; } })()}</ul>
    <button type="button" onClick={() => { pointerTraceStop.current?.(); pointerTraceStop.current = traceScrollbarPointer(tableHost.current!); }}>开始滚动条指针轨迹</button>
    <button type="button" onClick={() => { columnTraceStop.current?.(); columnTraceStop.current = traceColumnDrag(tableHost.current!); }}>开始列拖动轨迹</button>
    <button type="button" onClick={() => { setColumnTraceReport(JSON.stringify(columnTraceStop.current?.() ?? null)); columnTraceStop.current = null; }}>读取列拖动轨迹</button>
    <output aria-label="列拖动轨迹">{columnTraceReport}</output>
    <button type="button" onClick={() => { setPointerTraceReport(JSON.stringify({ events:pointerTraceStop.current?.() ?? [], reactPointer:capturedScrollbar.current ? {id:capturedScrollbar.current.pointerId, primary:capturedScrollbar.current.primary, nativePrimary:capturedScrollbar.current.nativePrimary, captured:capturedScrollbar.current.element.hasPointerCapture(capturedScrollbar.current.pointerId)} : null })); pointerTraceStop.current = null; const shell = tableHost.current?.querySelector(".auto-scroll-shell"); const rail = shell?.querySelector(".overlay-scrollbar-vertical"); setScrollbarEndState(JSON.stringify({top:shell?.querySelector(".grid-scroll")?.scrollTop, left:shell?.querySelector(".grid-scroll")?.scrollLeft, maxLeft:(shell?.querySelector(".grid-scroll")?.scrollWidth ?? 0)-(shell?.querySelector(".grid-scroll")?.clientWidth ?? 0), hovered:shell?.matches(":hover"), visible:shell?.classList.contains("scrollbars-visible"), opacity:rail ? getComputedStyle(rail).opacity : null})); }}>读取滚动条指针轨迹</button>
    <output aria-label="滚动条指针轨迹">{pointerTraceReport}</output>
    <output aria-label="滚动条结束状态">{scrollbarEndState}</output>
    <button type="button" onClick={() => { const captured = capturedScrollbar.current; if (captured?.element.hasPointerCapture(captured.pointerId)) captured.element.releasePointerCapture(captured.pointerId); }}>释放滚动条捕获</button>
    <button type="button" onClick={() => window.dispatchEvent(new Event('blur'))}>模拟窗口失焦</button>
    <button type="button" onClick={() => setShowTable(value => !value)}>{showTable ? '卸载表格' : '挂载表格'}</button>
    <button type="button" onClick={() => { setRows([-2, -10, 1.2, 1.11, 0, 2, null].map((quantity, i) => ({ id: `number-${i}`, name: `数值 ${quantity ?? '空'}`, quantity }))); setLoading(false); setError(null); }}>数值排序边界</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkEmptyStateLayout(tableHost.current!.querySelector<HTMLElement>('.ntable')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证当前空态布局</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkLastRecordLayout(tableHost.current!.querySelector<HTMLElement>('.ntable')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证当前末行布局</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkLastRecordLayout(document.querySelector<HTMLElement>('[aria-label="独立 Table 紧凑验收"] .ntable-table')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证独立 Table 末行</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkFocusedResize(tableHost.current!.querySelector<HTMLElement>('.ntable')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证聚焦末行缩放</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkFocusedResize(tableHost.current!.querySelector<HTMLElement>('.ntable')!,true),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证聚焦中段缩放</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkFocusedWidth(tableHost.current!.querySelector<HTMLElement>('.ntable')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证聚焦末列宽度</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkFocusedWidth(tableHost.current!.querySelector<HTMLElement>('.ntable')!,true),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证聚焦中段宽度</button>
    <button type="button" onClick={async () => {
      try {
        const before = viewUpdateCount.current;
        const result = await checkFocusedWidth(tableHost.current!.querySelector<HTMLElement>('.ntable')!,true,true);
        if (viewUpdateCount.current !== before) throw new Error('容器缩放不应提交视图修改');
        result.checks.push('尺寸变化未调用 onUpdateView');
        setLayoutReport(JSON.stringify(result,null,2));
      }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证窄容器冻结布局</button>
    <button type="button" onClick={() => {
      try { setLayoutReport(JSON.stringify(checkToolbarLayout(tableHost.current!.querySelector<HTMLElement>('.ntable')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证工具栏布局</button>
    <button type="button" onClick={() => {
      try { setLayoutReport(JSON.stringify(checkActiveViewLayout(tableHost.current!.querySelector<HTMLElement>('.ntable')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证当前视图布局</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkViewTooltipFocus(tableHost.current!.querySelector<HTMLElement>('.ntable')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证视图焦点提示</button>
    <button type="button" onClick={() => { stopViewTrace.current?.(); stopViewTrace.current=traceViewInput(tableHost.current!.querySelector<HTMLElement>('.ntable')!); }}>开始视图输入轨迹</button>
    <button type="button" onClick={() => { const result=stopViewTrace.current?.();stopViewTrace.current=null;setLayoutReport(JSON.stringify(result,null,2)); }}>读取视图输入轨迹</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkViewTooltipFocus(tableHost.current!.querySelector<HTMLElement>('.ntable')!,true),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证滚动焦点提示</button>
    <button type="button" onClick={async () => {
      try { setLayoutReport(JSON.stringify(await checkViewTooltipCancellation(tableHost.current!.querySelector<HTMLElement>('.ntable')!),null,2)); }
      catch(error) { setLayoutReport(`失败：${String(error)}`); }
    }}>验证焦点提示取消</button>
    <output aria-label="空态布局结果">{layoutReport}</output>
    <p>重试次数：{retries}</p>
    <button type="button" disabled={performanceRunning} onClick={async () => {
      setPerformanceRunning(true); setPerformanceReport('运行中'); setPerformanceSummary('运行中');
      setSaved(views); setId('all'); setSchemaFields(fields); setRows(initial); setLoading(false); setError(null); setCompactHost(false);
      setShowTable(true); setTableEpoch(value => value + 1);
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const result = await checkRenderPerformance(tableHost.current!, setRows, patch => setSaved(value => value.map(view => view.id === 'all' ? {...view,...patch} : view)));
        setPerformanceReport(JSON.stringify(result,null,2));
        setPerformanceSummary(result.results.map(sample => `${sample.name}：${sample.updateToTwoFramesMs}ms / ${sample.mountedRows} 行挂载`).join('；') + `；longtask ${result.supportsLongTasks ? '支持' : '不支持'}`);
      } catch (error) { setPerformanceReport(`失败：${String(error)}`); setPerformanceSummary(`失败：${String(error)}`); }
      finally { setRows(initial); setSaved(views); setId('all'); setPerformanceRunning(false); }
    }}>运行浏览器性能测量</button>
    <pre aria-label="浏览器性能结果">{performanceReport}</pre>
    <output aria-label="浏览器性能摘要">{performanceSummary}</output>
    <button type="button" disabled={scrollRunning} onClick={async () => {
      setScrollRunning(true); setScrollReport('运行中');
      try { setScrollReport(JSON.stringify(await checkScrollPerformance(tableHost.current!),null,2)); }
      catch(error) { setScrollReport(`失败：${String(error)}`); }
      finally { setScrollRunning(false); }
    }}>测量当前数据连续滚动</button>
    <button type="button" disabled={scrollRunning} onClick={async () => {
      setScrollRunning(true); setScrollReport('运行中');
      try { setScrollReport(JSON.stringify(await checkScrollPerformance(tableHost.current!,false),null,2)); }
      catch(error) { setScrollReport(`失败：${String(error)}`); }
      finally { setScrollRunning(false); }
    }}>测量滚动帧（不采样 DOM）</button>
    <button type="button" disabled={scrollRunning} onClick={async () => {
      setScrollRunning(true); setScrollReport('运行中');
      try { setScrollReport(JSON.stringify(await checkScrollPerformance(tableHost.current!,true,['horizontal']),null,2)); }
      catch(error) { setScrollReport(`失败：${String(error)}`); }
      finally { setScrollRunning(false); }
    }}>仅测量横向滚动</button>
    <button type="button" disabled={scrollRunning} onClick={async () => {
      setScrollRunning(true); setScrollReport('运行中');
      try { setScrollReport(JSON.stringify(await checkIdleFrames(),null,2)); }
      catch(error) { setScrollReport(`失败：${String(error)}`); }
      finally { setScrollRunning(false); }
    }}>测量空闲帧基线</button>
    <button type="button" onClick={()=>{stopWheelProbe.current?.();stopWheelProbe.current=observeWheelPerformance(tableHost.current!,true);setScrollReport('等待滚轮输入');}}>开始滚轮测量</button>
    <button type="button" onClick={()=>{stopWheelProbe.current?.();stopWheelProbe.current=observeWheelPerformance(tableHost.current!,false);setScrollReport('等待滚轮输入');}}>开始纯帧滚轮测量</button>
    <button type="button" onClick={()=>{const result=stopWheelProbe.current?.();stopWheelProbe.current=null;setScrollReport(JSON.stringify(result,null,2));}}>结束滚轮测量</button>
    <pre aria-label="连续滚动结果">{scrollReport}</pre>
    <output aria-label="程序滚动摘要">{(()=>{try{const r=JSON.parse(scrollReport);return r?.kind==='programmatic-scroll'?JSON.stringify({samples:r.sampleCount,axes:r.axisSamples,p95:r.p95FrameGapMs,max:r.maxFrameGapMs,slow:r.framesOver50ms,rows:r.maxMountedRows,cells:r.maxMountedCells,verticalMisses:r.coverageMisses,horizontalMisses:r.horizontalCoverageMisses,final:{top:r.finalScrollTop,left:r.finalScrollLeft}}):'未测量';}catch{return '未测量';}})()}</output>
    <output aria-label="滚轮测量摘要">{(()=>{try{const r=JSON.parse(scrollReport);return r?.kind==='browser-wheel-observation'?JSON.stringify({valid:r.valid,events:r.trustedWheelEvents,samples:r.activeFrameSamples,p95:r.p95FrameGapMs,max:r.maxFrameGapMs,slow:r.framesOver50ms,longTasks:r.longTasks,final:r.final}):'未测量';}catch{return '未测量';}})()}</output>
    <button type="button" onClick={async () => { setKeyboardReport('运行中'); try { const results = await checkKeyboard(tableHost.current!.querySelector('[role="treegrid"]')!); setKeyboardReport(`通过 ${results.length} 项：${results.join('；')}`); } catch (error) { setKeyboardReport(`失败：${String(error)}`); } }}>运行键盘事件回归</button>
    <output aria-label="键盘回归结果">{keyboardReport}</output>
    <p role="status">打开记录：{opened || '无'}；宿主表单提交：{submits}</p>
    <button type="button" onClick={() => setTableInForm(value => !value)}>{tableInForm ? '切换非表单宿主' : '恢复表单宿主'}</button>
    <output aria-label="表格宿主类型">{tableInForm ? 'form' : 'div'}</output>
    <TableContainer onSubmit={event=>{event.preventDefault();setSubmits(value=>value+1)}}>
      <div ref={tableHost} className="table-host" style={{ height: compactHost ? 120 : undefined, width: narrowHost ? 320 : undefined }} onPointerDownCapture={event => { const element = (event.target as HTMLElement).closest<HTMLElement>('.overlay-scrollbar span'); if (element) capturedScrollbar.current = { element, pointerId: event.pointerId, primary: String(event.isPrimary), nativePrimary: String(event.nativeEvent.isPrimary) }; }}>{showTable && <NTable key={tableEpoch} fields={schemaFields} rows={rows} views={saved} activeView={saved.find(view=>view.id===id)!}
        onAddRecord={addEnabled ? () => setAddRequests(value => value + 1) : undefined}
        loading={loading} error={error} onRetry={() => { setRetries(value => value + 1); setLoading(true); }}
        onActiveViewChange={setId} onCreateView={name=>setSaved(value=>[...value,{...views[0],id:crypto.randomUUID(),name}])}
        onDeleteView={target => { if (rejectViewDeletion) return; const next = saved.filter(view => view.id !== target); setSaved(next); if (id === target && next[0]) setId(next[0].id); }}
        onUpdateView={(target,patch)=>{ viewUpdateCount.current++; setSaved(value=>value.map(view=>view.id===target?{...view,...patch}:view)); }}
        onOpenRecord={row=>setOpened(row.id)} getSubRows={getter?alternate:children}/>}</div>
    </TableContainer>
    <pre aria-label="视图状态">{JSON.stringify(saved.find(view=>view.id===id),null,2)}</pre>
    <output aria-label="列序定位">{JSON.stringify({first:saved.find(view=>view.id===id)?.columnOrder.slice(0,4),nameIndex:saved.find(view=>view.id===id)?.columnOrder.indexOf('name'),quantityIndex:saved.find(view=>view.id===id)?.columnOrder.indexOf('quantity')})}</output>
    <h2>第二个独立实例</h2><div className="table-host secondary"><NTable fields={fields} rows={[{id:'second',name:'Second instance',quantity:9}]} views={[views[0]]} activeView={views[0]} onActiveViewChange={()=>{}} onCreateView={()=>{}} onUpdateView={()=>{}} onOpenRecord={()=>{}}/></div>
    <FieldTypesConsumer />
    <section aria-label="独立 Table 紧凑验收"><h2>独立 Table 小容器</h2><div className="table-host" style={{height:100}}>
      <Table fields={fields} rows={initial} activeView={views[0]} onUpdateView={() => {}} onOpenRecord={() => {}} error="连接失败" />
    </div></section>
    <h2>输入事件验收</h2><section ref={searchRoot} aria-label="搜索验收">{showSearchProbe && <TableToolbar fields={fields} activeView={views[0]} onUpdateView={()=>{}} search={query} searchResetKey={resetKey} onSearchChange={searchEnabled ? value => { setQuery(value); searchEvents.current.push(value); setSearches([...searchEvents.current]); } : undefined}/>}
      <button type="button" data-probe-search-toggle onClick={() => setSearchEnabled(value => !value)}>{searchEnabled ? '移除搜索回调' : '恢复搜索回调'}</button>
      <button type="button" onClick={() => { setQuery(''); setResetKey(value=>value+1); }}>外部清空</button>
      <button type="button" data-probe-unmount onClick={() => setShowSearchProbe(value => !value)}>{showSearchProbe ? '卸载搜索' : '挂载搜索'}</button>
      <output aria-label="搜索提交记录">{JSON.stringify(searches)}</output>
      <button type="button" onClick={async () => { setSearchReport('运行中'); try { const results = await checkSearchInput(searchRoot.current!, () => searchEvents.current); setSearchReport(`通过 ${results.length} 项：${results.join('；')}`); } catch (error) { setSearchReport(`失败：${String(error)}`); } }}>运行输入事件回归</button>
      <output aria-label="搜索回归结果">{searchReport}</output>
    </section>
    <h2>视图输入事件验收</h2><section ref={viewRoot} aria-label="视图输入验收">
      <ViewBar views={[views[0]]} activeView={views[0]} onActiveViewChange={() => {}} onCreateView={name => { createdViews.current.push(name); }} />
      <button type="button" onClick={async () => { setViewReport('运行中'); try { const results = await checkViewCreation(viewRoot.current!, () => createdViews.current); setViewReport(`通过 ${results.length} 项：${results.join('；')}`); } catch (error) { setViewReport(`失败：${String(error)}`); } }}>运行视图输入回归</button>
      <output aria-label="视图输入回归结果">{viewReport}</output>
    </section>
    <section aria-label="原生滚轮基线"><h2>原生滚轮基线</h2>
      <button type="button" onClick={()=>{stopWheelProbe.current?.();stopWheelProbe.current=observeWheelPerformance(wheelBaseline.current!,false);setScrollReport('等待基线滚轮输入');}}>开始基线滚轮测量</button>
      <button type="button" onClick={()=>{const result=stopWheelProbe.current?.();stopWheelProbe.current=null;setScrollReport(JSON.stringify(result,null,2));}}>结束基线滚轮测量</button>
      <div ref={wheelBaseline} data-wheel-baseline tabIndex={0} aria-label="原生滚动基线区域" style={{height:300,overflow:'auto',background:'white',border:'1px solid #999'}}><div style={{height:64000,width:8000,background:'linear-gradient(#fff,#ddd)'}}>仅原生滚动容器，无表格渲染或虚拟化回调</div></div>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Consumer/>);
