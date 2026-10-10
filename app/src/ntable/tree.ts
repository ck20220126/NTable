import { isActiveFilter, matchesFilters } from "./filtering.ts";
import { recordComparator } from "./sorting.ts";
import type { Field, TableRecord, TableView } from "./types";

export interface DisplayRow {
  row: TableRecord;
  depth: number;
  hasChildren: boolean;
  isLastChild: boolean;
  ancestorContinuationLevels: number[];
  childCount: number;
  displayIndex: number | null;
}
interface TreeNode { row: TableRecord; children: TreeNode[] }
export interface TreeProjection { rows: DisplayRow[]; matchedCount: number; hasQuery: boolean }

export function projectTree(rows: TableRecord[], tableView: TableView, orderedFields: Field[], fieldById: Map<string, Field>, search: string, expanded: Set<string>, getSubRows: (row: TableRecord) => TableRecord[]): TreeProjection {
    const term = search.trim().toLocaleLowerCase();
    const activeFilters = tableView.filters.filter(isActiveFilter);
    const hasQuery = Boolean(term || activeFilters.length);
    const searchableFields = term ? orderedFields.filter(field => field.searchable !== false).map(field => ({
      field,
      labels: new Map((field.type === "singleSelect" || field.type === "multiSelect" ? field.options ?? [] : []).map(option => [option.value, option.label.toLocaleLowerCase()])),
    })) : [];
    const matches = (row: TableRecord) => matchesFilters(row, activeFilters, fieldById, tableView.filterMode) && (!term || searchableFields.some(({ field, labels }) => {
      const value = row[field.id];
      if (String(value ?? "").toLocaleLowerCase().includes(term)) return true;
      if (field.type === "singleSelect") return typeof value === "string" && Boolean(labels.get(value)?.includes(term));
      return field.type === "multiSelect" && Array.isArray(value) && value.some(item => typeof item === "string" && labels.get(item)?.includes(term));
    }));
    const compare = recordComparator(tableView.sorts, fieldById);
    const sortSiblings = (items: TableRecord[]) => tableView.sorts.length ? [...items].sort(compare) : items;
    let matchedCount = 0;
    const roots: TreeNode[] = [];
    type BuildFrame = { row: TableRecord; target: TreeNode[]; ancestorMatches: boolean; node?: TreeNode; selfMatches?: boolean };
    const pending: BuildFrame[] = [];
    const enqueue = (items: TableRecord[], target: TreeNode[], ancestorMatches: boolean) => {
      const sorted = sortSiblings(items);
      for (let index = sorted.length - 1; index >= 0; index--) pending.push({ row: sorted[index], target, ancestorMatches });
    };
    enqueue(rows, roots, false);
    while (pending.length) {
      const frame = pending.pop()!;
      if (frame.node) {
        if (frame.selfMatches || frame.node.children.length) { frame.target.push(frame.node); matchedCount++; }
        continue;
      }
      const selfMatches = !hasQuery || frame.ancestorMatches || matches(frame.row);
      const node: TreeNode = { row: frame.row, children: [] };
      pending.push({ ...frame, node, selfMatches });
      enqueue(getSubRows(frame.row), node.children, selfMatches);
    }
    const flattened: DisplayRow[] = [];
    let rootIndex = 0;
    type FlattenFrame = { nodes: TreeNode[]; index: number; depth: number; ancestorContinuationLevels: number[] };
    const levels: FlattenFrame[] = [{ nodes: roots, index: 0, depth: 0, ancestorContinuationLevels: [] }];
    while (levels.length) {
      const frame = levels[levels.length - 1];
      if (frame.index >= frame.nodes.length) { levels.pop(); continue; }
      const { nodes, depth, ancestorContinuationLevels } = frame;
      const siblingIndex = frame.index++;
      const node = nodes[siblingIndex];
      const hasChildren = node.children.length > 0;
      const isLastChild = siblingIndex === nodes.length - 1;
      flattened.push({ row: node.row, depth, hasChildren, isLastChild, ancestorContinuationLevels, childCount: node.children.length, displayIndex: depth === 0 ? ++rootIndex : null });
      if (hasChildren && (hasQuery || expanded.has(node.row.id))) {
        levels.push({ nodes: node.children, index: 0, depth: depth + 1, ancestorContinuationLevels: depth > 0 && !isLastChild ? [...ancestorContinuationLevels, depth - 1] : ancestorContinuationLevels });
      }
    }
    return { rows: flattened, matchedCount, hasQuery };
}

// Only retain projections for the current data and getter, with bounded view reuse.
export class TreeProjectionCache {
  private entries = new Map<string, TreeProjection>();
  private rows: TableRecord[] | undefined;
  private fields: Field[] | undefined;
  private getter: ((row: TableRecord) => TableRecord[]) | undefined;

  get(key: string, rows: TableRecord[], fields: Field[], getter: (row: TableRecord) => TableRecord[]) {
    if (this.rows !== rows || this.fields !== fields || this.getter !== getter) {
      this.entries.clear();
      this.rows = rows; this.fields = fields; this.getter = getter;
    }
    const value = this.entries.get(key);
    if (value) { this.entries.delete(key); this.entries.set(key, value); }
    return value;
  }
  set(key: string, value: TreeProjection) {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > 8) this.entries.delete(this.entries.keys().next().value!);
  }
  get size() { return this.entries.size; }
}

export function selectionState(ids: string[], selected: Set<string>): boolean | "indeterminate" {
  const count = ids.reduce((total, id) => total + Number(selected.has(id)), 0);
  return count === 0 ? false : count === ids.length ? true : "indeterminate";
}
export function toggleVisibleSelection(ids: string[], selected: Set<string>) {
  const next = new Set(selected);
  const remove = selectionState(ids, selected) === true;
  ids.forEach(id => remove ? next.delete(id) : next.add(id));
  return next;
}
export function collectRecordIds(rows: TableRecord[], getSubRows: (row: TableRecord) => TableRecord[], ids = new Set<string>()) {
  const pending = [...rows].reverse();
  while (pending.length) {
    const row = pending.pop()!;
    ids.add(row.id);
    const children = getSubRows(row);
    for (let index = children.length - 1; index >= 0; index--) pending.push(children[index]);
  }
  return ids;
}

export function collectDefaultExpanded(rows: TableRecord[], getSubRows: (row: TableRecord) => TableRecord[]) {
  const result = new Set<string>();
  const pending = [...rows].reverse();
  while (pending.length) {
    const row = pending.pop()!;
    const children = getSubRows(row);
    if (row.defaultExpanded && children.length) result.add(row.id);
    for (let index = children.length - 1; index >= 0; index--) pending.push(children[index]);
  }
  return result;
}
