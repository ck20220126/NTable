import { windowedColumns, fittingFrozenCount, columnGeometry, columnDropTarget, freezeDropTarget, frozenCountAfterMove } from "./columnWindow";
import { projectTree, TreeProjectionCache, collectRecordIds, collectDefaultExpanded, selectionState, toggleVisibleSelection } from "./tree";
import { forwardRef, memo, useCallback, useId, useDeferredValue, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import * as Checkbox from "@radix-ui/react-checkbox";
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import { Check, Minus, ChevronDown, ChevronRight, ListFilter, ListTree, TextCursorInput } from "lucide-react";
import { iconForType } from "./fieldIcons";
import { Tooltip } from "../components/Tooltip";
import { Button } from "../components/Button";
import { moveGridPosition, resolveActiveRow, selectRowRange } from "./keyboard";
import { tableDataState } from "./dataState";
import { scrollbarMetrics, scrollFromThumb, resizedScrollOffset } from "./scrollbar";
import type { TableProps, Field, TableRecord, TableView } from "./types";
import type { DisplayRow } from "./tree";
import type { ScrollbarMetrics } from "./scrollbar";
import type { CSSProperties, HTMLAttributes, ReactNode, RefObject, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
type HeaderMenu = { x: number; y: number; index: number; field: Field };
type ActiveCell = { rowId: string | null; fieldId: string | null };
interface ScrollMetrics { vertical: ScrollbarMetrics | null; horizontal: ScrollbarMetrics | null; scrollTop: number; scrollLeft: number }
interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  overlay?: ReactNode; freezeBoundaryLeft: number | null; freezeHandleRef: RefObject<HTMLSpanElement | null>;
  onFreezeHandlePointerDown: (event: ReactPointerEvent<HTMLSpanElement>) => void;
  onBoundaryPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onBoundaryPointerLeave: () => void;
}
interface HeaderCellProps {
  cellId: string; columnIndex: number; active: boolean; field: Field; gestureScope: string; width: number;
  isDragging: boolean; isHighlighted: boolean; isResizing: boolean; frozen: boolean; lastFrozen: boolean; terminal: boolean; stickyLeft: number;
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void; onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onOpenMenu: (event: ReactMouseEvent<HTMLButtonElement>) => void; onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeStart: () => void; onResize: (width: number) => void; onResizeEnd: (width: number) => void; onResizeCancel: () => void;
}
interface CellProps {
  cellId: string; columnIndex: number; active: boolean; field: Field; value: unknown; columnState: string; style?: CSSProperties;
  cellProps?: ReturnType<NonNullable<TableProps["getCellProps"]>>;
  tree: DisplayRow | null; dividerInset: number; expanded: boolean; onToggle: (rowId: string) => void;
}
function revealActiveInLayouts(viewport: HTMLElement) {
  const active = document.getElementById(viewport.getAttribute("aria-activedescendant") ?? "");
  if (!active || !viewport.contains(active) || viewport.clientHeight < 36) return;
  const cell = active.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
  const header = active.closest<HTMLElement>("[data-grid-row]")?.dataset.gridRow === "-1";
  const top = bounds.top + (header ? 0 : 36), bottom = bounds.top + viewport.clientHeight;
  if (cell.top < top - 1) viewport.scrollTop += cell.top - top;
  else if (cell.bottom > bottom + 1) viewport.scrollTop += cell.bottom - bottom;
  if (!active.matches(".frozen-column, .frozen-row-check")) {
    const frozenCells = active.parentElement?.querySelectorAll<HTMLElement>(".frozen-column, .frozen-row-check") ?? [];
    const left = Math.max(bounds.left, ...Array.from(frozenCells, cell => cell.getBoundingClientRect().right));
    const right = bounds.left + viewport.clientWidth;
    // A narrow host cannot show both edges; keep the leading edge available.
    if (cell.width > right - left || cell.left < left - 1) viewport.scrollLeft += cell.left - left;
    else if (cell.right > right + 1) viewport.scrollLeft += cell.right - right;
  }
  for (let layout = viewport.parentElement; layout; layout = layout.parentElement) {
    if (!layout.matches(".ntable-table, .ntable") || layout.scrollHeight <= layout.clientHeight) continue;
    const cell = active.getBoundingClientRect(), bounds = layout.getBoundingClientRect();
    const top = bounds.top + layout.clientTop, bottom = top + layout.clientHeight;
    if (cell.top < top) layout.scrollTop += cell.top - top;
    else if (cell.bottom > bottom) layout.scrollTop += cell.bottom - bottom;
  }
}

const defaultGetSubRows = (row: TableRecord) => row.children ?? [];

function viewCacheKey(view: TableView, search: string, expanded: Set<string>) {
  return JSON.stringify({
    id: view.id,
    visibleFieldIds: view.visibleFieldIds,
    columnOrder: view.columnOrder,
    filters: view.filters,
    filterMode: view.filterMode ?? "all",
    sorts: view.sorts,
    search,
    expanded: [...expanded].sort(),
  });
}

export function Table({ fields, rows, activeView, onUpdateView, onOpenRecord, search = "", getSubRows = defaultGetSubRows, getCellProps, loading = false, error, onRetry, onClearQuery }: TableProps) {
  const [selected, setSelected] = useState(() => new Set<string>());
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [pressedFieldId, setPressedFieldId] = useState<string | null>(null);
  const [dragTargetIndex, setDragTargetIndex] = useState(-1);
  const [dropIndicatorLeft, setDropIndicatorLeft] = useState(0);
  const [dragGeometry, setDragGeometry] = useState({ left: 0, top: 0, height: 0 });
  const [resizingFieldId, setResizingFieldId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(() => collectDefaultExpanded(rows, getSubRows));
  const [liveWidths, setLiveWidths] = useState(activeView.columnWidths ?? {});
  const [highlightedFieldId, setHighlightedFieldId] = useState<string | null>(null);
  const [headerMenu, setHeaderMenu] = useState<HeaderMenu | null>(null);
  const gridId = useId();
  const [gridFocused, setGridFocused] = useState(false);
  const [columnViewport, setColumnViewport] = useState({left:0,width:0});
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeCell, setActiveCell] = useState<ActiveCell>({ rowId: rows[0]?.id ?? null, fieldId: fields[0]?.id ?? null });
  const previousRows = useRef<DisplayRow[]>([]);
  const selectionAnchor = useRef<{ id: string; base: Set<string> } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const freezeHandleRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    let left = -1, width = -1;
    const update = (synchronous = false) => {
      // 冻结列的选中浮层用它把内容坐标补成视口坐标。直接写样式而不是过 React：
      // 渲染链路跟不上逐帧滚动，浮层会从冻结列上滑开。
      viewport.style.setProperty("--grid-scroll-left", `${viewport.scrollLeft}px`);
      if (left === viewport.scrollLeft && width === viewport.clientWidth) return;
      left = viewport.scrollLeft; width = viewport.clientWidth;
      const commit = () => setColumnViewport({left, width});
      if (synchronous) flushSync(commit);
      else commit();
    };
    // Native scrolling moves geometry before React's ordinary batched update commits.
    const onScroll = () => update(true);
    viewport.addEventListener("scroll", onScroll, {passive:true});
    const observer = new ResizeObserver(() => update());
    observer.observe(viewport); update();
    return () => { viewport.removeEventListener("scroll", onScroll); observer.disconnect(); };
  }, []);
  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      if (document.activeElement === viewport) revealActiveInLayouts(viewport);
    });
    for (let layout = viewport.parentElement; layout; layout = layout.parentElement) {
      if (layout.matches(".ntable-table, .ntable")) observer.observe(layout);
    }
    return () => observer.disconnect();
  }, []);
  const pendingFreezeRef = useRef<{ viewId: string; count: number } | null>(null);
  const columnDragRef = useRef<{ cancel: () => void } | null>(null);
  const freezeDragRef = useRef<(() => void) | null>(null);
  const viewTreeCacheRef = useRef(new TreeProjectionCache());
  const tableView = useDeferredValue(activeView);
  const isViewPending = tableView !== activeView;
  useEffect(() => {
    setHeaderMenu(null);
    setHighlightedFieldId(null);
    scrollRef.current?.classList.remove("is-column-resize-hovered", "is-freeze-boundary-hovered");
  }, [activeView.id]);
  const highlightColumn = (fieldId: string) => {
    setHighlightedFieldId(null);
    requestAnimationFrame(() => {
      setHighlightedFieldId(fieldId);
      const target = Array.from(scrollRef.current?.querySelectorAll<HTMLElement>("[data-field-id]") ?? []).find(node => node.dataset.fieldId === fieldId);
      target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    });
  };
  useEffect(() => {
    if (!headerMenu) return undefined;
    const close = () => setHeaderMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", closeOnEscape); window.removeEventListener("resize", close); };
  }, [headerMenu]);
  useEffect(() => {
    const clearColumnHighlight = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".grid-head-cell")) setHighlightedFieldId(null);
    };
    document.addEventListener("pointerdown", clearColumnHighlight, true);
    return () => document.removeEventListener("pointerdown", clearColumnHighlight, true);
  }, []);
  const fieldById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const orderedFields = useMemo(() => tableView.columnOrder.filter((id) => tableView.visibleFieldIds.includes(id)).map((id) => fieldById.get(id)).filter((field): field is Field => field !== undefined), [tableView.columnOrder, tableView.visibleFieldIds, fieldById]);
  useLayoutEffect(() => {
    if (pressedFieldId && !orderedFields.some(field => field.id === pressedFieldId)) columnDragRef.current?.cancel();
  }, [pressedFieldId, orderedFields]);
  useLayoutEffect(() => {
    if (!headerMenu || orderedFields[headerMenu.index] === headerMenu.field) return;
    const ownedFocus = menuRef.current?.contains(document.activeElement);
    setHeaderMenu(null);
    if (ownedFocus) scrollRef.current?.focus({ preventScroll: true });
  }, [headerMenu, orderedFields]);
  const treeState = useMemo(() => {
    const cacheKey = viewCacheKey(tableView, search, expanded);
    const cached = viewTreeCacheRef.current.get(cacheKey, rows, fields, getSubRows);
    if (cached) return cached;
    const tree = projectTree(rows, tableView, orderedFields, fieldById, search, expanded, getSubRows);
    viewTreeCacheRef.current.set(cacheKey, tree);
    return tree;
  }, [rows, tableView.id, tableView.filters, tableView.filterMode, tableView.sorts, fieldById, orderedFields, search, expanded, getSubRows]);
  const displayedRows = treeState.rows;
  const visibleIds = useMemo(() => displayedRows.map(item => item.row.id), [displayedRows]);
  const allSelectionState = selectionState(visibleIds, selected);
  const recordIds = useMemo(() => collectRecordIds(rows, getSubRows), [rows, getSubRows]);
  useEffect(() => {
    setSelected(current => {
      const next = new Set([...current].filter(id => recordIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [recordIds]);
  const activeRow = resolveActiveRow(activeCell.rowId, displayedRows, previousRows.current);
  const activeColumn = activeCell.fieldId === null ? 0 : Math.max(1, orderedFields.findIndex(field => field.id === activeCell.fieldId) + 1);
  const column = Math.min(activeColumn, orderedFields.length);
  const rangeExtractor = useCallback((range: Parameters<typeof defaultRangeExtractor>[0]) => {
    const indexes = defaultRangeExtractor(range);
    return activeRow < 0 ? indexes : [...new Set([...indexes, activeRow])].sort((a, b) => a - b);
  }, [activeRow]);
  const virtualizer = useVirtualizer({ count: displayedRows.length, getScrollElement: () => scrollRef.current, estimateSize: () => 32, overscan: 4, rangeExtractor });
  const cellId = (rowIndex: number, columnIndex: number) => `${gridId}-cell-${rowIndex}-${columnIndex}`;
  useLayoutEffect(() => {
    previousRows.current = displayedRows;
    const rowId = displayedRows[activeRow]?.row.id ?? null;
    const fieldId = orderedFields[column - 1]?.id ?? null;
    if (rowId !== activeCell.rowId || fieldId !== activeCell.fieldId) setActiveCell({ rowId, fieldId });
  }, [displayedRows, activeRow, column, orderedFields, activeCell]);
  useEffect(() => { selectionAnchor.current = null; }, [displayedRows]);
  useLayoutEffect(() => {
    if (!headerMenu || !menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const x = Math.max(8, Math.min(headerMenu.x, window.innerWidth - rect.width - 8));
    const y = Math.max(8, Math.min(headerMenu.y, window.innerHeight - rect.height - 8));
    if (x !== headerMenu.x || y !== headerMenu.y) setHeaderMenu(current => current ? { ...current, x, y } : current);
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [headerMenu]);
  const dataState = tableDataState(rows.length, displayedRows.length, loading, error);
  const initialState = dataState === "loading" || dataState === "error";
  const activeCellId = cellId(activeRow, column);
  const hasHierarchy = useMemo(() => rows.some(row => getSubRows(row).length > 0), [rows, getSubRows]);
  useEffect(() => { virtualizer.scrollToOffset(0); setSelected(new Set()); }, [tableView.id]);
  useLayoutEffect(() => {
    if (!resizingFieldId) setLiveWidths(activeView.columnWidths ?? {});
  }, [activeView.id, activeView.columnWidths, resizingFieldId]);
  const widths = liveWidths;
  const fieldWidths = useMemo(() => orderedFields.map(field => widths[field.id] ?? field.width ?? 140), [orderedFields, widths]);
  const geometry = useMemo(() => columnGeometry(fieldWidths), [fieldWidths]);
  const committedWidthsRef = useRef(activeView.columnWidths ?? {});
  committedWidthsRef.current = activeView.columnWidths ?? {};
  const gestureScope = useMemo(() => {
    const visibleIds = new Set(activeView.visibleFieldIds);
    return JSON.stringify([
      activeView.id, activeView.frozenFieldCount ?? 0, columnViewport.width,
      activeView.columnOrder.filter(id => visibleIds.has(id) && fieldById.has(id))
        .map(id => [id, activeView.columnWidths?.[id] ?? fieldById.get(id)?.width ?? 140]),
    ]);
  }, [activeView.id, activeView.frozenFieldCount, activeView.columnOrder, activeView.visibleFieldIds, activeView.columnWidths, columnViewport.width, fieldById]);
  useLayoutEffect(() => () => {
    columnDragRef.current?.cancel();
    freezeDragRef.current?.();
  }, [gestureScope]);
  const requestedFrozenCount = Math.min(tableView.frozenFieldCount ?? 0, Math.max(0, orderedFields.length - 1));
  const frozenCount = fittingFrozenCount(fieldWidths, requestedFrozenCount, columnViewport.width);
  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (gridFocused && !resizingFieldId && viewport) revealActiveInLayouts(viewport);
  }, [gridFocused, activeCellId, dataState, frozenCount, columnViewport.width, fieldWidths, resizingFieldId]);
  useLayoutEffect(() => {
    const pending = pendingFreezeRef.current;
    if (!pending || (pending.viewId === tableView.id && pending.count !== requestedFrozenCount)) return;
    pendingFreezeRef.current = null;
    const viewport = scrollRef.current;
    viewport?.classList.remove("is-freeze-settling");
    ["--freeze-preview-top", "--freeze-preview-height"].forEach((name) => viewport?.style.removeProperty(name));
    viewport?.parentElement?.style.removeProperty("--freeze-target-left");
  }, [tableView.id, requestedFrozenCount]);
  const frozenLefts = geometry.offsets;
  const frozenCellStyles = useMemo(() => orderedFields.map((_, index) =>
    index < frozenCount ? { left: geometry.offsets[index] } : undefined
  ), [orderedFields, geometry, frozenCount]);
  const highlightedFieldIndex = orderedFields.findIndex((field) => field.id === highlightedFieldId);
  // 冻结列的浮层靠 CSS 的 --grid-scroll-left 补偿（见滚动监听），这里只给内容坐标。
  // 不在渲染里加 scrollLeft：那条链路是 滚动 → flushSync → 渲染，跟不上逐帧，
  // 连续拖动滚动条时浮层会滞后（实测 41 帧里 40 帧有偏差，最大 9px）。
  const highlightedColumnLeft = highlightedFieldIndex >= 0 ? frozenLefts[highlightedFieldIndex] : 0;
  const highlightedColumnWidth = highlightedFieldIndex >= 0 ? (widths[orderedFields[highlightedFieldIndex].id] ?? orderedFields[highlightedFieldIndex].width ?? 140) : 0;
  const gridTemplate = geometry.gridTemplate;
  const minWidth = geometry.totalWidth;
  const draggedFieldIndex = orderedFields.findIndex((field) => field.id === draggingFieldId);
  const draggedField = draggedFieldIndex >= 0 ? orderedFields[draggedFieldIndex] : null;
  const renderedFields = windowedColumns(fieldWidths, columnViewport.left, columnViewport.width, frozenCount,
    [column-1, draggedFieldIndex, orderedFields.findIndex(field => field.id === pressedFieldId), orderedFields.findIndex(field => field.id === resizingFieldId), headerMenu?.index ?? -1, highlightedFieldIndex])
    .map(index => ({field:orderedFields[index],index}));
  const draggedColumnLeft = draggedFieldIndex >= 0
    ? geometry.offsets[draggedFieldIndex] + (draggedFieldIndex < frozenCount ? columnViewport.left : 0)
    : 0;
  const draggedColumnClip = draggedFieldIndex >= frozenCount && frozenCount > 0
    ? Math.max(0, geometry.offsets[frozenCount] + columnViewport.left - draggedColumnLeft)
    : 0;
  // The insertion slot belongs to the unchanged grid, not a live reordered preview.
  const startColumnDrag = (event: ReactPointerEvent<HTMLDivElement>, field: Field, index: number) => {
    if (event.button !== 0 || !event.isPrimary || (event.target instanceof Element && event.target.closest(".resize-handle, .freeze-handle, .header-action"))) return;
    columnDragRef.current?.cancel();
    const viewport = scrollRef.current;
    if (!viewport) return;
    const handle = event.currentTarget;
    setPressedFieldId(field.id);
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    const grabOffset = startX - handle.getBoundingClientRect().left;
    let x = startX, y = startY, active = false, slot = index, frame = 0, finished = false;
    const update = () => {
      const rect = viewport.getBoundingClientRect();
      const contentX = x - rect.left + viewport.scrollLeft;
      const sourceClip = index >= frozenCount && frozenCount > 0
        ? Math.max(0, geometry.offsets[frozenCount] + viewport.scrollLeft - geometry.offsets[index]) : 0;
      viewport.style.setProperty("--column-drag-source-clip", `${sourceClip}px`);
      const target = columnDropTarget(geometry.offsets, frozenCount, viewport.scrollLeft, x - rect.left);
      slot = target.slot;
      setDropIndicatorLeft(target.left);
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
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      x = e.clientX; y = e.clientY;
      if (!active && Math.hypot(x - startX, y - startY) < 4) return;
      if (!active) {
        if (!handle.isConnected) { finish(); return; }
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
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("blur", cancel);
      viewport.removeEventListener("scroll", onScroll);
      handle.removeEventListener("lostpointercapture", cancel);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      columnDragRef.current = null;
      viewport.style.removeProperty("--column-drag-source-clip");
      setDraggingFieldId(null);
      setPressedFieldId(null);
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
      const nextFrozen = frozenCountAfterMove(frozenCount, index, to);
      onUpdateView(activeView.id, {
        columnOrder: activeView.columnOrder.map((id) =>
          activeView.visibleFieldIds.includes(id) ? next[visibleIndex++] : id),
        ...(nextFrozen === frozenCount ? {} : { frozenFieldCount: nextFrozen }),
      });
    };
    const up = (e: PointerEvent) => { if (e.pointerId === pointerId) { x = e.clientX; y = e.clientY; if (active) update(); finish(true); } };
    const cancel = (cancelEvent?: Event) => {
      if (cancelEvent instanceof PointerEvent && cancelEvent.pointerId !== pointerId) return;
      finish();
    };
    const keydown = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(); } };
    const onScroll = () => { if (active) update(); };
    columnDragRef.current = { cancel };
    handle.addEventListener("lostpointercapture", cancel);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", keydown, true);
    window.addEventListener("blur", cancel);
    viewport.addEventListener("scroll", onScroll, { passive: true });
  };
  const previewResize = (fieldId: string, width: number) => setLiveWidths((current) => ({ ...current, [fieldId]: width }));
  const commitResize = (fieldId: string, width: number) => {
    const nextWidths = { ...committedWidthsRef.current, [fieldId]: width };
    setLiveWidths(nextWidths);
    setResizingFieldId(null);
    onUpdateView(activeView.id, { columnWidths: nextWidths });
  };
  const setFrozenCount = (count: number) => onUpdateView(activeView.id, { frozenFieldCount: Math.max(0, Math.min(count, Math.max(0, orderedFields.length - 1))) });
  const updateFreezeHandle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const viewport = scrollRef.current;
    const handle = freezeHandleRef.current;
    if (!viewport || !handle || !frozenCount) return;
    if (viewport.classList.contains("is-freeze-dragging") || viewport.classList.contains("is-freeze-settling")) return;
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
  const startFreezeDrag = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); event.stopPropagation();
    freezeDragRef.current?.();
    const viewport = scrollRef.current;
    if (!viewport) return;
    const pointerId = event.pointerId;
    let finished = false;
    let nextCount = frozenCount;
    const update = (clientX: number) => {
      const x = clientX - viewport.getBoundingClientRect().left;
      const target = freezeDropTarget(geometry.offsets, frozenCount, viewport.scrollLeft, x);
      nextCount = target.count;
      viewport.parentElement?.style.setProperty("--freeze-target-left", `${target.left}px`);
      const pointerLeft = Math.max(42, Math.min(viewport.clientWidth, x));
      viewport.style.setProperty("--freeze-pointer-left", `${viewport.scrollLeft + pointerLeft}px`);
      viewport.style.setProperty("--freeze-preview-top", `${viewport.scrollTop}px`);
      viewport.style.setProperty("--freeze-preview-height", `${viewport.clientHeight}px`);
      viewport.classList.add("is-freeze-dragging");
      freezeHandleRef.current?.classList.add("visible");
      if (freezeHandleRef.current) freezeHandleRef.current.style.left = `${pointerLeft}px`;
    };
    const move = (moveEvent: PointerEvent) => { if (moveEvent.pointerId === pointerId) update(moveEvent.clientX); };
    const finish = (commit: boolean) => {
      if (finished) return;
      finished = true;
      freezeDragRef.current = null;
      window.removeEventListener("keydown", keydown, true);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel);
      const changed = commit && nextCount !== frozenCount;
      if (changed) {
        // Keep the target guide until the deferred view has committed its new boundary.
        pendingFreezeRef.current = { viewId: tableView.id, count: nextCount };
        const committedCount = fittingFrozenCount(fieldWidths, nextCount, viewport.clientWidth);
        viewport.parentElement?.style.setProperty("--freeze-target-left", `${geometry.offsets[committedCount]}px`);
        viewport.classList.add("is-freeze-settling");
      }
      viewport.classList.remove("is-freeze-dragging");
      viewport.style.removeProperty("--freeze-pointer-left");
      if (!changed) {
        ["--freeze-preview-top", "--freeze-preview-height"].forEach((name) => viewport.style.removeProperty(name));
        viewport.parentElement?.style.removeProperty("--freeze-target-left");
      }
      hideFreezeHandle();
      freezeHandleRef.current?.style.removeProperty("left");
      freezeHandleRef.current?.style.removeProperty("top");
      if (changed) setFrozenCount(nextCount);
    };
    const up = (upEvent: PointerEvent) => { if (upEvent.pointerId === pointerId) { update(upEvent.clientX); finish(true); } };
    const cancel = (cancelEvent: PointerEvent) => { if (cancelEvent.pointerId === pointerId) finish(false); };
    const keydown = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); } };
    const blur = () => finish(false);
    freezeDragRef.current = blur;
    update(event.clientX);
    window.addEventListener("keydown", keydown, true); window.addEventListener("blur", blur);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel);
  };
  const toggleAll = () => setSelected(current => toggleVisibleSelection(visibleIds, current));
  const toggleExpanded = useCallback((rowId: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(rowId)) next.delete(rowId); else next.add(rowId);
    return next;
  }), []);

  const focusCell = (rowIndex: number, columnIndex: number, reveal = true) => {
    setActiveCell({ rowId: displayedRows[rowIndex]?.row.id ?? null, fieldId: orderedFields[columnIndex - 1]?.id ?? null });
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.focus({ preventScroll: true });
    if (!reveal) return;
    if (rowIndex < 0) virtualizer.scrollToOffset(0);
    else {
      const top = rowIndex * 32;
      const bottom = top + 32 + 36;
      if (top < viewport.scrollTop) virtualizer.scrollToOffset(top);
      else if (bottom > viewport.scrollTop + viewport.clientHeight) virtualizer.scrollToOffset(bottom - viewport.clientHeight);
    }
    if (columnIndex === 0 && frozenCount === 0) viewport.scrollLeft = 0;
    if (columnIndex > frozenCount) {
      const left = frozenLefts[columnIndex - 1];
      const right = left + (widths[orderedFields[columnIndex - 1].id] ?? orderedFields[columnIndex - 1].width ?? 140);
      const frozenWidth = frozenCount ? frozenLefts[frozenCount - 1] + (widths[orderedFields[frozenCount - 1].id] ?? orderedFields[frozenCount - 1].width ?? 140) : 42;
      if (left < viewport.scrollLeft + frozenWidth) viewport.scrollLeft = left - frozenWidth;
      else if (right > viewport.scrollLeft + viewport.clientWidth) viewport.scrollLeft = right - viewport.clientWidth;
    }
  };
  const reorderColumn = (index: number, delta: number) => {
    const neighbour = orderedFields[index + delta];
    if (!neighbour) return;
    const order = [...tableView.columnOrder];
    const from = order.indexOf(orderedFields[index].id);
    const to = order.indexOf(neighbour.id);
    [order[from], order[to]] = [order[to], order[from]];
    const nextFrozen = frozenCountAfterMove(frozenCount, index, index + delta);
    onUpdateView(tableView.id, {
      columnOrder: order,
      ...(nextFrozen === frozenCount ? {} : { frozenFieldCount: nextFrozen }),
    });
  };
  const resizeColumn = (index: number, delta: number) => {
    const field = orderedFields[index];
    if (field) commitResize(field.id, Math.max(88, Math.min(1200, (widths[field.id] ?? field.width ?? 140) + delta)));
  };
  const closeMenu = () => { setHeaderMenu(null); scrollRef.current?.focus({ preventScroll: true }); };
  const onGridKeyDown = (event: import("react").KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.nativeEvent.isComposing || initialState) return;
    const edge = event.ctrlKey || event.metaKey;
    const row = displayedRows[activeRow];
    const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
    if (activeRow === -1 && column > 0 && horizontal && (event.altKey || event.shiftKey) && !edge) {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      if (event.altKey) reorderColumn(column - 1, direction);
      else resizeColumn(column - 1, direction * 16);
      return;
    }
    if (event.altKey) return;
    if (edge && event.key.toLowerCase() === "a") {
      event.preventDefault(); setSelected(current => new Set([...current, ...visibleIds])); selectionAnchor.current = null; return;
    }
    if (edge && event.key !== "Home" && event.key !== "End") return;
    if (event.key === "Escape") { event.preventDefault(); setSelected(new Set()); selectionAnchor.current = null; return; }
    if (event.key === " ") {
      event.preventDefault(); selectionAnchor.current = null;
      if (!row) toggleAll();
      else setSelected(current => { const next = new Set(current); if (next.has(row.row.id)) next.delete(row.row.id); else next.add(row.row.id); return next; });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (row) onOpenRecord(row.row);
      else if (column === 0) toggleAll();
      else {
        const cell = document.getElementById(cellId(-1, column));
        const rect = cell?.getBoundingClientRect();
        if (rect) setHeaderMenu({ x: Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188)), y: rect.bottom + 4, index: column - 1, field: orderedFields[column - 1] });
      }
      return;
    }
    if (row && column === 1 && horizontal && !event.shiftKey && !edge) {
      const isExpanded = treeState.hasQuery || expanded.has(row.row.id);
      if (event.key === "ArrowRight" && row.hasChildren && !isExpanded) { event.preventDefault(); toggleExpanded(row.row.id); return; }
      if (event.key === "ArrowLeft" && row.hasChildren && isExpanded && !treeState.hasQuery) { event.preventDefault(); toggleExpanded(row.row.id); return; }
      if (event.key === "ArrowLeft" && row.depth > 0) {
        let parent = activeRow - 1;
        while (parent >= 0 && displayedRows[parent].depth >= row.depth) parent--;
        if (parent >= 0) { event.preventDefault(); focusCell(parent, column); return; }
      }
    }
    const next = moveGridPosition({ row: activeRow, column }, event.key, displayedRows.length, orderedFields.length + 1, Math.max(1, Math.floor(((scrollRef.current?.clientHeight ?? 356) - 36) / 32)), edge);
    if (!next) return;
    event.preventDefault();
    if (event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && activeRow >= 0 && next.row >= 0) {
      if (!selectionAnchor.current) selectionAnchor.current = { id: displayedRows[activeRow].row.id, base: new Set(selected) };
      const anchor = visibleIds.indexOf(selectionAnchor.current.id);
      setSelected(selectRowRange(visibleIds, anchor >= 0 ? anchor : activeRow, next.row, selectionAnchor.current.base));
    } else selectionAnchor.current = null;
    focusCell(next.row, next.column);
  };
  const onGridClick = (event: import("react").MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // Form proxies are not user navigation. Native row checkboxes own their active
    // cell update after onChange reads checked; capture updates can reset it first.
    if (target instanceof HTMLInputElement && (target.getAttribute("aria-hidden") === "true" || target.classList.contains("native-row-checkbox"))) return;
    const cell = target.closest<HTMLElement>("[data-grid-column]");
    const row = cell?.closest<HTMLElement>("[data-grid-row]");
    if (!cell || !row) return;
    const r = Number(row.dataset.gridRow), c = Number(cell.dataset.gridColumn);
    setActiveCell({ rowId: displayedRows[r]?.row.id ?? null, fieldId: orderedFields[c - 1]?.id ?? null });
    selectionAnchor.current = null;
    if (!target.closest(".header-action, .resize-handle")) scrollRef.current?.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    if (document.activeElement === scrollRef.current) focusCell(activeRow, column);
  }, [activeRow, column, displayedRows, orderedFields, gridFocused]);

  const emptyContent = displayedRows.length === 0 && <div className="empty-state" role={dataState === "error" ? "alert" : "status"}><div className="empty-state-content">
        {dataState === "loading" ? <><span className="view-loading-spinner" /><strong>正在加载记录…</strong></> : dataState === "error" ? <><ListFilter size={34} /><strong>记录加载失败</strong><span>{error}</span>{onRetry && <Button size="small" variant="outlined" onClick={() => { onRetry(); scrollRef.current?.focus({ preventScroll: true }); }}>重试</Button>}</> : dataState === "empty" ? <><ListFilter size={34} /><strong>暂无记录</strong><span>数据就绪后会显示在这里</span></> : rows.length > 0 ? <><ListFilter size={34} /><strong>没有符合条件的记录</strong><span>调整筛选条件或清空搜索后重试</span>{onClearQuery && <Button size="small" variant="outlined" onClick={() => { onClearQuery(); scrollRef.current?.focus({ preventScroll: true }); }}>清空搜索和筛选</Button>}</> : null}
      </div></div>;

  return <div className="ntable-table ntable-scope">
    <span id={`${gridId}-help`} className="ntable-sr-only">方向键浏览，Home 和 End 到行首行尾，Control 或 Command 加 Home 和 End 到表格首尾，PageUp 和 PageDown 翻页，空格选择，Shift 加上下键连续选择，Enter 打开记录，Escape 取消选择。首个数据列左右键展开或收起。表头 Enter 打开菜单，Alt 加左右键移动列，Shift 加左右键调整列宽。</span>
    {(dataState === "refreshing" || dataState === "refreshError") && <div className="table-data-status" role={loading ? "status" : "alert"}>
      {loading ? <><span className="view-loading-spinner" />正在更新数据…</> : <><span>更新失败：{error}</span>{onRetry && <Button size="small" onClick={() => { onRetry(); scrollRef.current?.focus({ preventScroll: true }); }}>重试</Button>}</>}
    </div>}
    <AutoHideScrollArea overlay={emptyContent} onBoundaryPointerMove={updateFreezeHandle} onBoundaryPointerLeave={hideFreezeHandle} freezeHandleRef={freezeHandleRef} onFreezeHandlePointerDown={startFreezeDrag} freezeBoundaryLeft={frozenCount > 0 ? frozenLefts[frozenCount - 1] + (widths[orderedFields[frozenCount - 1].id] ?? orderedFields[frozenCount - 1].width ?? 140) : null} className={`grid-scroll${draggingFieldId ? " is-column-dragging" : ""}${resizingFieldId ? " is-column-resizing" : ""}`} ref={scrollRef} role={hasHierarchy ? "treegrid" : "grid"} aria-label="记录表格" aria-describedby={`${gridId}-help`} tabIndex={0} aria-multiselectable="true" aria-busy={loading || isViewPending} aria-activedescendant={activeCellId} onKeyDown={onGridKeyDown} onFocus={(event) => { if (event.target === event.currentTarget) setGridFocused(true); }} onBlur={() => setGridFocused(false)} onClickCapture={onGridClick} aria-rowcount={displayedRows.length + 1} aria-colcount={orderedFields.length + 1}><div className="grid-inner" style={{ minWidth }}>{highlightedFieldIndex >= 0 && <div className={`selected-column-mask${highlightedFieldIndex < frozenCount ? " frozen" : ""}`} aria-hidden="true" style={{ left: highlightedColumnLeft, width: highlightedColumnWidth }} />}{draggedField && <div className="column-drag-layer" aria-hidden="true" style={{ top: dragGeometry.top, height: dragGeometry.height }}><div className="column-drag-highlight" style={{ left: draggedColumnLeft, width: widths[draggedField.id] ?? draggedField.width ?? 140, clipPath: `inset(0 0 0 var(--column-drag-source-clip, ${draggedColumnClip}px))` }} /><div className="column-drag-mask" style={{ left: dragGeometry.left, width: widths[draggedField.id] ?? draggedField.width ?? 140 }} />{dragTargetIndex >= 0 && <div className="column-drop-indicator" style={{ left: dropIndicatorLeft }} />}</div>}<div className="grid-header" role="row" data-grid-row={-1} aria-rowindex={1} style={{ gridTemplateColumns: gridTemplate }}><div className={`row-check header-check${frozenCount ? " frozen-row-check" : ""}`} role="columnheader" aria-colindex={1} data-grid-column={0} id={cellId(-1, 0)} data-active={activeRow === -1 && column === 0 || undefined}><Checkbox.Root tabIndex={-1} className="checkbox" aria-label="选择全部可见记录" checked={allSelectionState} onCheckedChange={toggleAll}><Checkbox.Indicator>{allSelectionState === "indeterminate" ? <Minus size={12} /> : <Check size={12} />}</Checkbox.Indicator></Checkbox.Root></div>{renderedFields.map(({field, index}) => <HeaderCell key={field.id} cellId={cellId(-1, index + 1)} columnIndex={index + 1} active={activeRow === -1 && column === index + 1} gestureScope={gestureScope} field={field} width={widths[field.id] ?? field.width ?? 140} isDragging={draggingFieldId === field.id} isHighlighted={highlightedFieldId === field.id} isResizing={resizingFieldId === field.id} frozen={index < frozenCount} lastFrozen={index === frozenCount - 1} terminal={index === orderedFields.length - 1} stickyLeft={frozenLefts[index]} onClick={(event) => { if (!(event.target instanceof Element && event.target.closest(".resize-handle, .freeze-handle, .header-action"))) highlightColumn(field.id); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setHeaderMenu({ x: event.clientX, y: event.clientY, index, field }); }} onOpenMenu={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setHeaderMenu({ x: Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188)), y: rect.bottom + 4, index, field }); }} onPointerDown={(event) => startColumnDrag(event, field, index)} onResizeStart={() => setResizingFieldId(field.id)} onResize={(width) => previewResize(field.id, width)} onResizeEnd={(width) => commitResize(field.id, width)} onResizeCancel={() => { setLiveWidths(committedWidthsRef.current); setResizingFieldId(null); }} />)}</div>
      <div className="virtual-body" style={{ height: virtualizer.getTotalSize() }}>{virtualizer.getVirtualItems().map((virtualRow) => { const item = displayedRows[virtualRow.index]; const row = item.row; const checked = selected.has(row.id); const isExpanded = treeState.hasQuery || expanded.has(row.id); const nextDepth = displayedRows[virtualRow.index + 1]?.depth ?? 0; return <div key={row.id} className={`${checked ? "grid-row selected" : "grid-row"}${item.depth ? " child-row" : ""}${nextDepth > 0 ? " nested-divider" : ""}`} role="row" data-grid-row={virtualRow.index} aria-selected={checked} aria-rowindex={virtualRow.index + 2} aria-level={hasHierarchy ? item.depth + 1 : undefined} aria-expanded={item.hasChildren ? isExpanded : undefined} style={{ gridTemplateColumns: gridTemplate, height: virtualRow.size, transform: `translateY(${virtualRow.start}px)` }} onDoubleClick={() => onOpenRecord(row)}><div className={`row-check${frozenCount ? " frozen-row-check" : ""}`} role="gridcell" aria-colindex={1} data-grid-column={0} id={cellId(virtualRow.index, 0)} data-active={activeRow === virtualRow.index && column === 0 || undefined}><span className="row-number">{item.displayIndex}</span><input type="checkbox" tabIndex={-1} className="checkbox row-checkbox native-row-checkbox" aria-label={`选择记录 ${row.id}`} data-state={checked ? "checked" : "unchecked"} onDoubleClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} checked={checked} onChange={(event) => { const nextChecked = event.currentTarget.checked; setActiveCell({ rowId: row.id, fieldId: null }); selectionAnchor.current = null; setSelected((current) => { const next = new Set(current); if (nextChecked) next.add(row.id); else next.delete(row.id); return next; }); scrollRef.current?.focus({ preventScroll: true }); }} /></div>{renderedFields.map(({field, index:fieldIndex}) => <Cell key={field.id} cellId={cellId(virtualRow.index, fieldIndex + 1)} columnIndex={fieldIndex + 1} active={activeRow === virtualRow.index && column === fieldIndex + 1} field={field} value={row[field.id]} cellProps={getCellProps?.(row, field)} style={frozenCellStyles[fieldIndex]} columnState={`${resizingFieldId === field.id ? "resizing-column " : ""}${highlightedFieldId === field.id ? "highlighted-column " : ""}${fieldIndex < frozenCount ? "frozen-column " : ""}${fieldIndex === frozenCount - 1 ? "last-frozen" : ""}`} tree={fieldIndex === 0 ? item : null} dividerInset={fieldIndex === 0 && nextDepth > 0 ? 25 + (nextDepth - 1) * 22 : 0} expanded={fieldIndex === 0 && isExpanded} onToggle={toggleExpanded} />)}</div>; })}</div>

    </div>{isViewPending && !loading && <div className="view-loading" role="status" aria-live="polite"><span className="view-loading-spinner" />正在加载视图数据…</div>}</AutoHideScrollArea>
    {headerMenu && <div ref={menuRef} className="header-context-menu ntable-portal" role="menu" aria-label={`${headerMenu.field.title}列菜单`} onKeyDown={(event) => {
      if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); event.stopPropagation(); closeMenu(); return; }
      if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }} style={{ left: headerMenu.x, top: headerMenu.y }} onPointerDown={(event) => event.stopPropagation()}><button type="button" role="menuitem" disabled={headerMenu.index === orderedFields.length - 1 || requestedFrozenCount === headerMenu.index + 1} onClick={() => { setFrozenCount(headerMenu.index + 1); closeMenu(); }}>冻结至「{headerMenu.field.title}」</button><span className="menu-separator" />
      <button type="button" role="menuitem" disabled={headerMenu.index === 0} onClick={() => { reorderColumn(headerMenu.index, -1); closeMenu(); }}>向左移动列</button>
      <button type="button" role="menuitem" disabled={headerMenu.index === orderedFields.length - 1} onClick={() => { reorderColumn(headerMenu.index, 1); closeMenu(); }}>向右移动列</button>
      <button type="button" role="menuitem" onClick={() => { resizeColumn(headerMenu.index, -16); closeMenu(); }}>缩小列宽</button>
      <button type="button" role="menuitem" onClick={() => { resizeColumn(headerMenu.index, 16); closeMenu(); }}>增大列宽</button>
    </div>}
    <footer className="table-footer"><span>{treeState.matchedCount.toLocaleString()} 条记录</span>{selected.size > 0 && <span className="selection-count">已选择 {selected.size} 条</span>}</footer>
  </div>;
}

const AutoHideScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(function AutoHideScrollArea({ className, children, overlay, freezeBoundaryLeft, freezeHandleRef, onFreezeHandlePointerDown, onBoundaryPointerMove, onBoundaryPointerLeave, ...props }: ScrollAreaProps, forwardedRef) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | undefined>(undefined);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [scrollbarDragging, setScrollbarDragging] = useState(false);
  const [visible, setVisible] = useState(false);
  const [metrics, setMetrics] = useState<ScrollMetrics>({ vertical: null, horizontal: null, scrollTop: 0, scrollLeft: 0 });
  const [hovered, setHovered] = useState(false);
  const hoveredRef = useRef(false);

  useImperativeHandle(forwardedRef, () => viewportRef.current!, []);
  useEffect(() => () => dragCleanupRef.current?.(), []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const updateMetrics = () => {
      const { clientHeight, clientWidth, scrollHeight, scrollWidth, scrollTop, scrollLeft } = viewport;
      const verticalTrack = Math.max(0, clientHeight - (scrollWidth > clientWidth ? 11 : 4));
      const horizontalTrack = Math.max(0, clientWidth - (scrollHeight > clientHeight ? 11 : 4));
      setMetrics({
        scrollTop,
        scrollLeft,
        vertical: scrollbarMetrics(clientHeight, scrollHeight, verticalTrack, scrollTop),
        horizontal: scrollbarMetrics(clientWidth, scrollWidth, horizontalTrack, scrollLeft),
      });
    };
    const reveal = () => {
      setVisible(true);
      window.clearTimeout(hideTimerRef.current);
      if (!hoveredRef.current) hideTimerRef.current = window.setTimeout(() => setVisible(false), 900);
    };
    let previousSize = [viewport.clientWidth, viewport.clientHeight, viewport.scrollWidth, viewport.scrollHeight];
    let previousOffset = [viewport.scrollLeft, viewport.scrollTop];
    const onScroll = () => {
      if (viewport.clientWidth === previousSize[0] && viewport.clientHeight === previousSize[1]) previousOffset = [viewport.scrollLeft, viewport.scrollTop];
      updateMetrics(); reveal();
    };
    const onResize = () => {
      const nextSize = [viewport.clientWidth, viewport.clientHeight, viewport.scrollWidth, viewport.scrollHeight];
      if (nextSize.some((size, index) => size !== previousSize[index])) dragCleanupRef.current?.();
      if (nextSize[0] !== previousSize[0]) viewport.scrollLeft = resizedScrollOffset(previousOffset[0], previousSize[0], previousSize[2], nextSize[0], nextSize[2]);
      if (nextSize[1] !== previousSize[1]) viewport.scrollTop = resizedScrollOffset(previousOffset[1], previousSize[1], previousSize[3], nextSize[1], nextSize[3]);
      previousSize = nextSize;
      previousOffset = [viewport.scrollLeft, viewport.scrollTop];
      updateMetrics();
    };
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
  }, []);

  const reveal = () => {
    setVisible(true);
    window.clearTimeout(hideTimerRef.current);
    if (!hoveredRef.current) hideTimerRef.current = window.setTimeout(() => setVisible(false), 900);
  };
  const scrollByThumb = (axis: "vertical" | "horizontal", event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const start = axis === "vertical" ? event.clientY : event.clientX;
    const startScroll = axis === "vertical" ? viewport.scrollTop : viewport.scrollLeft;
    const viewportSize = axis === "vertical" ? viewport.clientHeight : viewport.clientWidth;
    const contentSize = axis === "vertical" ? viewport.scrollHeight : viewport.scrollWidth;
    const thumb = metrics[axis];
    if (!thumb) return;
    dragCleanupRef.current?.();
    event.preventDefault();
    event.stopPropagation();
    const pointerId = event.pointerId;
    const thumbElement = event.currentTarget;
    const trackElement = thumbElement.parentElement;
    if (!trackElement) return;
    const trackSize = axis === "vertical" ? trackElement.clientHeight : trackElement.clientWidth;
    thumbElement.setPointerCapture(pointerId);
    setScrollbarDragging(true);
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const delta = (axis === "vertical" ? moveEvent.clientY : moveEvent.clientX) - start;
      const maxScroll = contentSize - viewportSize;
      const track = trackSize - thumb.size;
      const next = scrollFromThumb(startScroll, delta, maxScroll, track);
      if (axis === "vertical") viewport.scrollTop = next;
      else viewport.scrollLeft = next;
    };
    const end = () => {
      dragCleanupRef.current = null;
      thumbElement.removeEventListener("pointermove", move);
      thumbElement.removeEventListener("pointerup", up);
      thumbElement.removeEventListener("pointercancel", cancel);
      thumbElement.removeEventListener("lostpointercapture", end);
      window.removeEventListener("blur", end);
      window.removeEventListener("keydown", keydown, true);
      if (thumbElement.hasPointerCapture(pointerId)) thumbElement.releasePointerCapture(pointerId);
      setScrollbarDragging(false);
      reveal();
    };
    const up = (upEvent: PointerEvent) => { if (upEvent.pointerId === pointerId) { move(upEvent); end(); } };
    const cancel = (cancelEvent: PointerEvent) => { if (cancelEvent.pointerId === pointerId) end(); };
    const keydown = (keyEvent: KeyboardEvent) => { if (keyEvent.key === "Escape") { keyEvent.preventDefault(); keyEvent.stopPropagation(); end(); } };
    dragCleanupRef.current = end;
    thumbElement.addEventListener("pointermove", move);
    thumbElement.addEventListener("pointerup", up);
    thumbElement.addEventListener("pointercancel", cancel);
    thumbElement.addEventListener("lostpointercapture", end);
    window.addEventListener("blur", end);
    window.addEventListener("keydown", keydown, true);
    reveal();
  };
  return <div className={`auto-scroll-shell${visible || hovered || scrollbarDragging ? " scrollbars-visible" : ""}`} onPointerMove={onBoundaryPointerMove} onPointerEnter={() => { hoveredRef.current = true; window.clearTimeout(hideTimerRef.current); setHovered(true); setVisible(true); }} onPointerLeave={() => { hoveredRef.current = false; onBoundaryPointerLeave?.(); setHovered(false); window.clearTimeout(hideTimerRef.current); setVisible(false); }}>
    <div {...props} ref={viewportRef} className={`${className} auto-scroll-area`}>{children}</div>
    {overlay}
    {freezeBoundaryLeft !== null && <><div className="freeze-boundary-line" aria-hidden="true" style={{ left: `var(--freeze-target-left, ${freezeBoundaryLeft}px)` }} /><span ref={freezeHandleRef} className="freeze-region-handle" style={{ "--freeze-handle-left": `${freezeBoundaryLeft}px` } as CSSProperties} role="separator" aria-label="可拖拽改变冻结区域" onPointerDown={onFreezeHandlePointerDown} /></>}
    {metrics.vertical && <div className="overlay-scrollbar overlay-scrollbar-vertical" aria-hidden="true"><span style={{ height: metrics.vertical.size, transform: `translateY(${metrics.vertical.offset}px)` }} onPointerDown={(event) => scrollByThumb("vertical", event)} /></div>}
    {metrics.horizontal && <div className="overlay-scrollbar overlay-scrollbar-horizontal" aria-hidden="true"><span style={{ width: metrics.horizontal.size, transform: `translateX(${metrics.horizontal.offset}px)` }} onPointerDown={(event) => scrollByThumb("horizontal", event)} /></div>}
  </div>;
});

function HeaderCell({ cellId, columnIndex, active, field, gestureScope, width, isDragging, isHighlighted, isResizing, frozen, lastFrozen, terminal, stickyLeft, onClick, onContextMenu, onOpenMenu, onPointerDown, onResizeStart, onResize, onResizeEnd, onResizeCancel }: HeaderCellProps) {
  const resizeCancelRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => () => resizeCancelRef.current?.(), [field.id, gestureScope]);
  const Icon = iconForType[field.type] ?? TextCursorInput;
  const hoverResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const viewport = event.currentTarget.closest<HTMLDivElement>(".grid-scroll");
    if (!viewport || !event.currentTarget.parentElement || viewport.classList.contains("is-column-resizing")) return;
    const rect = viewport.getBoundingClientRect();
    viewport.style.setProperty("--resize-line-left", `${event.currentTarget.parentElement.getBoundingClientRect().right - rect.left + viewport.scrollLeft}px`);
    viewport.style.setProperty("--resize-line-top", `${viewport.scrollTop}px`);
    viewport.style.setProperty("--resize-line-height", `${viewport.clientHeight}px`);
    viewport.classList.add("is-column-resize-hovered");
  };
  const leaveResize = (event: ReactPointerEvent<HTMLButtonElement>) => event.currentTarget.closest<HTMLDivElement>(".grid-scroll")?.classList.remove("is-column-resize-hovered");
  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); event.stopPropagation(); const startX = event.clientX; const startWidth = width;
    const handle = event.currentTarget;
    const viewport = handle.closest<HTMLDivElement>(".grid-scroll");
    if (!viewport || !handle.parentElement) return;
    const headerRight = handle.parentElement.getBoundingClientRect().right;
    const pointerId = event.pointerId;
    resizeCancelRef.current?.();
    let finished = false;
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
    const move = (moveEvent: PointerEvent) => { if (moveEvent.pointerId !== pointerId) return; latestWidth = Math.max(88, Math.min(1200, startWidth + moveEvent.clientX - startX)); showLine(); onResize(latestWidth); };
    const finish = (cancelled = false) => {
      if (finished) return;
      finished = true;
      resizeCancelRef.current = null;
      window.removeEventListener("blur", cancel);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cancel); window.removeEventListener("keydown", keydown, true);
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
      ["--resize-line-left", "--resize-line-top", "--resize-line-height"].forEach((name) => viewport.style.removeProperty(name));
      if (cancelled) onResizeCancel(); else onResizeEnd(latestWidth);
    };
    const up = (upEvent: PointerEvent) => { if (upEvent.pointerId === pointerId) { latestWidth = Math.max(88, Math.min(1200, startWidth + upEvent.clientX - startX)); finish(); } };
    const cancel = (cancelEvent?: Event) => {
      if (cancelEvent instanceof PointerEvent && cancelEvent.pointerId !== pointerId) return;
      finish(true);
    };
    const keydown = (keyEvent: KeyboardEvent) => { if (keyEvent.key === "Escape") { keyEvent.preventDefault(); keyEvent.stopPropagation(); cancel(); } };
    resizeCancelRef.current = cancel;
    window.addEventListener("blur", cancel);
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cancel); window.addEventListener("keydown", keydown, true);
  };
  return <div draggable={false} data-field-id={field.id} style={{gridColumn:columnIndex+1, ...(frozen ? {left:stickyLeft} : {})}} className={`grid-head-cell${isDragging ? " dragging" : ""}${isHighlighted ? " highlighted" : ""}${isResizing ? " resizing" : ""}${frozen ? " frozen-column" : ""}${lastFrozen ? " last-frozen" : ""}${terminal ? " last-column" : ""}`} role="columnheader" id={cellId} data-grid-column={columnIndex} data-active={active || undefined} aria-colindex={columnIndex + 1} onClick={onClick} onContextMenu={onContextMenu} onPointerDown={onPointerDown}><Icon size={15} /><span>{field.title}</span><button type="button" tabIndex={-1} className="header-action" aria-label={`${field.title}列菜单`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onOpenMenu(event); }}><ChevronDown size={13} /></button><button type="button" tabIndex={-1} className="resize-handle" draggable="false" aria-label={`调整${field.title}列宽`} onPointerEnter={hoverResize} onPointerLeave={leaveResize} onPointerDown={startResize} /></div>;
}

const Cell = memo(function Cell({ cellId, columnIndex, active, field, value, columnState, tree, dividerInset, expanded, onToggle, style, cellProps }: CellProps) {
  const className = `grid-cell${columnState ? ` ${columnState}` : ""}${tree ? " tree-cell" : ""}`;
  const treePrefix = tree ? <span className="tree-prefix" style={{ width: tree.depth * 22 + 18 }}>
    {tree.ancestorContinuationLevels.map((level) => <span key={level} className="tree-connector" style={{ left: level * 22 + 8 }} />)}
    {tree.depth > 0 && <span className={`tree-connector${tree.isLastChild ? " last-child" : ""}`} style={{ left: (tree.depth - 1) * 22 + 8 }} />}
    {tree.hasChildren && expanded && <span className="tree-connector tree-connector-start" style={{ left: tree.depth * 22 + 8 }} />}
    {tree.hasChildren && <button type="button" tabIndex={-1} className="tree-toggle" aria-label={expanded ? "收起子规格" : "展开子规格"} onClick={(event) => { event.stopPropagation(); onToggle(tree.row.id); }} onDoubleClick={(event) => event.stopPropagation()}>{expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>}
  </span> : null;
  let tooltipText = value == null ? "" : String(value);
  let content: import("react").ReactNode = tooltipText;
  if (field.type === "singleSelect") { const item = field.options?.find((option) => option.value === value); tooltipText = item?.label ?? ""; content = item ? <span className="tag" style={{ background: item.color }}>{item.label}</span> : null; }
  if (field.type === "multiSelect") {
    const labels = Array.isArray(value) ? value.map((item) => field.options?.find((option) => option.value === item)?.label ?? String(item)) : [];
    tooltipText = labels.join("、");
    content = Array.isArray(value) ? value.map((item, index) => <span className="tag" key={item}>{labels[index]}</span>) : null;
  }
  return <div className={`${className}${cellProps?.className ? ` ${cellProps.className}` : ""}`} style={{ ...cellProps?.style, ...style, gridColumn:columnIndex+1 }} role="gridcell" id={cellId} data-grid-column={columnIndex} data-active={active || undefined} aria-colindex={columnIndex + 1}>{tree && dividerInset > 0 && <span className="tree-row-divider" style={{ left: dividerInset }} />}{treePrefix}<Tooltip content={tooltipText}><span className={tree ? "tree-value" : undefined}>{content}</span></Tooltip>{tree?.hasChildren && <span className="tree-row-actions">{tree.hasChildren && <span className="tree-child-count" aria-label={`${tree.childCount} 个子规格`}><ListTree size={14} />{tree.childCount}</span>}</span>}</div>;
});
