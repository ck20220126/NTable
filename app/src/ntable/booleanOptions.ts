import type { Field } from "./types";

/**
 * 布尔字段固定两个选项：「是」用飞书浅蓝、「否」用飞书浅灰，所有布尔列一致，不参与选项色板的循环分配。
 * 蓝色只表示「开」，不带好坏含义，「暂停使用：是」这类反向字段也不会被读成正面状态。
 * 选项值是字符串，筛选条件里也存字符串；单元格里的 true / false 由 booleanKey 换算，null 视为未填。
 */
export const BOOLEAN_OPTIONS: readonly { value: "true" | "false"; label: string; color: string }[] = [
  { value: "true", label: "是", color: "#e0e9ff" },
  { value: "false", label: "否", color: "#eff0f1" },
];

export function booleanKey(value: unknown): "true" | "false" | null {
  return value === true ? "true" : value === false ? "false" : null;
}

/** 字段可选的选项：布尔字段用固定的是 / 否，单选多选用宿主给的 options */
export function fieldOptions(field: Pick<Field, "type" | "options"> | undefined): readonly { value: string; label: string; color?: string }[] {
  return field?.type === "boolean" ? BOOLEAN_OPTIONS : field?.options ?? [];
}
