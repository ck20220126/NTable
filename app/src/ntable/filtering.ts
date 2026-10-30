import type { Field, TableView, TableRecord, FilterOperator, FilterRule } from "./types";
import { booleanKey } from "./booleanOptions.ts";

const emptyOperators: { value: FilterOperator; label: string }[] = [
  { value: "isEmpty", label: "为空" },
  { value: "isNotEmpty", label: "不为空" },
];

export function isEmptyOperator(operator: string) {
  return operator === "isEmpty" || operator === "isNotEmpty";
}

export function isActiveFilter(filter: { fieldId: string; operator: string; value: FilterRule["value"] }) {
  const hasValue = Array.isArray(filter.value) ? filter.value.length > 0 : filter.value !== "";
  return Boolean(filter.fieldId && (isEmptyOperator(filter.operator) || hasValue));
}

const commonOperators: { value: FilterOperator; label: string }[] = [
  { value: "contains", label: "包含" },
  { value: "notContains", label: "不包含" },
  { value: "equals", label: "等于" },
  { value: "notEquals", label: "不等于" },
];
const numberOperators: { value: FilterOperator; label: string }[] = [
  { value: "equals", label: "等于" },
  { value: "notEquals", label: "不等于" },
  { value: "greaterThan", label: "大于" },
  { value: "lessThan", label: "小于" },
];

const singleSelectOperators: { value: FilterOperator; label: string }[] = [
  { value: "equals", label: "等于" },
  { value: "notEquals", label: "不等于" },
];
const multiSelectOperators: { value: FilterOperator; label: string }[] = [
  { value: "contains", label: "包含" },
  { value: "notContains", label: "不包含" },
];

export function isSelectType(type?: Field["type"]): type is "singleSelect" | "multiSelect" {
  return type === "singleSelect" || type === "multiSelect";
}

/** Fields whose filter value is a list of option values: select fields and boolean (是 / 否). */
export function isOptionType(type?: Field["type"]): type is "singleSelect" | "multiSelect" | "boolean" {
  return isSelectType(type) || type === "boolean";
}

export function filterOperators(type?: Field["type"]) {
  const operators = type === "number" ? numberOperators : type === "singleSelect" || type === "boolean" ? singleSelectOperators : type === "multiSelect" ? multiSelectOperators : commonOperators;
  return [...operators, ...emptyOperators];
}

export function matchesFilter(value: unknown, operator: string, query: FilterRule["value"], type?: Field["type"]) {
  if (isEmptyOperator(operator)) {
    const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
    return operator === "isEmpty" ? empty : !empty;
  }
  if (isOptionType(type)) {
    const queries = Array.isArray(query) ? query : query === "" ? [] : [query];
    if (!queries.length) return false;
    // Choices within one condition are OR; negating the condition excludes every chosen option.
    const selected = type === "boolean" ? queries.includes(booleanKey(value) ?? "") : queries.some((option) => type === "singleSelect" ? value === option : Array.isArray(value) && value.includes(option));
    if (operator === "equals" || operator === "contains") return selected;
    if (operator === "notEquals" || operator === "notContains") return !selected;
    return false;
  }
  if (typeof query !== "string") return false;
  const text = String(value ?? "");
  if (operator === "contains" || operator === "notContains") {
    const contains = text.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return operator === "contains" ? contains : !contains;
  }
  if (type === "number") {
    if ((typeof value !== "number" && typeof value !== "string") || !text.trim() || !query.trim()) return false;
    const left = Number(value);
    const right = Number(query);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (operator === "greaterThan") return left > right;
    if (operator === "lessThan") return left < right;
    if (operator === "equals") return left === right;
    if (operator === "notEquals") return left !== right;
    return false;
  }
  if (operator === "equals") return text === query;
  if (operator === "notEquals") return text !== query;
  return false;
}

export function matchesFilters(row: TableRecord, filters: TableView["filters"], fieldById: Map<string, Field>, mode: TableView["filterMode"] = "all") {
  const active = filters.filter(isActiveFilter);
  if (!active.length) return true;
  const matches = (filter: TableView["filters"][number]) => matchesFilter(row[filter.fieldId], filter.operator, filter.value, fieldById.get(filter.fieldId)?.type);
  return mode === "any" ? active.some(matches) : active.every(matches);
}
