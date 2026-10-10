import type { TableRecord, TableView } from '@kun/ntable';
interface PerformanceSample {
  name: string;
  updateToTwoFramesMs: number;
  totalRows: number;
  mountedRows: number;
  activeMounted: boolean;
  viewportHeight: number;
  longTasks: number[] | 'unsupported';
}

function frame() {
  return new Promise<number>((resolve, reject) => {
    const timer = window.setTimeout(() => { cancelAnimationFrame(id); reject(new Error('浏览器帧未推进，不能计为渲染性能通过')); }, 8000);
    const id = requestAnimationFrame(time => { clearTimeout(timer); resolve(time); });
  });
}

/** Observe browser wheel input; never changes scroll offsets or prevents input. */
export function observeWheelPerformance(root: HTMLElement, inspectDom = true) {
  const grid=root.matches('[data-wheel-baseline]')?root:root.querySelector<HTMLElement>('[role="grid"], [role="treegrid"]');
  if(!grid) throw new Error('记录区缺失');
  let id=0, previous=0, deadline=0, wheelEvents=0, trustedWheelEvents=0, scrollEvents=0;
  let hidden=false, stopped=false, lastTop=grid.scrollTop, lastLeft=grid.scrollLeft;
  let verticalMisses=0, horizontalMisses=0, maxCells=0;
  const gaps:number[]=[], tasks:number[]=[], slowFrames:{offsetMs:number;gapMs:number;wheelEvents:number;scrollEvents:number}[]=[];
  const start=performance.now(), initial={top:grid.scrollTop,left:grid.scrollLeft};
  const wheel=(event:WheelEvent)=>{wheelEvents++;if(event.isTrusted)trustedWheelEvents++;deadline=performance.now()+120;};
  const scroll=()=>{scrollEvents++;deadline=performance.now()+120;};
  grid.addEventListener('wheel',wheel,{passive:true});grid.addEventListener('scroll',scroll,{passive:true});
  const supported=PerformanceObserver.supportedEntryTypes.includes('longtask');
  const observer=supported?new PerformanceObserver(list=>{tasks.push(...list.getEntries().slice(0,32-tasks.length).map(e=>Math.round(e.duration)));}):null;
  observer?.observe({type:'longtask'});
  const supportsLongFrames=PerformanceObserver.supportedEntryTypes.includes('long-animation-frame');
  const longFrames:object[]=[];
  const frameObserver=supportsLongFrames?new PerformanceObserver(list=>{longFrames.push(...list.getEntries().slice(0,8-longFrames.length).map(e=>e.toJSON()));}):null;
  frameObserver?.observe({type:'long-animation-frame'});
  const tick=(time:number)=>{
    if(document.visibilityState!=='visible')hidden=true;
    if(time<=deadline && previous && gaps.length<2000) {
      const gap=time-previous;gaps.push(gap);
      if(gap>50 && slowFrames.length<10)slowFrames.push({offsetMs:Math.round(time-start),gapMs:Math.round(gap*10)/10,wheelEvents,scrollEvents});
    }
    previous=time;
    if(inspectDom && (lastTop!==grid.scrollTop || lastLeft!==grid.scrollLeft)) {
      const bounds=grid.getBoundingClientRect(), top=bounds.top+36;
      const rows=[...grid.querySelectorAll<HTMLElement>('.grid-row')];
      const bands=rows.map(e=>e.getBoundingClientRect()).filter(r=>r.bottom>top&&r.top<bounds.bottom).sort((a,b)=>a.top-b.top);
      let covered=top;
      for(const band of bands){if(band.top>covered+1)break;covered=Math.max(covered,band.bottom);}
      if(covered<bounds.bottom-1)verticalMisses++;
      const visible=rows.find(e=>{const r=e.getBoundingClientRect();return r.bottom>top&&r.top<bounds.bottom;});
      for(const row of [grid.querySelector<HTMLElement>('.grid-header'),visible]) {
        if(!row){horizontalMisses++;continue;}
        const track=getComputedStyle(row).gridTemplateColumns.split(' ').reduce((s,w)=>s+parseFloat(w),0);
        const end=Math.min(bounds.right,row.getBoundingClientRect().left+track);
        const cells=[...row.querySelectorAll<HTMLElement>('[role="columnheader"], [role="gridcell"]')].map(e=>e.getBoundingClientRect()).filter(r=>r.right>bounds.left&&r.left<bounds.right).sort((a,b)=>a.left-b.left);
        let right=bounds.left;
        for(const cell of cells){if(cell.left>right+1)break;right=Math.max(right,cell.right);}
        if(right<end-1)horizontalMisses++;
      }
      maxCells=Math.max(maxCells,grid.querySelectorAll('[role="gridcell"]').length);
    }
    lastTop=grid.scrollTop;lastLeft=grid.scrollLeft;
    id=requestAnimationFrame(tick);
  };
  id=requestAnimationFrame(tick);
  return ()=>{
    if(stopped) return null;
    stopped=true;cancelAnimationFrame(id);
    tasks.push(...(observer?.takeRecords().slice(0,32-tasks.length).map(e=>Math.round(e.duration))??[]));observer?.disconnect();
    longFrames.push(...(frameObserver?.takeRecords().slice(0,8-longFrames.length).map(e=>e.toJSON())??[]));frameObserver?.disconnect();
    grid.removeEventListener('wheel',wheel);grid.removeEventListener('scroll',scroll);
    const sorted=[...gaps].sort((a,b)=>a-b);
    const percentile=(p:number)=>sorted.length?Math.round(sorted[Math.floor((sorted.length-1)*p)]*10)/10:null;
    return {kind:'browser-wheel-observation',inspectDom,valid:!hidden&&trustedWheelEvents>0&&scrollEvents>0&&sorted.length>0,
      wheelEvents,trustedWheelEvents,scrollEvents,activeFrameSamples:sorted.length,durationMs:Math.round(performance.now()-start),
      p50FrameGapMs:percentile(.5),p95FrameGapMs:percentile(.95),maxFrameGapMs:sorted.length?Math.round(sorted.at(-1)!*10)/10:null,
      framesOver50ms:gaps.filter(g=>g>50).length,slowFrames,longTasks:supported?tasks:'unsupported',longAnimationFrames:supportsLongFrames?longFrames:'unsupported',
      verticalMisses:inspectDom?verticalMisses:null,horizontalMisses:inspectDom?horizontalMisses:null,maxCells:inspectDom?maxCells:null,
      initial,final:{top:grid.scrollTop,left:grid.scrollLeft},viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
  };
}

/** Production consumer probe; timings include two animation frames, not CPU-only cost. */
export async function checkRenderPerformance(root: HTMLElement, load: (rows: TableRecord[]) => void, patch: (view: Partial<TableView>) => void) {
  if (document.visibilityState !== 'visible') throw new Error('页面必须处于可见状态，后台页结果无效');
  const rows = Array.from({length: 25000}, (_, index): TableRecord => ({id:`bench-${index}`, name:`性能记录 ${index}`, quantity:index}));
  const tasks: {start: number; duration: number}[] = [];
  const supportsLongTasks = PerformanceObserver.supportedEntryTypes.includes('longtask');
  const observer = supportsLongTasks ? new PerformanceObserver(list => {
    for (const entry of list.getEntries()) tasks.push({start:entry.startTime, duration:entry.duration});
  }) : null;
  observer?.observe({type:'longtask'});
  const grid = () => root.querySelector<HTMLElement>('[role="grid"], [role="treegrid"]')!;
  const value = () => root.querySelector('[data-grid-row="0"] [data-grid-column="2"]')?.textContent;
  const results: PerformanceSample[] = [];
  async function measure(name: string, update: () => void, settled: () => boolean) {
    await frame();
    const start = performance.now();
    update();
    while (!settled() || grid().getAttribute('aria-busy') === 'true') {
      if (performance.now() - start > 8000) throw new Error(`${name} 未稳定，不能计为通过`);
      await frame();
    }
    await frame(); await frame();
    if (document.visibilityState !== 'visible') throw new Error('测量期间页面转入后台，结果无效');
    const end = performance.now();
    const viewport = grid();
    const active = document.getElementById(viewport.getAttribute('aria-activedescendant') ?? '');
    results.push({name, updateToTwoFramesMs:Math.round((end-start)*10)/10,
      totalRows:Number(viewport.getAttribute('aria-rowcount'))-1,
      mountedRows:root.querySelectorAll('.grid-row').length,
      activeMounted:Boolean(active), viewportHeight:viewport.clientHeight,
      longTasks:supportsLongTasks ? tasks.filter(task => task.start >= start && task.start < end).map(task => Math.round(task.duration)) : 'unsupported'});
  }
  try {
    await measure('装载 25,000 行', () => load(rows), () => grid().getAttribute('aria-rowcount') === '25001');
    await measure('数量倒序', () => patch({sorts:[{fieldId:'quantity',direction:'desc'}]}), () => value() === '24999');
    await measure('数量筛选为 24999', () => patch({filters:[{fieldId:'quantity',operator:'equals',value:'24999'}]}), () => grid().getAttribute('aria-rowcount') === '2' && value() === '24999');
    await measure('清空筛选和排序', () => patch({filters:[],sorts:[]}), () => grid().getAttribute('aria-rowcount') === '25001' && value() === '0');
    return {rows:25000, fields:2, visibility:document.visibilityState, supportsLongTasks, results};
  } finally { observer?.disconnect(); }
}

/** Programmatic scroll sampling; frame gaps are not pointer latency or a visual FPS guarantee. */
export async function checkScrollPerformance(root: HTMLElement, inspectDom = true, axes: readonly ('vertical' | 'horizontal')[] = ['vertical', 'horizontal']) {
  const grid = root.querySelector<HTMLElement>('[role="grid"], [role="treegrid"]');
  if (!grid || grid.clientHeight < 68) throw new Error('需要可见且足够高的记录区');
  const samples: number[] = [];
  const axisSamples = {vertical:0, horizontal:0};
  const axisGaps: Record<'vertical' | 'horizontal', number[]> = {vertical:[],horizontal:[]};
  const horizontalGaps: {offset: number; band: string; covered: number; expected: number; columns: number[]}[] = [];
  let maxMountedRows = 0, maxMountedCells = 0, coverageMisses = 0, horizontalCoverageMisses = 0;
  const supportsLongTasks = PerformanceObserver.supportedEntryTypes.includes('longtask');
  const tasks: number[] = [];
  const observer = supportsLongTasks ? new PerformanceObserver(list => {
    tasks.push(...list.getEntries().map(entry => Math.round(entry.duration)));
  }) : null;
  observer?.observe({type:'longtask'});
  grid.scrollTop = 0; grid.scrollLeft = 0;
  try {
    await frame(); await frame();
    const start = performance.now();
    let previousTime = await frame();
    for (const axis of axes) {
      for (const direction of [1, -1]) {
        previousTime = await frame();
        for (let index = 0; index < 120; index++) {
          if (document.visibilityState !== 'visible') throw new Error('页面转入后台，滚动测量无效');
          const size = axis === 'vertical' ? grid.clientHeight : grid.clientWidth;
          const before = axis === 'vertical' ? grid.scrollTop : grid.scrollLeft;
          if (axis === 'vertical') grid.scrollTop += direction * size / 2;
          else grid.scrollLeft += direction * size / 2;
          const after = axis === 'vertical' ? grid.scrollTop : grid.scrollLeft;
          if (Math.abs(after-before) < .1) break;
          const time = await frame();
          axisSamples[axis]++;
          samples.push(time - previousTime); axisGaps[axis].push(time-previousTime); previousTime = time;
          if (inspectDom) {
          const rows = [...grid.querySelectorAll<HTMLElement>('[data-grid-row]')].filter(row => Number(row.dataset.gridRow) >= 0);
          maxMountedRows = Math.max(maxMountedRows, rows.length);
          maxMountedCells = Math.max(maxMountedCells, grid.querySelectorAll('[role="gridcell"]').length);
          const bounds = grid.getBoundingClientRect();
          const top = bounds.top + 36, bottom = bounds.bottom;
          const bands = rows.map(row => row.getBoundingClientRect()).filter(rect => rect.bottom > top && rect.top < bottom).sort((a,b) => a.top-b.top);
          let covered = top;
          for (const band of bands) { if (band.top > covered + 1) break; covered = Math.max(covered, band.bottom); }
          if (covered < bottom - 1) coverageMisses++;
          // Check both header and an on-screen data row; sticky cells cover the frozen region.
          const header = grid.querySelector<HTMLElement>('.grid-header');
          const visibleRow = rows.find(row => { const rect = row.getBoundingClientRect(); return rect.bottom > top && rect.top < bottom; });
          for (const band of [header, visibleRow]) {
            if (!band) { horizontalCoverageMisses++; continue; }
            const trackWidth = getComputedStyle(band).gridTemplateColumns.split(' ').reduce((sum, width) => sum + Number.parseFloat(width), 0);
            const contentRight = Math.min(bounds.right, band.getBoundingClientRect().left + trackWidth);
            const cells = [...band.querySelectorAll<HTMLElement>('[role="columnheader"], [role="gridcell"]')]
              .map(cell => cell.getBoundingClientRect()).filter(rect => rect.right > bounds.left && rect.left < bounds.right)
              .sort((a,b) => a.left-b.left);
            let right = bounds.left;
            for (const cell of cells) { if (cell.left > right + 1) break; right = Math.max(right, cell.right); }
            if (right < contentRight - 1) {
              horizontalCoverageMisses++;
              if (horizontalGaps.length < 6) horizontalGaps.push({offset:grid.scrollLeft,band:band.className,covered:right-bounds.left,expected:contentRight-bounds.left,columns:[...band.querySelectorAll<HTMLElement>('[data-grid-column]')].map(cell => Number(cell.dataset.gridColumn))});
            }
          }
          }
        }
      }
    }
    if (!samples.length) throw new Error('当前数据没有可滚动范围，不能生成滚动性能结论');
    tasks.push(...(observer?.takeRecords().map(entry => Math.round(entry.duration)) ?? []));
    const ordered = [...samples].sort((a,b) => a-b);
    const percentile = (fraction: number) => Math.round(ordered[Math.floor((ordered.length-1)*fraction)]*10)/10;
    return {kind:'programmatic-scroll', totalRows:Number(grid.getAttribute('aria-rowcount'))-1,
      columns:Number(grid.getAttribute('aria-colcount'))-1, sampleCount:samples.length, axisSamples,
      axisP95Ms:Object.fromEntries(Object.entries(axisGaps).map(([axis,gaps]) => {const sorted=[...gaps].sort((a,b)=>a-b);return [axis,sorted.length ? Math.round(sorted[Math.floor((sorted.length-1)*.95)]*10)/10 : null];})),
      viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      durationMs:Math.round(performance.now()-start), p50FrameGapMs:percentile(.5), p95FrameGapMs:percentile(.95), maxFrameGapMs:Math.round(Math.max(...samples)*10)/10,
      framesOver50ms:samples.filter(value => value > 50).length, inspectDom,
      maxMountedRows:inspectDom ? maxMountedRows : null, maxMountedCells:inspectDom ? maxMountedCells : null, coverageMisses:inspectDom ? coverageMisses : null, horizontalCoverageMisses:inspectDom ? horizontalCoverageMisses : null,
      horizontalGaps, longTasks:supportsLongTasks ? tasks : 'unsupported', finalScrollTop:grid.scrollTop, finalScrollLeft:grid.scrollLeft};
  } finally { observer?.disconnect(); }
}

/** Frame scheduler baseline: no table mutation or per-frame DOM inspection. */
export async function checkIdleFrames() {
  const gaps: number[] = [];
  let previous = await frame();
  for (let index = 0; index < 120; index++) {
    if (document.visibilityState !== 'visible') throw new Error('后台页不能用于空闲帧基线');
    const time = await frame(); gaps.push(time-previous); previous = time;
  }
  const ordered = [...gaps].sort((a,b) => a-b);
  return {kind:'idle-frame-baseline',sampleCount:gaps.length,
    p50FrameGapMs:Math.round(ordered[59]*10)/10,p95FrameGapMs:Math.round(ordered[113]*10)/10,
    maxFrameGapMs:Math.round(Math.max(...gaps)*10)/10,framesOver50ms:gaps.filter(gap=>gap>50).length,
    viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}};
}


/** Bounded pointer diagnostics; observes only this fixture viewport and never changes input. */
export function traceScrollbarPointer(root: HTMLElement) {
  const events: object[] = [];
  let stopped = false;
  const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture'];
  const listener = (event: Event) => {
    if (!(event instanceof PointerEvent) || events.length >= 128) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest('.overlay-scrollbar') && !events.length) return;
    events.push({ type:event.type, trusted:event.isTrusted, primary:event.isPrimary, pointerType:event.pointerType,
      id:event.pointerId, button:event.button, buttons:event.buttons, target:target?.className, axis:target?.closest(".overlay-scrollbar")?.className,
      left:root.querySelector('.grid-scroll')?.scrollLeft, top:root.querySelector('.grid-scroll')?.scrollTop });
    if (event.type === 'pointerdown' && target instanceof HTMLElement) {
      const id = event.pointerId;
      queueMicrotask(() => {
        if (!stopped && events.length < 128) events.push({type:'after-pointerdown', connected:target.isConnected,
          captured:target.hasPointerCapture(id), top:root.querySelector('.grid-scroll')?.scrollTop});
      });
    }
  };
  types.forEach(type => root.addEventListener(type, listener, {capture:true,passive:true}));
  return () => { stopped = true; types.forEach(type => root.removeEventListener(type, listener, true)); return events; };
}
