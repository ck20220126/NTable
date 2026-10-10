import type { Field, FilterOperator, TableRecord, TableView } from "./ntable/types";
import { filterOperators } from "./ntable/filtering.ts";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function readDemoStorage(key: string, storage?: StorageReader): string | null {
  try { return (storage ?? window.localStorage).getItem(key); }
  catch { return null; }
}

export function writeDemoStorage(key: string, value: string, storage?: StorageWriter): boolean {
  try { (storage ?? window.localStorage).setItem(key, value); return true; }
  catch { return false; }
}

export function normalizeDemoViews(raw: string | null, fields: Field[], fallback: TableView[]): TableView[] {
  let source: unknown;
  try { source = raw ? JSON.parse(raw) : fallback; } catch { source = fallback; }
  const fieldIds = fields.map(field => field.id);
  const fieldSet = new Set(fieldIds);
  const ids = (value: unknown) => Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && fieldSet.has(id)))] : [];
  const seenViews = new Set<string>();
  const result: TableView[] = [];
  if (Array.isArray(source)) for (const item of source) {
    if (!isObject(item) || typeof item.id !== "string" || !item.id || seenViews.has(item.id) || typeof item.name !== "string" || !item.name.trim()) continue;
    seenViews.add(item.id);
    const savedOrder = ids(item.columnOrder);
    const visible = ids(item.visibleFieldIds);
    // Existing demos gain quantity exactly once; preserve an explicitly hidden quantity.
    if (fieldSet.has("quantity") && !savedOrder.includes("quantity")) {
      const insert = (list: string[]) => list.splice(list.includes("department") ? list.indexOf("department") + 1 : list.length, 0, "quantity");
      insert(savedOrder); if (!visible.includes("quantity")) insert(visible);
    }
    const columnOrder = [...savedOrder, ...fieldIds.filter(id => !savedOrder.includes(id))];
    const visibleFieldIds = visible.length ? visible : fieldIds.slice(0, 1);
    const columnWidths: Record<string, number> = {};
    if (isObject(item.columnWidths)) for (const [id, width] of Object.entries(item.columnWidths)) {
      if (fieldSet.has(id) && typeof width === "number" && Number.isFinite(width)) columnWidths[id] = Math.max(88, Math.min(1200, width));
    }
    const filters: TableView["filters"] = [];
    const ruleIds = new Set<string>();
    const uniqueRuleId = (value: unknown) => {
      const id = typeof value === "string" && value && !ruleIds.has(value) ? value : crypto.randomUUID();
      ruleIds.add(id); return id;
    };
    if (Array.isArray(item.filters)) for (const rule of item.filters) {
      if (!isObject(rule) || typeof rule.fieldId !== "string" || !fieldSet.has(rule.fieldId) || typeof rule.operator !== "string" || typeof rule.value !== "string") continue;
      const empty = rule.operator === "isEmpty" || rule.operator === "isNotEmpty";
      const operators = filterOperators(fields.find(field => field.id === rule.fieldId)?.type);
      const operator = operators.find(operator => operator.value === rule.operator);
      if (!operator) continue;
      filters.push({ id: uniqueRuleId(rule.id), fieldId: rule.fieldId, operator: operator.value as FilterOperator, value: empty ? "" : rule.value });
    }
    const sorts: TableView["sorts"] = [];
    const sortedFields = new Set<string>();
    if (Array.isArray(item.sorts)) for (const rule of item.sorts) {
      if (!isObject(rule) || typeof rule.fieldId !== "string" || !fieldSet.has(rule.fieldId) || sortedFields.has(rule.fieldId) || (rule.direction !== "asc" && rule.direction !== "desc")) continue;
      sortedFields.add(rule.fieldId);
      sorts.push({ id: uniqueRuleId(rule.id), fieldId: rule.fieldId, direction: rule.direction });
    }
    result.push({ id: item.id, name: item.name, visibleFieldIds, columnOrder, columnWidths,
      frozenFieldCount: typeof item.frozenFieldCount === "number" && Number.isFinite(item.frozenFieldCount) ? Math.max(0, Math.min(Math.floor(item.frozenFieldCount), visibleFieldIds.length - 1)) : 0,
      filterMode: item.filterMode === "any" ? "any" : "all", filters, sorts });
  }
  return result.length ? result : fallback;
}

export function createRecordDraft(record: Partial<TableRecord>) {
  const existing = Boolean(record.id);
  return { ...record, code: String(record.code ?? ""), name: String(record.name ?? ""),
    category: String(record.category ?? (existing ? "" : "visual")), status: String(record.status ?? (existing ? "" : "draft")),
    owner: String(record.owner ?? ""), department: String(record.department ?? (existing ? "" : "活动运营")),
    quantity: record.quantity == null ? "" : String(record.quantity),
    startDate: String(record.startDate ?? (existing ? "" : "2026-10-01")), endDate: String(record.endDate ?? (existing ? "" : "2026-11-01")),
    spec: String(record.spec ?? ""), attachment: String(record.attachment ?? "—") };
}

export function saveRecordDraft(draft: ReturnType<typeof createRecordDraft>): Partial<TableRecord> {
  const quantity = draft.quantity.trim() === "" ? null : Number(draft.quantity);
  if (quantity !== null && !Number.isFinite(quantity)) throw new Error("数量必须是有限数字");
  return { ...draft, quantity };
}
