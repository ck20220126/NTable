import { forwardRef, memo, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, ChevronDown, ChevronRight, ListFilter, ListTree, Plus, TextCursorInput } from "lucide-react";
import { iconForType } from "./fieldIcons";
import type { TableProps } from "./types";
const defaultGetSubRows = (row) => row.children ?? [];

function collectDefaultExpanded(rows, getSubRows, result = new Set()) {
  rows.forEach((row) => {
    const children = getSubRows(row);
    if (row.defaultExpanded && children.length) result.add(row.id);
    if (children.length) collectDefaultExpanded(children, getSubRows, result);
  });
  return result;
}

function viewCacheKey(view, search, expanded) {
  return JSON.stringify({
    id: view.id,
    visibleFieldIds: view.visibleFieldIds,
    columnOrder: view.columnOrder,
    filters: view.filters,
    sorts: view.sorts,
    search,
    expanded: [...expanded].sort(),
  });
}

export function Table({ fields, rows, activeView, onUpdateView, onAddSubRecord, onOpenRecord, search = "", getSubRows = defaultGetSubRows, getCellProps }: TableProps) {
  const [selected, setSelected] = useState(() => new Set());
  const [draggingFieldId, setDraggingFieldId] = useState(null);
  const [dragTargetIndex, setDragTargetIndex] = useState(-1);
  const [dragGeometry, setDragGeometry] = useState({ left: 0, top: 0, height: 0 });
  const [resizingFieldId, setResizingFieldId] = useState(null);
  const [expanded, setExpanded] = useState(() => collectDefaultExpanded(rows, getSubRows));
  const [liveWidths, setLiveWidths] = useState(activeView.columnWidths ?? {});
  const [viewLoading, setViewLoading] = useState(false);
  const [highlightedFieldId, setHighlightedFieldId] = useState(null);
  const [headerMenu, setHeaderMenu] = useState(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const freezeHandleRef = useRef<HTMLSpanElement>(null);
  const columnDragRef = useRef(null);
  const viewTreeCacheRef = useRef(new Map());
  const tableView = useDeferredValue(activeView);
  const isViewPending = tableView.id !== activeView.id;
  const highlightColumn = (fieldId) => {
    setHighlightedFieldId(null);
    requestAnimationFrame(() => {
      setHighlightedFieldId(fieldId);
      const target = scrollRef.current?.querySelector(`[data-field-id="${fieldId}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  };
  const activeViewCacheKey = viewCacheKey(activeView, search, expanded);
  const hasCachedActiveView = viewTreeCacheRef.current.get(activeViewCacheKey)?.rowsSource === rows;
  useEffect(() => {
    setViewLoading(!hasCachedActiveView);
  }, [activeView.id, activeViewCacheKey, hasCachedActiveView, rows]);
  useEffect(() => {
    if (tableView.id === activeView.id) setViewLoading(false);
  }, [tableView.id, activeView.id]);
  useEffect(() => () => columnDragRef.current?.cancel(), [activeView.id, activeView.columnOrder, activeView.visibleFieldIds]);
  useEffect(() => {
    if (!headerMenu) return undefined;
    const close = () => setHeaderMenu(null);
    const closeOnEscape = (event) => event.key === "Escape" && close();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); window.removeEventListener("resize", close); };
  }, [headerMenu]);
  useEffect(() => {
    const clearColumnHighlight = (event) => {
      if (!event.target.closest?.(".grid-head-cell")) setHighlightedFieldId(null);
    };
    document.addEventListener("pointerdown", clearColumnHighlight, true);
    return () => document.removeEventListener("pointerdown", clearColumnHighlight, true);
  }, []);
  const fieldById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const orderedFields = useMemo(() => tableView.columnOrder.filter((id) => tableView.visibleFieldIds.includes(id)).map((id) => fieldById.get(id)).filter(Boolean), [tableView.columnOrder, tableView.visibleFieldIds, fieldById]);
  const treeState = useMemo(() => {
    const cacheKey = viewCacheKey(tableView, search, expanded);
    const cached = viewTreeCacheRef.current.get(cacheKey);
    if (cached?.rowsSource === rows) return cached.tree;
    const term = search.trim().toLocaleLowerCase();
    const activeFilters = tableView.filters.filter((filter) => filter.fieldId && filter.value !== "");
    const hasQuery = Boolean(term || activeFilters.length);
    const matches = (row) => activeFilters.every((filter) => {
      if (!filter.fieldId || filter.value === "") return true;
      const value = String(row[filter.fieldId] ?? "");
      if (filter.operator === "contains") return value.toLocaleLowerCase().includes(String(filter.value).toLocaleLowerCase());
      if (filter.operator === "notEquals") return value !== String(filter.value);
      return value === String(filter.value);
    }) && (!term || orderedFields.some((field) => field.searchable !== false && String(row[field.id] ?? "").toLocaleLowerCase().includes(term)));
    const sortSiblings = (items) => tableView.sorts.length ? [...items].sort((a, b) => {
      for (const sort of tableView.sorts) {
        const comparison = String(a[sort.fieldId] ?? "").localeCompare(String(b[sort.fieldId] ?? ""), "zh-CN", { numeric: true });
        if (comparison) return sort.direction === "desc" ? -comparison : comparison;
      }
      return 0;
    }) : items;
    const includeAll = (row) => ({ row, children: sortSiblings(getSubRows(row)).map(includeAll) });
    const build = (row) => {
      const childNodes = sortSiblings(getSubRows(row)).map(build).filter(Boolean);
      const selfMatches = matches(row);
      if (hasQuery && !selfMatches && childNodes.length === 0) return null;
      return { row, children: hasQuery && selfMatches ? sortSiblings(getSubRows(row)).map(includeAll) : childNodes };
    };
    const roots = sortSiblings(rows).map(build).filter(Boolean);
    const flattened = [];
    let rootIndex = 0;
    const flatten = (nodes, depth = 0) => nodes.forEach((node) => {
      const hasChildren = node.children.length > 0;
      flattened.push({ row: node.row, depth, hasChildren, childCount: node.children.length, displayIndex: depth === 0 ? ++rootIndex : null });
      if (hasChildren && (hasQuery || expanded.has(node.row.id))) flatten(node.children, depth + 1);
    });
    flatten(roots);
    const countNodes = (nodes) => nodes.reduce((total, node) => total + 1 + countNodes(node.children), 0);
    const tree = { rows: flattened, matchedCount: countNodes(roots), hasQuery };
    viewTreeCacheRef.current.set(cacheKey, { rowsSource: rows, tree });
    return tree;
  }, [rows, tableView.filters, tableView.sorts, orderedFields, search, expanded, getSubRows]);
  const displayedRows = treeState.rows;
  const virtualizer = useVirtualizer({ count: displayedRows.length, getScrollElement: () => scrollRef.current, estimateSize: () => 32, overscan: 12 });
  useEffect(() => { virtualizer.scrollToOffset(0); setSelected(new Set()); }, [tableView.id]);
  useEffect(() => { setLiveWidths(tableView.columnWidths ?? {}); }, [tableView.id, tableView.columnWidths]);
  const widths = liveWidths;
  const frozenCount = Math.min(tableView.frozenFieldCount ?? 0, Math.max(0, orderedFields.length - 1));
  const frozenLefts = orderedFields.map((_, index) => 42 + orderedFields.slice(0, index).reduce((sum, field) => sum + (widths[field.id] ?? field.width ?? 140), 0));
  const highlightedFieldIndex = orderedFields.findIndex((field) => field.id === highlightedFieldId);
  const highlightedColumnLeft = highlightedFieldIndex >= 0 ? frozenLefts[highlightedFieldIndex] : 0;
  const highlightedColumnWidth = highlightedFieldIndex >= 0 ? (widths[orderedFields[highlightedFieldIndex].id] ?? orderedFields[highlightedFieldIndex].width ?? 140) : 0;
  const gridTemplate = `42px ${orderedFields.map((field) => `${widths[field.id] ?? field.width ?? 140}px`).join(" ")}`;
  const minWidth = 42 + orderedFields.reduce((sum, field) => sum + (widths[field.id] ?? field.width ?? 140), 0);
  const draggedFieldIndex = orderedFields.findIndex((field) => field.id === draggingFieldId);
  const draggedField = draggedFieldIndex >= 0 ? orderedFields[draggedFieldIndex] : null;
  const draggedColumnLeft = draggedFieldIndex >= 0
    ? 42 + orderedFields.slice(0, draggedFieldIndex).reduce((sum, field) => sum + (widths[field.id] ?? field.width ?? 140), 0)
    : 0;
  // The insertion slot belongs to the unchanged grid, not a live reordered preview.
  const dropIndicatorLeft = 42 + orderedFields.slice(0, Math.max(0, dragTargetIndex))
    .reduce((sum, field) => sum + (widths[field.id] ?? field.width ?? 140), 0);
  const startColumnDrag = (event, field, index) => {
    if (event.button !== 0 || event.target.closest(".resize-handle, .freeze-handle, .header-action")) return;
    columnDragRef.current?.cancel();
    const viewport = scrollRef.current;
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = 42 + orderedFields.slice(0, index)
      .reduce((sum, item) => sum + (widths[item.id] ?? item.width ?? 140), 0);
    const grabOffset = startX - viewport.getBoundingClientRect().left + viewport.scrollLeft - startLeft;
    let x = startX, y = startY, active = false, slot = index, frame = 0, finished = false;
    const update = () => {
      const rect = viewport.getBoundingClientRect();
      const contentX = x - rect.left + viewport.scrollLeft;
      let edge = 42;
      slot = orderedFields.length;
      for (let i = 0; i < orderedFields.length; i++) {
        const width = widths[orderedFields[i].id] ?? orderedFields[i].width ?? 140;
        if (contentX < edge + width / 2) { slot = i; break; }
        edge += width;
      }
      setDragTargetIndex(slot === index || slot === index + 1 ? -1 : slot);
      setDragGeometry({
        left: contentX - grabOffset,
        top: viewport.scrollTop,
        height: Math.min(viewport.clientHeight, Math.max(32, 32 + virtualizer.getTotalSize() - viewport.scrollTop)),
      });
    };
    const tick = () => {
      const rect = viewport.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        const distance = x < rect.left + 40 ? x - rect.left - 40 : x > rect.right - 40 ? x - rect.right + 40 : 0;
        const before = viewport.scrollLeft;
        viewport.scrollLeft += Math.max(-18, Math.min(18, distance / 3));
        if (before !== viewport.scrollLeft) update();
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (e) => {
      if (e.pointerId !== pointerId) return;
      x = e.clientX; y = e.clientY;
      if (!active && Math.hypot(x - startX, y - startY) < 4) return;
      if (!active) {
        active = true;
        event.preventDefault();
        handle.setPointerCapture(pointerId);
        setDraggingFieldId(field.id);
        frame = requestAnimationFrame(tick);
      }
      update();
    };
    const finish = (commit = false) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("blur", cancel);
      viewport.removeEventListener("scroll", onScroll);
      handle.removeEventListener("lostpointercapture", cancel);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      columnDragRef.current = null;
      setDraggingFieldId(null);
      setDragTargetIndex(-1);
      const rect = viewport.getBoundingClientRect();
      if (commit && !active) {
        highlightColumn(field.id);
        return;
      }
      if (!commit || !active || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
      const to = slot > index ? slot - 1 : slot;
      if (to === index) return;
      const next = orderedFields.map((item) => item.id);
      next.splice(to, 0, next.splice(index, 1)[0]);
      // Keep hidden fields in their existing slots in the saved view.
      let visibleIndex = 0;
      onUpdateView(activeView.id, { columnOrder: activeView.columnOrder.map((id) =>
        activeView.visibleFieldIds.includes(id) ? next[visibleIndex++] : id) });
    };
    const up = (e) => { if (e.pointerId === pointerId) { x = e.clientX; y = e.clientY; if (active) update(); finish(true); } };
    const cancel = () => finish();
    const keydown = (e) => { if (e.key === "Escape") { e.preventDefault(); finish(); } };
    const onScroll = () => { if (active) update(); };
    columnDragRef.current = { cancel };
    handle.addEventListener("lostpointercapture", cancel);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown);
    window.addEventListener("blur", cancel);
    viewport.addEventListener("scroll", onScroll, { passive: true });
  };
  const previewResize = (fieldId, width) => setLiveWidths((current) => ({ ...current, [fieldId]: width }));
  const commitResize = (fieldId, width) => {
    const nextWidths = { ...liveWidths, [fieldId]: width };
    setLiveWidths(nextWidths);
    setResizingFieldId(null);
    onUpdateView(activeView.id, { columnWidths: nextWidths });
  };
  const setFrozenCount = (count) => onUpdateView(activeView.id, { frozenFieldCount: Math.max(0, Math.min(count, Math.max(0, orderedFields.length - 1))) });
  const updateFreezeHandle = (event) => {
    const viewport = scrollRef.current;
    const handle = freezeHandleRef.current;
    if (!viewport || !handle || !frozenCount) return;
    if (viewport.classList.contains("is-freeze-dragging")) return;
    const rect = viewport.getBoundingClientRect();
    const boundaryLeft = 42 + orderedFields.slice(0, frozenCount).reduce((sum, field) => sum + (widths[field.id] ?? field.width ?? 140), 0);
    const nearBoundary = event.clientY > rect.top + 36 && Math.abs(event.clientX - (rect.left + boundaryLeft)) <= 13;
    viewport.classList.toggle("is-freeze-boundary-hovered", nearBoundary);
    handle.classList.toggle("visible", nearBoundary);
    if (nearBoundary) {
      handle.style.left = `${boundaryLeft}px`;
      handle.style.top = `${Math.max(48, Math.min(viewport.clientHeight - 12, event.clientY - rect.top))}px`;
    }
  };
  const hideFreezeHandle = () => {
    if (scrollRef.current?.classList.contains("is-freeze-dragging")) return;
    scrollRef.current?.classList.remove("is-freeze-boundary-hovered");
    freezeHandleRef.current?.classList.remove("visible");
  };
  const startFreezeDrag = (event) => {
    event.preventDefault(); event.stopPropagation();
    const viewport = scrollRef.current;
    let nextCount = frozenCount;
    const update = (clientX) => {
      const x = clientX - viewport.getBoundingClientRect().left;
      let edge = 42;
      nextCount = 0;
      for (let index = 0; index < orderedFields.length; index++) {
        edge += widths[orderedFields[index].id] ?? orderedFields[index].width ?? 140;
        if (x >= edge - (widths[orderedFields[index].id] ?? orderedFields[index].width ?? 140) / 2) nextCount = index + 1;
        else break;
      }
      nextCount = Math.min(nextCount, Math.max(0, orderedFields.length - 1));
      const targetLeft = viewport.scrollLeft + 42 + orderedFields.slice(0, nextCount).reduce((sum, field) => sum + (widths[field.id] ?? field.width ?? 140), 0);
      viewport.style.setProperty("--freeze-target-left", `${targetLeft}px`);
      const pointerLeft = Math.max(42, Math.min(viewport.clientWidth, x));
      viewport.style.setProperty("--freeze-pointer-left", `${viewport.scrollLeft + pointerLeft}px`);
      viewport.style.setProperty("--freeze-preview-top", `${viewport.scrollTop}px`);
      viewport.style.setProperty("--freeze-preview-height", `${viewport.clientHeight}px`);
      viewport.classList.add("is-freeze-dragging");
      freezeHandleRef.current?.classList.add("visible");
      if (freezeHandleRef.current) freezeHandleRef.current.style.left = `${pointerLeft}px`;
    };
    const move = (moveEvent) => update(moveEvent.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      viewport.classList.remove("is-freeze-dragging");
      viewport.style.removeProperty("--freeze-preview-top"); viewport.style.removeProperty("--freeze-preview-height");
      viewport.style.removeProperty("--freeze-target-left");
      viewport.style.removeProperty("--freeze-pointer-left");
      hideFreezeHandle();
      setFrozenCount(nextCount);
    };
    update(event.clientX);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
  };
  const toggleAll = () => setSelected(selected.size === displayedRows.length ? new Set() : new Set(displayedRows.map((item) => item.row.id)));
  const toggleExpanded = (rowId) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
    return next;
  });
  

  return <div className="ntable-table">
    <AutoHideScrollArea onBoundaryPointerMove={updateFreezeHandle} onBoundaryPointerLeave={hideFreezeHandle} freezeHandleRef={freezeHandleRef} onFreezeHandlePointerDown={startFreezeDrag} freezeBoundaryLeft={frozenCount > 0 ? frozenLefts[frozenCount - 1] + (widths[orderedFields[frozenCount - 1].id] ?? orderedFields[frozenCount - 1].width ?? 140) : null} className={`grid-scroll${draggingFieldId ? " is-column-dragging" : ""}${resizingFieldId ? " is-column-resizing" : ""}`} ref={scrollRef} role="grid" aria-rowcount={displayedRows.length}><div className="grid-inner" style={{ minWidth }}>{highlightedFieldIndex >= 0 && <div className={`selected-column-mask${highlightedFieldIndex < frozenCount ? " frozen" : ""}`} aria-hidden="true" style={{ left: highlightedColumnLeft, width: highlightedColumnWidth }} />}{draggedField && <div className="column-drag-layer" aria-hidden="true" style={{ top: dragGeometry.top, height: dragGeometry.height }}><div className="column-drag-highlight" style={{ left: draggedColumnLeft, width: widths[draggedField.id] ?? draggedField.width ?? 140 }} /><div className="column-drag-mask" style={{ left: dragGeometry.left, width: widths[draggedField.id] ?? draggedField.width ?? 140 }} />{dragTargetIndex >= 0 && <div className="column-drop-indicator" style={{ left: dropIndicatorLeft }} />}</div>}<div className="grid-header" role="row" style={{ gridTemplateColumns: gridTemplate }}><div className={`row-check header-check${frozenCount ? " frozen-row-check" : ""}`} role="columnheader"><Checkbox.Root className="checkbox" checked={displayedRows.length > 0 && selected.size === displayedRows.length} onCheckedChange={toggleAll}><Checkbox.Indicator><Check size={12} /></Checkbox.Indicator></Checkbox.Root></div>{orderedFields.map((field, index) => <HeaderCell key={field.id} field={field} width={widths[field.id] ?? field.width ?? 140} isDragging={draggingFieldId === field.id} isHighlighted={highlightedFieldId === field.id} isResizing={resizingFieldId === field.id} frozen={index < frozenCount} lastFrozen={index === frozenCount - 1} stickyLeft={frozenLefts[index]} onClick={(event) => { if (!event.target.closest(".resize-handle, .freeze-handle, .header-action")) highlightColumn(field.id); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setHeaderMenu({ x: event.clientX, y: event.clientY, index, field }); }} onOpenMenu={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setHeaderMenu({ x: Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188)), y: rect.bottom + 4, index, field }); }} onPointerDown={(event) => startColumnDrag(event, field, index)} onResizeStart={() => setResizingFieldId(field.id)} onResize={(width) => previewResize(field.id, width)} onResizeEnd={(width) => commitResize(field.id, width)} />)}</div>
      <div className="virtual-body" style={{ height: virtualizer.getTotalSize() }}>{virtualizer.getVirtualItems().map((virtualRow) => { const item = displayedRows[virtualRow.index]; const row = item.row; const checked = selected.has(row.id); const isExpanded = treeState.hasQuery || expanded.has(row.id); return <div key={row.id} className={`${checked ? "grid-row selected" : "grid-row"}${item.depth ? " child-row" : ""}`} role="row" aria-rowindex={virtualRow.index + 2} aria-level={item.depth + 1} aria-expanded={item.hasChildren ? isExpanded : undefined} style={{ gridTemplateColumns: gridTemplate, height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }} onDoubleClick={() => onOpenRecord(row)}><div className={`row-check${frozenCount ? " frozen-row-check" : ""}`} role="gridcell"><span className="row-number">{item.displayIndex}</span><Checkbox.Root className="checkbox row-checkbox" checked={checked} onCheckedChange={() => setSelected((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; })}><Checkbox.Indicator><Check size={12} /></Checkbox.Indicator></Checkbox.Root></div>{orderedFields.map((field, fieldIndex) => <Cell key={field.id} field={field} value={row[field.id]} cellProps={getCellProps?.(row, field)} style={fieldIndex < frozenCount ? { left: frozenLefts[fieldIndex] } : undefined} columnState={`${resizingFieldId === field.id ? "resizing-column " : ""}${highlightedFieldId === field.id ? "highlighted-column " : ""}${fieldIndex < frozenCount ? "frozen-column " : ""}${fieldIndex === frozenCount - 1 ? "last-frozen" : ""}`} tree={fieldIndex === 0 ? { depth: item.depth, isLastChild: item.depth > 0 && (displayedRows[virtualRow.index + 1]?.depth ?? 0) < item.depth, hasChildren: item.hasChildren, childCount: item.childCount, expanded: isExpanded, onToggle: () => toggleExpanded(row.id), onAdd: onAddSubRecord ? () => onAddSubRecord(row) : null } : null} />)}</div>; })}</div>
      {displayedRows.length === 0 && <div className="empty-state"><ListFilter size={34} /><strong>没有符合条件的记录</strong><span>调整筛选条件或清空搜索后重试</span></div>}
    </div>{(isViewPending || viewLoading) && <div className="view-loading" role="status" aria-live="polite"><span className="view-loading-spinner" />正在加载视图数据…</div>}</AutoHideScrollArea>
    {headerMenu && <div className="header-context-menu" role="menu" style={{ left: headerMenu.x, top: headerMenu.y }} onPointerDown={(event) => event.stopPropagation()}><button role="menuitem" disabled={headerMenu.index === orderedFields.length - 1 || frozenCount === headerMenu.index + 1} onClick={() => { setFrozenCount(headerMenu.index + 1); setHeaderMenu(null); }}>冻结至「{headerMenu.field.title}」</button>{frozenCount > 0 && <><span className="menu-separator" /><button role="menuitem" onClick={() => { setFrozenCount(0); setHeaderMenu(null); }}>取消冻结</button></>}</div>}
    <footer className="table-footer"><span>{treeState.matchedCount.toLocaleString()} 条记录</span>{selected.size > 0 && <span className="selection-count">已选择 {selected.size} 条</span>}</footer>
  </div>;
}

const AutoHideScrollArea = forwardRef(function AutoHideScrollArea({ className, children, freezeBoundaryLeft, freezeHandleRef, onFreezeHandlePointerDown, onBoundaryPointerMove, onBoundaryPointerLeave, ...props }: any, forwardedRef) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [metrics, setMetrics] = useState({ vertical: null, horizontal: null, scrollTop: 0, scrollLeft: 0 });
  const [hovered, setHovered] = useState(false);

  useImperativeHandle(forwardedRef, () => viewportRef.current, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const updateMetrics = () => {
      const { clientHeight, clientWidth, scrollHeight, scrollWidth, scrollTop, scrollLeft } = viewport;
      const verticalTrack = Math.max(0, clientHeight - (scrollWidth > clientWidth ? 10 : 0));
      const horizontalTrack = Math.max(0, clientWidth - (scrollHeight > clientHeight ? 10 : 0));
      const verticalSize = scrollHeight > clientHeight ? Math.max(28, verticalTrack * clientHeight / scrollHeight) : 0;
      const horizontalSize = scrollWidth > clientWidth ? Math.max(28, horizontalTrack * clientWidth / scrollWidth) : 0;
      setMetrics({
        scrollTop,
        scrollLeft,
        vertical: verticalSize ? { size: verticalSize, offset: (verticalTrack - verticalSize) * scrollTop / (scrollHeight - clientHeight) } : null,
        horizontal: horizontalSize ? { size: horizontalSize, offset: (horizontalTrack - horizontalSize) * scrollLeft / (scrollWidth - clientWidth) } : null,
      });
    };
    const reveal = () => {
      setVisible(true);
      window.clearTimeout(hideTimerRef.current);
      if (!hovered) hideTimerRef.current = window.setTimeout(() => setVisible(false), 900);
    };
    const onScroll = () => { updateMetrics(); reveal(); };
    const onResize = () => updateMetrics();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(viewport);
    resizeObserver.observe(viewport.firstElementChild ?? viewport);
    updateMetrics();
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
      window.clearTimeout(hideTimerRef.current);
    };
  }, [hovered]);

  const reveal = () => {
    setVisible(true);
    window.clearTimeout(hideTimerRef.current);
    if (!hovered) hideTimerRef.current = window.setTimeout(() => setVisible(false), 900);
  };
  const scrollByThumb = (axis, event) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const start = axis === "vertical" ? event.clientY : event.clientX;
    const startScroll = axis === "vertical" ? viewport.scrollTop : viewport.scrollLeft;
    const trackSize = axis === "vertical" ? viewport.clientHeight : viewport.clientWidth;
    const viewportSize = axis === "vertical" ? viewport.clientHeight : viewport.clientWidth;
    const contentSize = axis === "vertical" ? viewport.scrollHeight : viewport.scrollWidth;
    const thumb = metrics[axis];
    if (!thumb) return;
    const thumbElement = event.currentTarget;
    thumbElement.setPointerCapture?.(event.pointerId);
    const move = (moveEvent) => {
      const delta = (axis === "vertical" ? moveEvent.clientY : moveEvent.clientX) - start;
      const maxScroll = contentSize - viewportSize;
      const track = trackSize - thumb.size - (axis === "vertical" && metrics.horizontal ? 10 : 0);
      const next = Math.max(0, Math.min(maxScroll, startScroll + delta * maxScroll / Math.max(1, track)));
      if (axis === "vertical") viewport.scrollTop = next;
      else viewport.scrollLeft = next;
    };
    const end = () => {
      thumbElement.removeEventListener("pointermove", move);
      thumbElement.removeEventListener("pointerup", end);
      thumbElement.removeEventListener("pointercancel", end);
    };
    thumbElement.addEventListener("pointermove", move);
    thumbElement.addEventListener("pointerup", end);
    thumbElement.addEventListener("pointercancel", end);
    reveal();
  };
  return <div className={`auto-scroll-shell${visible || hovered ? " scrollbars-visible" : ""}`} onPointerMove={onBoundaryPointerMove} onPointerEnter={() => { setHovered(true); setVisible(true); }} onPointerLeave={() => { onBoundaryPointerLeave?.(); setHovered(false); window.clearTimeout(hideTimerRef.current); setVisible(false); }}>
    <div {...props} ref={viewportRef} className={`${className} auto-scroll-area`}>{children}</div>
    {freezeBoundaryLeft !== null && <><div className="freeze-boundary-line" aria-hidden="true" style={{ left: freezeBoundaryLeft }} /><span ref={freezeHandleRef} className="freeze-region-handle" role="separator" aria-label="可拖拽改变冻结区域" onPointerDown={onFreezeHandlePointerDown} /></>}
    {metrics.vertical && <div className="overlay-scrollbar overlay-scrollbar-vertical" aria-hidden="true"><span style={{ height: metrics.vertical.size, transform: `translateY(${metrics.vertical.offset}px)` }} onPointerDown={(event) => scrollByThumb("vertical", event)} /></div>}
    {metrics.horizontal && <div className="overlay-scrollbar overlay-scrollbar-horizontal" aria-hidden="true"><span style={{ width: metrics.horizontal.size, transform: `translateX(${metrics.horizontal.offset}px)` }} onPointerDown={(event) => scrollByThumb("horizontal", event)} /></div>}
  </div>;
});

function HeaderCell({ field, width, isDragging, isHighlighted, isResizing, frozen, lastFrozen, stickyLeft, onClick, onContextMenu, onOpenMenu, onPointerDown, onResizeStart, onResize, onResizeEnd }: any) {
  const Icon = iconForType[field.type] ?? TextCursorInput;
  const hoverResize = (event) => {
    const viewport = event.currentTarget.closest(".grid-scroll");
    if (viewport.classList.contains("is-column-resizing")) return;
    const rect = viewport.getBoundingClientRect();
    viewport.style.setProperty("--resize-line-left", `${event.currentTarget.parentElement.getBoundingClientRect().right - rect.left + viewport.scrollLeft}px`);
    viewport.style.setProperty("--resize-line-top", `${viewport.scrollTop}px`);
    viewport.style.setProperty("--resize-line-height", `${viewport.clientHeight}px`);
    viewport.classList.add("is-column-resize-hovered");
  };
  const leaveResize = (event) => event.currentTarget.closest(".grid-scroll")?.classList.remove("is-column-resize-hovered");
  const startResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); const startX = event.clientX; const startWidth = width;
    const handle = event.currentTarget;
    const viewport = handle.closest(".grid-scroll");
    const headerRight = handle.parentElement.getBoundingClientRect().right;
    const pointerId = event.pointerId;
    let latestWidth = startWidth;
    const showLine = () => {
      const rect = viewport.getBoundingClientRect();
      viewport.style.setProperty("--resize-line-left", `${headerRight - rect.left + viewport.scrollLeft + latestWidth - startWidth}px`);
      viewport.style.setProperty("--resize-line-top", `${viewport.scrollTop}px`);
      viewport.style.setProperty("--resize-line-height", `${viewport.clientHeight}px`);
    };
    onResizeStart();
    viewport.classList.remove("is-column-resize-hovered");
    showLine();
    handle.setPointerCapture(pointerId);
    const move = (moveEvent) => { if (moveEvent.pointerId !== pointerId) return; latestWidth = Math.max(88, Math.min(1200, startWidth + moveEvent.clientX - startX)); showLine(); onResize(latestWidth); };
    const finish = (cancelled = false) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", keydown);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      ["--resize-line-left", "--resize-line-top", "--resize-line-height"].forEach((name) => viewport.style.removeProperty(name));
      onResizeEnd(cancelled ? startWidth : latestWidth);
    };
    const up = (upEvent) => { if (upEvent.pointerId === pointerId) finish(); };
    const cancel = () => finish(true);
    const keydown = (keyEvent) => { if (keyEvent.key === "Escape") cancel(); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel); window.addEventListener("keydown", keydown);
  };
  return <div draggable={false} data-field-id={field.id} style={frozen ? { left: stickyLeft } : undefined} className={`grid-head-cell${isDragging ? " dragging" : ""}${isHighlighted ? " highlighted" : ""}${isResizing ? " resizing" : ""}${frozen ? " frozen-column" : ""}${lastFrozen ? " last-frozen" : ""}`} role="columnheader" onClick={onClick} onContextMenu={onContextMenu} onPointerDown={onPointerDown}><Icon size={15} /><span>{field.title}</span><button type="button" className="header-action" aria-label={`${field.title}列菜单`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpenMenu(event); }}><ChevronDown size={13} /></button><button className="resize-handle" draggable="false" aria-label={`调整${field.title}列宽`} onPointerEnter={hoverResize} onPointerLeave={leaveResize} onPointerDown={startResize} /></div>;
}

const Cell = memo(function Cell({ field, value, columnState, tree, style, cellProps }: any) {
  const className = `grid-cell${columnState ? ` ${columnState}` : ""}${tree ? " tree-cell" : ""}`;
  const treePrefix = tree ? <span className="tree-prefix" style={{ width: tree.depth * 22 + 18 }}>
    {tree.depth > 0 && <span className={`tree-connector${tree.isLastChild ? " last-child" : ""}`} style={{ left: (tree.depth - 1) * 22 + 4 }} />}
    {tree.hasChildren && <button className="tree-toggle" aria-label={tree.expanded ? "收起子规格" : "展开子规格"} onClick={(event) => { event.stopPropagation(); tree.onToggle(); }} onDoubleClick={(event) => event.stopPropagation()}>{tree.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>}
  </span> : null;
  let content = value;
  if (field.type === "singleSelect") { const item = field.options?.find((option) => option.value === value); content = item ? <span className="tag" style={{ background: item.color }}>{item.label}</span> : "—"; }
  if (field.type === "multiSelect") content = Array.isArray(value) ? value.map((item) => <span className="tag" key={item}>{field.options?.find((option) => option.value === item)?.label ?? item}</span>) : "—";
  return <div className={`${className}${cellProps?.className ? ` ${cellProps.className}` : ""}`} style={{ ...cellProps?.style, ...style }} role="gridcell" title={String(value ?? "")}>{treePrefix}<span className={tree ? "tree-value" : undefined}>{content}</span>{tree?.hasChildren && <span className="tree-row-actions">{tree.onAdd && <button className="tree-add" aria-label="添加子规格" onClick={(event) => { event.stopPropagation(); tree.onAdd(); }} onDoubleClick={(event) => event.stopPropagation()}><Plus size={13} /></button>}<span className="tree-child-count" aria-label={`${tree.childCount} 个子规格`}><ListTree size={13} />{tree.childCount}</span></span>}</div>;
});
