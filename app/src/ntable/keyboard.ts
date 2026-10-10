import type { DisplayRow } from "./tree";

export interface GridPosition { row: number; column: number }

export function moveGridPosition(position: GridPosition, key: string, rowCount: number, columnCount: number, pageSize: number, edge: boolean): GridPosition | null {
  let { row, column } = position;
  switch (key) {
    case "ArrowUp": row--; break;
    case "ArrowDown": row++; break;
    case "ArrowLeft": column--; break;
    case "ArrowRight": column++; break;
    case "PageUp": row -= pageSize; break;
    case "PageDown": row += pageSize; break;
    case "Home": column = 0; if (edge) row = -1; break;
    case "End": column = columnCount - 1; if (edge) row = rowCount - 1; break;
    default: return null;
  }
  return { row: Math.max(-1, Math.min(rowCount - 1, row)), column: Math.max(0, Math.min(columnCount - 1, column)) };
}

/** Preserve the record, then its nearest visible ancestor, then its old row slot. */
export function resolveActiveRow(id: string | null, rows: DisplayRow[], previous: DisplayRow[]) {
  if (id === null) return -1;
  const index = rows.findIndex(item => item.row.id === id);
  if (index >= 0) return index;
  const oldIndex = previous.findIndex(item => item.row.id === id);
  let depth = previous[oldIndex]?.depth ?? 0;
  for (let i = oldIndex - 1; i >= 0 && depth > 0; i--) {
    if (previous[i].depth >= depth) continue;
    depth = previous[i].depth;
    const parent = rows.findIndex(item => item.row.id === previous[i].row.id);
    if (parent >= 0) return parent;
  }
  return rows.length ? Math.max(0, Math.min(oldIndex, rows.length - 1)) : -1;
}

export function selectRowRange(ids: string[], anchor: number, end: number, base: Set<string>) {
  const next = new Set(base);
  for (let i = Math.max(0, Math.min(anchor, end)); i <= Math.min(ids.length - 1, Math.max(anchor, end)); i++) next.add(ids[i]);
  return next;
}
