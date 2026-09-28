import type { CSSProperties } from "react";

export interface Field {
  id: string;
  title: string;
  type: "text" | "singleSelect" | "multiSelect" | "date";
  width?: number;
  searchable?: boolean;
  options?: { value: string; label: string; color?: string }[];
}
export interface TableRecord {
  id: string;
  children?: TableRecord[];
  defaultExpanded?: boolean;
  [field: string]: any;
}
export interface TableView {
  id: string;
  name: string;
  visibleFieldIds: string[];
  columnOrder: string[];
  columnWidths?: Record<string, number>;
  frozenFieldCount?: number;
  filters: { id?: string; fieldId: string; operator: string; value: string }[];
  sorts: { id?: string; fieldId: string; direction: string }[];
}
export interface NTableProps {
  fields: Field[];
  rows: TableRecord[];
  views: TableView[];
  activeView: TableView;
  onActiveViewChange: (id: string) => void;
  onUpdateView: (id: string, patch: Partial<TableView>) => void;
  onCreateView: (name: string) => void;
  onDeleteView?: (id: string) => void;
  onAddRecord?: () => void;
  onAddSubRecord?: (row: TableRecord) => void;
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
  "fields" | "activeView" | "onUpdateView" | "onAddRecord"> & {
  search?: string;
  onSearchChange?: (value: string) => void;
};

export type TableProps = Pick<NTableProps,
  "fields" | "rows" | "activeView" | "onUpdateView" | "onAddSubRecord" | "onOpenRecord" | "getSubRows" | "getCellProps"> & {
  search?: string;
};
