import type { Field, SortRule, TableRecord } from "./types";
import { booleanKey } from "./booleanOptions.ts";

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
      const type = fields.get(sort.fieldId)?.type;
      if (type === "boolean") {
        const leftKey = booleanKey(left), rightKey = booleanKey(right);
        // Unset stays last regardless of direction, like missing numbers; ascending puts 是 before 否.
        if (leftKey === null || rightKey === null) {
          if (leftKey !== rightKey) return leftKey === null ? 1 : -1;
          continue;
        }
        comparison = leftKey === rightKey ? 0 : leftKey === "true" ? -1 : 1;
      } else if (type === "number") {
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
