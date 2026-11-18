import { filterOperators, isActiveFilter } from "./filtering.ts";
import { fieldOptions } from "./booleanOptions.ts";
import { projectTree } from "./tree.ts";
import type { Field, FilterOperator, FilterRule, SimpleFilterField, TableRecord, TableView } from "./types";

/**
 * 简单筛选与 activeView.filters 一一对应：每个简单字段最多一条「规范规则」。
 * 单选 equals、多选 contains、布尔 equals（值为 ["true"] 或 ["false"]），值都是字符串数组；
 * 文本 contains，值是输入的字符串（投影里按单元素数组表示）。
 * 视图里有超出这个形状的条件时，投影失败，由工具栏提示去高级里处理，不做有损转换。
 */
export type SimpleFilterType = "text" | "singleSelect" | "multiSelect" | "boolean";
export type FilterValues = Record<string, string[]>;
export type SimpleProjection = { ok: true; values: FilterValues } | { ok: false; reasons: string[] };
export interface ResolvedSimpleField extends SimpleFilterField {
  field: Field & { type: SimpleFilterType };
}

export function isSimpleFilterType(type?: Field["type"]): type is SimpleFilterType {
  return type === "text" || type === "singleSelect" || type === "multiSelect" || type === "boolean";
}

/** 丢弃未知字段、不支持的字段类型和重复 id（保留首个），其余保持宿主给的顺序 */
export function resolveSimpleFields(simpleFields: SimpleFilterField[] | undefined, fieldById: Map<string, Field>): ResolvedSimpleField[] {
  const seen = new Set<string>();
  const result: ResolvedSimpleField[] = [];
  for (const item of simpleFields ?? []) {
    const field = fieldById.get(item.fieldId);
    if (!field || !isSimpleFilterType(field.type) || seen.has(field.id)) continue;
    seen.add(field.id);
    result.push({ ...item, field: field as ResolvedSimpleField["field"] });
  }
  return result;
}

export function canonicalOperator(type?: Field["type"]): FilterOperator {
  return type === "multiSelect" || type === "text" ? "contains" : "equals";
}

function operatorLabel(type: Field["type"] | undefined, operator: string) {
  const found = [...filterOperators(type), ...filterOperators(undefined), ...filterOperators("number")].find((item) => item.value === operator);
  return found?.label ?? operator;
}

function asValues(value: FilterRule["value"]): string[] {
  return Array.isArray(value) ? value : value === "" ? [] : [value];
}

export function projectSimpleFilters(filters: FilterRule[], filterMode: TableView["filterMode"], fieldById: Map<string, Field>, simpleFields: SimpleFilterField[]): SimpleProjection {
  const simpleIds = new Set(resolveSimpleFields(simpleFields, fieldById).map((item) => item.fieldId));
  const active = filters.filter(isActiveFilter);
  const reasons: string[] = [];
  // 「任意」只在至多一条有效条件时与「所有」等价，此时下面的逐条检查才有意义
  if (active.length > 1 && filterMode === "any") reasons.push("条件关系是「任意」");
  const values: FilterValues = {};
  for (const rule of active) {
    const field = fieldById.get(rule.fieldId);
    const title = field?.title ?? rule.fieldId;
    if (!simpleIds.has(rule.fieldId)) {
      reasons.push(`有「${title}」的条件`);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(values, rule.fieldId)) {
      reasons.push(`「${title}」有多条条件`);
      continue;
    }
    if (rule.operator !== canonicalOperator(field?.type)) {
      reasons.push(`「${title}」用了「${operatorLabel(field?.type, rule.operator)}」`);
      continue;
    }
    if (field?.type === "text" && typeof rule.value !== "string") {
      reasons.push(`「${title}」的条件格式不支持`);
      continue;
    }
    const selected = asValues(rule.value);
    if (field?.type === "boolean" && selected.length !== 1) {
      reasons.push(`「${title}」同时选了是和否`);
      continue;
    }
    values[rule.fieldId] = selected;
  }
  const unique = [...new Set(reasons)];
  return unique.length ? { ok: false, reasons: unique } : { ok: true, values };
}

export function canonicalRule(field: Pick<Field, "id" | "type"> | undefined, fieldId: string, values: string[]): FilterRule {
  // 文本条件的值是字符串，其余是选项数组
  return { id: crypto.randomUUID(), fieldId, operator: canonicalOperator(field?.type), value: field?.type === "text" ? values[0] ?? "" : values };
}

/**
 * 把某个简单字段的选择写回 filters：先删掉该字段的所有规则（含未生效的空规则），
 * 有选择时在第一条被删规则的位置（没有则末尾）放一条规范规则。
 * filterMode 为「任意」时改成「所有」：投影只允许「任意」搭配至多一条有效条件，改完语义不变。
 */
export function applySimpleFilter(filters: FilterRule[], filterMode: TableView["filterMode"], fieldId: string, values: string[], fieldById: Map<string, Field>): { filters: FilterRule[]; filterMode: TableView["filterMode"] } {
  const firstIndex = filters.findIndex((rule) => rule.fieldId === fieldId);
  const rest = filters.filter((rule) => rule.fieldId !== fieldId);
  const next = [...rest];
  if (values.some((value) => value !== "")) next.splice(firstIndex < 0 ? rest.length : firstIndex, 0, canonicalRule(fieldById.get(fieldId), fieldId, values));
  return { filters: next, filterMode: filterMode === "any" ? "all" : filterMode };
}

/** 当前视图里是否有简单字段上的有效条件（控制「清空」按钮） */
export function hasSimpleActive(values: FilterValues) {
  return Object.values(values).some((list) => list.length > 0);
}

/** 触发器上的摘要：未选「全部」，最多显示两个，更多的写成「A、B 等 N 个」 */
export function summarizeSelection(labels: string[]) {
  if (!labels.length) return "全部";
  if (labels.length <= 2) return labels.join("、");
  return `${labels.slice(0, 2).join("、")} 等 ${labels.length} 个`;
}

/**
 * 每个选项在「该字段只选它、其余条件不变」时留下的顶层记录数。
 * 直接用 projectTree，口径与表格实际显示一致（含搜索和子记录）；排序不影响数量，置空以省掉排序开销。
 */
export function simpleOptionCounts(rows: TableRecord[], view: TableView, orderedFields: Field[], fieldById: Map<string, Field>, search: string, getSubRows: (row: TableRecord) => TableRecord[], fieldId: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const option of fieldOptions(fieldById.get(fieldId))) {
    const applied = applySimpleFilter(view.filters, view.filterMode, fieldId, [option.value], fieldById);
    const projection = projectTree(rows, { ...view, filters: applied.filters, filterMode: applied.filterMode, sorts: [] }, orderedFields, fieldById, search, new Set(), getSubRows);
    counts.set(option.value, projection.matchedRoots.length);
  }
  return counts;
}
