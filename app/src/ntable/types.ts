import type { CSSProperties } from "react";

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

export type RecordMenuContext = {
  row: TableRecord;
  /** Null when the checkbox/gutter cell was the target. */
  field: Field | null;
};

export type RecordMenuItem =
  | { type: "separator" }
  | { key: string; label: string; danger?: boolean; disabled?: boolean };

export interface NTableProps {
  /** Search commits after this idle period; IME composition never commits. Default 300ms. */
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
  /** Adds "视图管理" (rename, plus visibility when enabled) above deletion in the active view's menu; saves through onUpdateView. Defaults to false. */
  viewManagement?: boolean;
  /** Shows "可视范围"（仅自己 / 所有人）in the new-view panel and the view manage panel. Defaults to false. */
  viewVisibilityEditable?: boolean;
  /** Enables dragging view tabs to reorder them; receives every view id in the new order. Hosts decide where the order is kept. Omit to keep tabs fixed. */
  onReorderViews?: (ids: string[]) => void;
  onAddRecord?: () => void;
  onOpenRecord: (row: TableRecord) => void;
  getSubRows?: (row: TableRecord) => TableRecord[];
  getCellProps?: (row: TableRecord, field: Field) => {
    className?: string;
    style?: CSSProperties;
  } | undefined;
  /** Host-owned record actions. Empty/omitted hides the body context menu. */
  getRecordMenuItems?: (context: RecordMenuContext) => RecordMenuItem[];
  onRecordMenuAction?: (key: string, context: RecordMenuContext) => void;
}

export type ViewBarProps = Pick<NTableProps,
  "views" | "activeView" | "onActiveViewChange" | "onCreateView" | "onDeleteView" | "viewManagement" | "viewVisibilityEditable" | "onReorderViews"> & Partial<Pick<NTableProps, "onUpdateView">>;

export type TableToolbarProps = Pick<NTableProps,
  "fields" | "activeView" | "onUpdateView" | "onAddRecord" | "searchDebounceMs"> & {
  search?: string;
  /** Change this key to discard a pending draft even when search is already empty. */
  searchResetKey?: number;
  onSearchChange?: (value: string) => void;
};

export type TableProps = Pick<NTableProps,
  "fields" | "rows" | "activeView" | "onUpdateView" | "onOpenRecord" | "getSubRows" | "getCellProps" | "getRecordMenuItems" | "onRecordMenuAction" | "loading" | "error" | "onRetry"> & {
  search?: string;
  /** Clears search and filters together. Omit to leave reset UI to the host. */
  onClearQuery?: () => void;
};
