import type { CSSProperties } from "react";

export interface Field {
  id: string;
  title: string;
  type: "text" | "number" | "singleSelect" | "multiSelect" | "date";
  width?: number;
  searchable?: boolean;
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
export interface FilterRule { id?: string; fieldId: string; operator: FilterOperator; value: string; }
export interface SortRule { id?: string; fieldId: string; direction: SortDirection; }

export interface TableView {
  id: string;
  name: string;
  /** False hides deletion actions for this view. Defaults to true; hosts enforce authorization. */
  deletable?: boolean;
  visibleFieldIds: string[];
  columnOrder: string[];
  columnWidths?: Record<string, number>;
  /** Requested frozen prefix; narrow hosts temporarily render fewer frozen fields without changing this value. */
  frozenFieldCount?: number;
  filterMode?: "all" | "any";
  filters: FilterRule[];
  sorts: SortRule[];
}
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
  onCreateView: (name: string) => void;
  onDeleteView?: (id: string) => void;
  onAddRecord?: () => void;
  onOpenRecord: (row: TableRecord) => void;
  getSubRows?: (row: TableRecord) => TableRecord[];
  getCellProps?: (row: TableRecord, field: Field) => {
    className?: string;
    style?: CSSProperties;
  } | undefined;
}

export type ViewBarProps = Pick<NTableProps,
  "views" | "activeView" | "onActiveViewChange" | "onCreateView" | "onDeleteView">;

export type TableToolbarProps = Pick<NTableProps,
  "fields" | "activeView" | "onUpdateView" | "onAddRecord" | "searchDebounceMs"> & {
  search?: string;
  /** Change this key to discard a pending draft even when search is already empty. */
  searchResetKey?: number;
  onSearchChange?: (value: string) => void;
};

export type TableProps = Pick<NTableProps,
  "fields" | "rows" | "activeView" | "onUpdateView" | "onOpenRecord" | "getSubRows" | "getCellProps" | "loading" | "error" | "onRetry"> & {
  search?: string;
  /** Clears search and filters together. Omit to leave reset UI to the host. */
  onClearQuery?: () => void;
};
