import { fieldOptions } from "./booleanOptions.ts";
import { projectTree } from "./tree.ts";
import type { Field, FilterOperator, FilterRule, SimpleFilterField, SimpleFilterValues, TableRecord, TableView } from "./types";

/**
 * 简单筛选是独立于视图的临时条件：值按字段记成字符串数组（文本是单元素数组），不写进 activeView.filters，
 * 只在简单模式下与视图条件同时生效。单选 equals、多选 contains、布尔 equals（值为 ["true"] 或 ["false"]）、文本 contains（值是字符串）。
 */
export type SimpleFilterType = "text" | "singleSelect" | "multiSelect" | "boolean";
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

/**
 * 把简单筛选的值转成筛选规则（与视图条件按「所有」叠加）。未知或不支持的字段、没有有效值的字段跳过；
 * 规则 id 固定为 `simple:<fieldId>`，同样的值得到同样的规则。
 */
export function simpleFilterRules(values: SimpleFilterValues | undefined, fieldById: Map<string, Field>): FilterRule[] {
  const rules: FilterRule[] = [];
  for (const [fieldId, list] of Object.entries(values ?? {})) {
    const field = fieldById.get(fieldId);
    const picked = list.filter((value) => value !== "");
    if (!field || !isSimpleFilterType(field.type) || !picked.length) continue;
    rules.push({ id: `simple:${fieldId}`, fieldId, operator: canonicalOperator(field.type), value: field.type === "text" ? picked[0] : picked });
  }
  return rules;
}

/** 是否有生效的简单筛选（控制「清空」按钮） */
export function hasSimpleActive(values: SimpleFilterValues) {
  return Object.values(values).some((list) => list.some((value) => value !== ""));
}

/** 触发器上的摘要：未选「全部」，最多显示两个，更多的写成「A、B 等 N 个」 */
export function summarizeSelection(labels: string[]) {
  if (!labels.length) return "全部";
  if (labels.length <= 2) return labels.join("、");
  return `${labels.slice(0, 2).join("、")} 等 ${labels.length} 个`;
}

/**
 * 每个选项在「该字段只选它、视图条件和其它简单筛选不变」时留下的顶层记录数。
 * 直接用 projectTree，口径与表格实际显示一致（含搜索和子记录）；排序不影响数量，置空以省掉排序开销。
 */
export function simpleOptionCounts(rows: TableRecord[], view: TableView, orderedFields: Field[], fieldById: Map<string, Field>, search: string, getSubRows: (row: TableRecord) => TableRecord[], fieldId: string, values: SimpleFilterValues = {}): Map<string, number> {
  const counts = new Map<string, number>();
  const sortless = { ...view, sorts: [] };
  for (const option of fieldOptions(fieldById.get(fieldId))) {
    const extra = simpleFilterRules({ ...values, [fieldId]: [option.value] }, fieldById);
    const projection = projectTree(rows, sortless, orderedFields, fieldById, search, new Set(), getSubRows, extra);
    counts.set(option.value, projection.matchedRoots.length);
  }
  return counts;
}
