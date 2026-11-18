import type { CSSProperties, ReactNode } from "react";

export interface Field {
  id: string;
  title: string;
  /** boolean: cell values are true / false / null, shown as fixed 是 / 否 tags (see BOOLEAN_OPTIONS). */
  type: "text" | "number" | "singleSelect" | "multiSelect" | "boolean" | "date";
  width?: number;
  searchable?: boolean;
  /** color omitted: NTable assigns one by option order from the Feishu tag palette (see tagColor). */
  options?: { value: string; label: string; color?: string }[];
}
export interface TableRecord {
  id: string;
  children?: TableRecord[];
  defaultExpanded?: boolean;
  [field: string]: unknown;
}
export type FilterOperator = "contains" | "notContains" | "equals" | "notEquals" | "greaterThan" | "lessThan" | "isEmpty" | "isNotEmpty";
export type SortDirection = "asc" | "desc";
export interface FilterRule {
  id?: string;
  fieldId: string;
  operator: FilterOperator;
  /** Select and boolean filters accept option value arrays ("true" / "false" for boolean); legacy strings represent one option. Other fields use strings. */
  value: string | string[];
}
export type OpenRecordContext = { fieldId: string | null };
export type ViewVisibility = "private" | "public";
export type CreateViewOptions = { visibility?: ViewVisibility };
export interface SortRule { id?: string; fieldId: string; direction: SortDirection; }

export interface TableView {
  id: string;
  name: string;
  /** False hides deletion actions for this view. Defaults to true; hosts enforce authorization. */
  deletable?: boolean;
  /** False hides the "视图管理" action (rename / visibility) for this view. Defaults to true; hosts enforce authorization. */
  manageable?: boolean;
  /** Who can see the view. Shown and editable only when NTable's viewVisibilityEditable is true; hosts persist and enforce it. */
  visibility?: ViewVisibility;
  visibleFieldIds: string[];
  columnOrder: string[];
  columnWidths?: Record<string, number>;
  /** Requested frozen prefix; narrow hosts temporarily render fewer frozen fields without changing this value. */
  frozenFieldCount?: number;
  filterMode?: "all" | "any";
  filters: FilterRule[];
  sorts: SortRule[];
}

export type FooterSummary = {
    matchedRows: TableRecord[];
    matchedCount: number;
};
export type RecordMenuContext = {
  row: TableRecord;
  /** All existing selected records; without a selection, only row. Same snapshot for menu and action. */
  rows: TableRecord[];
  /** Null when the checkbox/gutter cell was the target. */
  field: Field | null;
};

export type RecordMenuItem =
  | { type: "separator" }
  | { key: string; label: string; danger?: boolean; disabled?: boolean };

/** 工具栏筛选方式：simple 把宿主选定的几个字段平铺成常驻控件，值是临时的、不进视图；advanced 是完整的筛选面板，编辑 activeView.filters。 */
export type FilterUi = "simple" | "advanced";
/** 简单筛选的值：字段 id → 选中的选项值（布尔为 "true" / "false"，文本为单元素数组）。不属于视图，不随视图保存。 */
export type SimpleFilterValues = Record<string, string[]>;
export interface SimpleFilterField {
  fieldId: string;
  /** 控件标签，默认取字段标题 */
  label?: string;
  /** 仅布尔字段：分段控件的两个选项文案，默认 是 / 否 */
  trueLabel?: string;
  falseLabel?: string;
}

export interface NTableProps {
  /** Search commits after this idle period; IME composition never commits. Default 300ms. */
  /** Cmd/Ctrl+F opens and focuses the toolbar search instead of the browser's find bar; ignored while a modal dialog is open. Page-wide, so enable it on one table per page. Defaults to false. */
  captureFindShortcut?: boolean;
  searchDebounceMs?: number;
  /** External request state. Keep previous rows during a refresh. */
  loading?: boolean;
  /** Safe, user-facing request error. Loading takes precedence. */
  error?: string | null;
  /** Host starts/retries its request and controls loading/error. */
  onRetry?: () => void;
  fields: Field[];
  rows: TableRecord[];
  views: TableView[];
  activeView: TableView;
  onActiveViewChange: (id: string) => void;
  onUpdateView: (id: string, patch: Partial<TableView>) => void;
  /** options.visibility is passed only when viewVisibilityEditable is true. */
  onCreateView: (name: string, options?: CreateViewOptions) => void;
  onDeleteView?: (id: string) => void;
  /** Adds "复制视图" to the active view's menu; the host creates the copy (name, visibility, config) and usually activates it. Omit to hide. */
  onDuplicateView?: (id: string) => void;
  /** Adds "重命名" (inline on the tab: Enter or blur saves, Esc cancels) and, with viewVisibilityEditable, the "可见范围" submenu to the active view's menu; both save through onUpdateView. Defaults to false. */
  viewManagement?: boolean;
  /** Shows "可视范围"（仅自己 / 所有人）in the new-view panel and the "可见范围" submenu（公共视图 / 个人视图）in the view menu. Defaults to false. */
  viewVisibilityEditable?: boolean;
  /** Enables dragging view tabs to reorder them; receives every view id in the new order. Hosts decide where the order is kept. Omit to keep tabs fixed. */
  onReorderViews?: (ids: string[]) => void;
  onAddRecord?: () => void;
  /** fieldId: the column the record was opened from (double-clicked cell or active cell on Enter); null from the row-number column. */
  onOpenRecord: (row: TableRecord, context: OpenRecordContext) => void;
  getSubRows?: (row: TableRecord) => TableRecord[];
  /** 简单筛选字段（支持文本、单选、多选、布尔字段，其余及未知字段静默忽略；文本字段是「包含」输入框）。不传或为空时工具栏与原来完全一致；传入后工具栏出现「简单 | 高级」切换，简单模式下这些字段以常驻控件出现，选的值是临时条件：不写进 activeView.filters，只在简单模式下与视图条件同时生效。 */
  simpleFilterFields?: SimpleFilterField[];
  /** 当前筛选方式，传入即受控；不传时组件内部维护，默认 simple。 */
  filterUi?: FilterUi;
  onFilterUiChange?: (ui: FilterUi) => void;
  /** 简单筛选的值，传入即受控；不传时组件内部维护（刷新即丢）。切换视图不清空。 */
  simpleFilterValues?: SimpleFilterValues;
  onSimpleFilterValuesChange?: (values: SimpleFilterValues) => void;
  getCellProps?: (row: TableRecord, field: Field) => {
    className?: string;
    style?: CSSProperties;
  } | undefined;
  /** Host-owned record actions. Empty/omitted hides the body context menu. */
  /** Replaces the footer's "N 条记录" text. matchedRows are the top-level records kept by the current filters and search; matchedCount counts every kept record, children included. */
  renderFooterSummary?: (summary: FooterSummary) => ReactNode;
  getRecordMenuItems?: (context: RecordMenuContext) => RecordMenuItem[];
  onRecordMenuAction?: (key: string, context: RecordMenuContext) => void;
}

export type ViewBarProps = Pick<NTableProps,
  "views" | "activeView" | "onActiveViewChange" | "onCreateView" | "onDeleteView" | "onDuplicateView" | "viewManagement" | "viewVisibilityEditable" | "onReorderViews"> & Partial<Pick<NTableProps, "onUpdateView">>;

export type TableToolbarProps = Pick<NTableProps,
  "fields" | "activeView" | "onUpdateView" | "onAddRecord" | "searchDebounceMs" | "captureFindShortcut" | "simpleFilterFields" | "filterUi" | "onFilterUiChange" | "simpleFilterValues" | "onSimpleFilterValuesChange"> & {
  /** 仅用于简单筛选选项后的记录数统计 */
  rows?: TableRecord[];
  getSubRows?: NTableProps["getSubRows"];
  search?: string;
  /** Change this key to discard a pending draft even when search is already empty. */
  searchResetKey?: number;
  onSearchChange?: (value: string) => void;
};

export type TableProps = Pick<NTableProps,
  "fields" | "rows" | "activeView" | "onUpdateView" | "onOpenRecord" | "getSubRows" | "getCellProps" | "getRecordMenuItems" | "onRecordMenuAction" | "renderFooterSummary" | "loading" | "error" | "onRetry"> & {
  search?: string;
  /** 视图之外临时叠加的条件（如简单筛选，可用 simpleFilterRules 生成），与视图条件同时满足，不写进视图 */
  extraFilters?: FilterRule[];
  /** Clears search and filters together. Omit to leave reset UI to the host. */
  onClearQuery?: () => void;
};
