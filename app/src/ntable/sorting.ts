import type { Field, SortRule, TableRecord } from "./types";

const textOrder = new Intl.Collator("zh-CN", { numeric: true });

function numericValue(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Build once per projection, rather than rebuilding locale options per comparison. */
export function recordComparator(sorts: SortRule[], fields: Map<string, Field>) {
  return (a: TableRecord, b: TableRecord): number => {
    for (const sort of sorts) {
      const left = a[sort.fieldId], right = b[sort.fieldId];
      let comparison: number;
      if (fields.get(sort.fieldId)?.type === "number") {
        const leftNumber = numericValue(left), rightNumber = numericValue(right);
        // Missing numbers stay last regardless of direction; two missing values tie.
        if (leftNumber === null || rightNumber === null) {
          if (leftNumber !== rightNumber) return leftNumber === null ? 1 : -1;
          continue;
        }
        comparison = leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
      } else {
        comparison = textOrder.compare(String(left ?? ""), String(right ?? ""));
      }
      if (comparison) return sort.direction === "desc" ? -comparison : comparison;
    }
    return 0;
  };
}
