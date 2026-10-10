/** Real layout regression: run against the currently rendered empty state. */
export async function checkEmptyStateLayout(root: HTMLElement) {
  const overlay = root.querySelector<HTMLElement>('.empty-state');
  const content = overlay?.querySelector<HTMLElement>('.empty-state-content') ?? overlay;
  const grid = root.querySelector<HTMLElement>('[role="grid"], [role="treegrid"]');
  if (!overlay || !content || !grid) throw new Error('先切换到初载、失败或空数据状态');
  const checks: string[] = [];
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); checks.push(message); };
  overlay.scrollTop = 0;
  const box = overlay.getBoundingClientRect(), shell = overlay.parentElement!.getBoundingClientRect();
  assert(box.bottom <= shell.bottom + 1, '空态不越过记录区底边');
  assert(content.getBoundingClientRect().top >= box.top - 1, '内容首部没有落在负滚动区域');
  const icon = content.querySelector('svg');
  if (icon) assert(icon.getBoundingClientRect().height >= 33, '空态图标保留自然高度');
  const title = content.querySelector('strong');
  if (!title) throw new Error('状态标题缺失');
  title.scrollIntoView({block:'nearest',inline:'nearest'});
  const titleBox = title.getBoundingClientRect(), titleViewport = overlay.getBoundingClientRect();
  assert(titleBox.top >= titleViewport.top - 1 && titleBox.bottom <= titleViewport.bottom + 1, '状态标题可以完整滚入视口');
  const action = content.querySelector<HTMLButtonElement>('button');
  if (action) {
    action.focus(); action.scrollIntoView({block:'nearest',inline:'nearest'});
    const actionBox = action.getBoundingClientRect(), viewport = overlay.getBoundingClientRect(), host = root.getBoundingClientRect();
    assert(actionBox.top >= viewport.top - 1 && actionBox.bottom <= viewport.bottom + 1, '状态操作可以完整滚入空态视口');
    assert(actionBox.top >= host.top - 1 && actionBox.bottom <= host.bottom + 1, '状态操作没有被宿主容器裁切');
  }
  return {checks, title:title.textContent, viewportHeight:grid.clientHeight, overlayHeight:overlay.clientHeight, scrollHeight:overlay.scrollHeight};
}

/** Focus without automatic scrolling so the component must reveal its own active record. */
export async function checkLastRecordLayout(root: HTMLElement) {
  const grid = root.querySelector<HTMLElement>('[role="grid"], [role="treegrid"]');
  if (!grid || Number(grid.getAttribute('aria-rowcount')) < 2) throw new Error('先恢复记录');
  grid.focus({preventScroll:true});
  grid.dispatchEvent(new KeyboardEvent('keydown',{key:'End',ctrlKey:true,bubbles:true,cancelable:true}));
  await new Promise(resolve => setTimeout(resolve,80));
  const active = document.getElementById(grid.getAttribute('aria-activedescendant') ?? '');
  if (!active) throw new Error('活动记录未挂载');
  const cell = active.getBoundingClientRect(), viewport = grid.getBoundingClientRect(), host = root.getBoundingClientRect();
  if (cell.top < viewport.top - 1 || cell.bottom > viewport.bottom + 1) throw new Error('活动记录被网格裁切');
  if (cell.top < host.top - 1 || cell.bottom > host.bottom + 1) throw new Error('活动记录被组件外层布局裁切');
  return {active:active.textContent,gridHeight:grid.clientHeight,hostHeight:root.clientHeight,hostScrollTop:root.scrollTop,checks:['末行挂载','网格内完整可见','组件外层内完整可见']};
}

/** Resize the owned fixture host while keeping logical focus unchanged. */
export async function checkFocusedResize(root: HTMLElement, middle = false) {
  const grid = root.querySelector<HTMLElement>('[role="grid"], [role="treegrid"]'), host = root.parentElement;
  if (!grid || !host || Number(grid.getAttribute('aria-rowcount')) < 8) throw new Error('先装载 500 行数据');
  const wait = () => new Promise(resolve => setTimeout(resolve,80));
  const originalHeight = host.style.height;
  const samples: {height:number;active:string|null;gridHeight:number;scrollTop:number}[] = [];
  try {
    host.style.height = '340px'; await wait();
    grid.focus({preventScroll:true});
    grid.dispatchEvent(new KeyboardEvent('keydown',{key:middle ? 'Home' : 'End',ctrlKey:true,bubbles:true,cancelable:true})); await wait();
    if (middle) for (let index=0;index<5;index++) {
      grid.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true})); await wait();
    }
    const identity = grid.getAttribute('aria-activedescendant');
    for (const height of [120,90,340]) {
      host.style.height = `${height}px`; await wait();
      if (document.activeElement !== grid || grid.getAttribute('aria-activedescendant') !== identity) throw new Error('尺寸变化丢失活动记录或焦点');
      const active = document.getElementById(identity ?? '');
      if (!active) throw new Error('尺寸变化后活动记录未挂载');
      const cell=active.getBoundingClientRect(), viewport=grid.getBoundingClientRect(), bounds=root.getBoundingClientRect();
      if (cell.top < viewport.top+35 || cell.bottom > viewport.bottom+1) throw new Error(`${height}px：活动记录被内层网格裁切`);
      if (cell.top < bounds.top-1 || cell.bottom > bounds.bottom+1) throw new Error(`${height}px：活动记录被组件外层裁切`);
      samples.push({height,active:active.textContent,gridHeight:grid.clientHeight,scrollTop:grid.scrollTop});
    }
    return {position:middle?'middle':'last',samples,checks:['活动身份不变','焦点不丢失','三种尺寸内外层可见']};
  } finally { host.style.height=originalHeight; await wait(); }
}

/** Width changes must preserve focus and reveal the active ordinary column past frozen cells. */
export async function checkFocusedWidth(root: HTMLElement, middle = false, narrow = false) {
  const grid=root.querySelector<HTMLElement>('[role="grid"], [role="treegrid"]'), host=root.parentElement;
  if (!grid || !host || Number(grid.getAttribute('aria-colcount')) < 40) throw new Error('先装载 42 列完整数据');
  const originalWidth=host.style.width, wait=()=>new Promise(resolve=>setTimeout(resolve,80));
  const samples: {width:number;active:string|null;scrollLeft:number;visibleWidth:number;frozenColumns:number}[]=[];
  try {
    host.style.width='900px'; await wait(); grid.focus({preventScroll:true});
    grid.dispatchEvent(new KeyboardEvent('keydown',{key:'End',ctrlKey:true,bubbles:true,cancelable:true})); await wait();
    if (middle) for(let i=0;i<1;i++) { grid.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true})); await wait(); }
    const identity=grid.getAttribute('aria-activedescendant');
    for(const width of narrow ? [500,320,900] : [700,600,900]) {
      host.style.width=`${width}px`; await wait();
      if(document.activeElement!==grid || grid.getAttribute('aria-activedescendant')!==identity) throw new Error('宽度变化丢失活动身份或焦点');
      const active=document.getElementById(identity??''); if(!active) throw new Error('活动列未挂载');
      const cell=active.getBoundingClientRect(), viewport=grid.getBoundingClientRect();
      const row=active.parentElement!;
      const frozen=Array.from(row.children).filter(element=>getComputedStyle(element).position==='sticky');
      const left=Math.max(viewport.left,...frozen.filter(element=>element!==active).map(element=>element.getBoundingClientRect().right));
      if(cell.left<left-1 || cell.right>viewport.right+1) throw new Error(`${width}px：活动列被视口或冻结列裁切`);
      samples.push({width,active:active.textContent,scrollLeft:grid.scrollLeft,visibleWidth:viewport.width,frozenColumns:row.querySelectorAll(".frozen-column").length});
    }
    return {position:middle?'middle':'last',samples,checks:['活动身份不变','焦点不丢失','活动列不被冻结区域遮挡']};
  } finally {host.style.width=originalWidth; await wait();}
}

/** Search must not widen the table; keyboard focus reveals every toolbar action. */
export function checkToolbarLayout(root: HTMLElement) {
  const toolbar=root.querySelector<HTMLElement>('.table-toolbar'), actions=toolbar?.querySelector<HTMLElement>('.toolbar-left');
  if(!toolbar || !actions) throw new Error('工具栏缺失');
  const bounds=root.getBoundingClientRect(), box=toolbar.getBoundingClientRect();
  if(root.scrollWidth>root.clientWidth+1 || Math.abs(root.scrollLeft)>1) throw new Error('工具栏撑宽或横向移动整个表格');
  const visible=(element:Element, left:number, right:number)=>{
    const cell=element.getBoundingClientRect(); return cell.left>=left-1 && cell.right<=right+1;
  };
  const checks=['表格布局没有横向溢出'];
  for(const button of actions.querySelectorAll<HTMLButtonElement>('button')) {
    button.focus();
    const group=actions.getBoundingClientRect();
    if(!visible(button,Math.max(group.left,bounds.left),Math.min(group.right,bounds.right))) throw new Error(`${button.textContent}聚焦后仍被裁切`);
    checks.push(`${button.textContent}聚焦后可见`);
  }
  const input=toolbar.querySelector<HTMLInputElement>('input'), close=toolbar.querySelector<HTMLButtonElement>('[aria-label="关闭搜索"]');
  if(input && close) {
    if(!visible(input,box.left,box.right) || input.clientWidth<56 || !visible(close,box.left,box.right)) throw new Error('搜索输入或关闭按钮被裁切');
    checks.push('搜索输入与关闭按钮完整可见');
    close.focus();
  }
  if(Math.abs(root.scrollLeft)>1) throw new Error('聚焦操作使表格整体横向移动');
  return {viewport:{width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio,visualScale:window.visualViewport?.scale},width:root.clientWidth,actionScrollWidth:actions.scrollWidth,actionViewport:actions.clientWidth,searchWidth:input?.clientWidth??null,checks};
}

/** A controlled active view must be visible without automatic locator scrolling. */
export function checkActiveViewLayout(root: HTMLElement) {
  const group=root.querySelector<HTMLElement>('.view-tabs'), active=group?.querySelector<HTMLElement>('.view-tab[aria-pressed="true"]');
  const wrap=active?.closest<HTMLElement>('.view-tab-wrap');
  if(!group || !active || !wrap) throw new Error('当前视图缺失');
  const bounds=group.getBoundingClientRect(), cell=wrap.getBoundingClientRect();
  if(cell.left<bounds.left-1 || cell.right>bounds.right+1) throw new Error('当前视图标签及菜单没有完整显露');
  if(root.scrollWidth>root.clientWidth+1 || root.scrollLeft>1) throw new Error('视图切换撑宽或滚动整个表格');
  return {active:active.textContent,offset:group.scrollLeft,width:group.clientWidth,focused:document.activeElement===active,checks:['当前标签和菜单完整可见','整个表格没有横向溢出']};
}

/** Isolate real focus semantics from a locator's automatic pointer/scroll actions. */
export async function checkViewTooltipFocus(root: HTMLElement, first = false) {
  const button=root.querySelector<HTMLButtonElement>(first ? '.view-tab' : '.view-tab[aria-pressed="true"]');
  if(!button) throw new Error('当前视图缺失');
  const tabs=button.closest<HTMLElement>('.view-tabs')!;
  const beforeOffset=tabs.scrollLeft;
  const initialBounds=button.getBoundingClientRect(), viewport=tabs.getBoundingClientRect();
  if(first && initialBounds.left>=viewport.left && initialBounds.right<=viewport.right) throw new Error('首个标签原本可见，无法验证滚动显露');
  const events: string[]=[];
  const focus=()=>events.push('focus'), click=()=>events.push('click'), pointer=()=>events.push('pointerdown');
  const scroll=(event:Event)=>{
    if(event.target instanceof Node && event.target.contains(button)) events.push('ancestor-scroll');
  };
  button.addEventListener('focus',focus);button.addEventListener('click',click);button.addEventListener('pointerdown',pointer);window.addEventListener('scroll',scroll,true);
  try {
    button.focus({preventScroll:true});
    await new Promise(resolve=>setTimeout(resolve,100));
    const tooltip=document.getElementById(button.getAttribute('aria-describedby')??'');
    if(document.activeElement!==button || !tooltip || tooltip.textContent!==button.textContent) throw new Error(`焦点提示未展示完整名称：${JSON.stringify(events)} / ${button.dataset.state}`);
    if(events.some(event=>event==='click' || event==='pointerdown' || (!first && event==='ancestor-scroll'))) throw new Error(`隔离验收出现其他输入或滚动：${JSON.stringify(events)}`);
    const afterBounds=button.getBoundingClientRect();
    if(first && (afterBounds.left<viewport.left-1 || afterBounds.right>viewport.right+1 || tabs.scrollLeft===beforeOffset)) throw new Error('焦点标签没有完整滚动显露');
    return {nameLength:button.textContent?.length,state:button.dataset.state,beforeOffset,afterOffset:tabs.scrollLeft,events,checks:['真实焦点保持','完整可访问提示',first ? '滚动显露后完整提示可见' : '没有指针激活或祖先自动滚动']};
  } finally {button.removeEventListener('focus',focus);button.removeEventListener('click',click);button.removeEventListener('pointerdown',pointer);window.removeEventListener('scroll',scroll,true);}
}

/** Bounded fixture trace; no global typing values or production telemetry. */
export async function checkViewTooltipCancellation(root: HTMLElement) {
  const button=root.querySelector<HTMLButtonElement>('.view-tab')!;
  const checks:string[]=[];
  const wait=()=>new Promise(resolve=>setTimeout(resolve,100));
  for(const key of ['Escape','Enter',' ']) {
    button.blur();button.focus({preventScroll:true});
    button.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));
    await wait();
    if(button.getAttribute('aria-describedby')) throw new Error(`${key} 后提示重新打开`);
    checks.push(`待打开时 ${key===' '?'Space':key} 取消`);
  }
  button.blur();button.focus({preventScroll:true});button.blur();await wait();
  if(button.getAttribute('aria-describedby')) throw new Error('失焦后提示重新打开');
  checks.push('待打开时失焦取消');
  button.focus({preventScroll:true});await wait();
  if(!button.getAttribute('aria-describedby')) throw new Error('重新聚焦没有打开提示');
  const tabs=button.closest<HTMLElement>('.view-tabs')!;
  tabs.scrollLeft+=20;await wait();
  if(button.getAttribute('aria-describedby')) throw new Error('后续滚动没有关闭提示');
  checks.push('重新聚焦可打开','后续局部滚动正常关闭');
  return {input:'fixture DOM focus / synthetic keydown; not native keyboard',checks};
}

export function traceViewInput(root: HTMLElement) {
  const tabs=root.querySelector<HTMLElement>('.view-tabs');
  if(!tabs) throw new Error('视图标签缺失');
  const events:string[]=[];
  const capture=(event:Event)=>{if(events.length<40)events.push(event.type);};
  const scroll=(event:Event)=>{if(event.target instanceof Node && event.target.contains(tabs) && events.length<40)events.push('ancestor-scroll');};
  const types=['pointerdown','pointerup','click','focusin','focusout','keydown','keyup'];
  types.forEach(type=>tabs.addEventListener(type,capture,true));window.addEventListener('scroll',scroll,true);
  return () => {
    types.forEach(type=>tabs.removeEventListener(type,capture,true));window.removeEventListener('scroll',scroll,true);
    const active=tabs.querySelector<HTMLButtonElement>('.view-tab[aria-pressed="true"]');
    return {events,state:active?.dataset.state,focused:document.activeElement===active};
  };
}


/** Native keyboard evidence: observes focus/navigation only, never input values. */
export function traceKeyboardFocus(root: HTMLElement) {
  const events: object[] = [];
  const describe = (element: Element) => ({tag:element.tagName, role:element.getAttribute('role'),
    name:element.getAttribute('aria-label') ?? (element.matches('button') ? element.textContent?.trim().slice(0,80) : null),
    scope:root.contains(element) ? 'table' : element.closest('.ntable-portal') ? 'portal' : 'host'});
  const focus = (event: Event) => {
    if (event.target instanceof Element && events.length < 128) events.push({type:'focusin',...describe(event.target)});
  };
  const key = (event: KeyboardEvent) => {
    if (['Tab','Enter','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key) && events.length < 128)
      events.push({type:'keydown',key:event.key,alt:event.altKey,shift:event.shiftKey,
        ...(event.target instanceof Element ? describe(event.target) : {})});
  };
  document.addEventListener('focusin',focus,true);
  document.addEventListener('keydown',key,true);
  return () => {
    document.removeEventListener('focusin',focus,true); document.removeEventListener('keydown',key,true);
    return {events,active:document.activeElement ? describe(document.activeElement) : null};
  };
}
