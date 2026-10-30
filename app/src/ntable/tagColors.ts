/**
 * 选项标签底色，取自飞书多维表格选项色板的浅色档，按色相排列：
 * 红、橙、黄、黄绿、绿、青、天蓝、蓝、洋红、紫、灰。标签文字色由 CSS contrast-color() 按底色自动取黑或白，不支持的浏览器兜底 #1f2329。
 */
export const TAG_COLORS = ["#fee3e2", "#fee7cd", "#faedc2", "#e3f0a3", "#d0f5ce", "#c4f2ec", "#caeffc", "#e0e9ff", "#fee2f2", "#efe6fe", "#eff0f1"] as const;

/** 第二轮用的同色降透明度版本：和第一轮色相一致但更浅，选项多于一轮时仍能区分 */
const FADED_ALPHA = 0.5;

function faded(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${FADED_ALPHA})`;
}

/**
 * 第 index 个选项的默认颜色（index 从 0 起，按字段 options 的顺序）：先循环一轮浅色，
 * 用完后换成降透明度的一轮，再往后两轮交替。颜色由顺序决定，不随机、不让用户手选。
 */
export function tagColor(index: number): string {
  const size = TAG_COLORS.length;
  const position = ((index % (size * 2)) + size * 2) % (size * 2);
  const base = TAG_COLORS[position % size]!;
  return position < size ? base : faded(base);
}

/** 选项指定了 color 就用它，否则按它在 options 里的位置取默认色；不在 options 里的值用灰色 */
export function optionTagColor(options: readonly { value: string; color?: string }[] | undefined, value: string): string {
  const index = options?.findIndex((option) => option.value === value) ?? -1;
  if (index < 0) return TAG_COLORS[TAG_COLORS.length - 1]!;
  return options![index]!.color ?? tagColor(index);
}
