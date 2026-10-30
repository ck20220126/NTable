import { Hash, Calendar, CircleChevronDown, ListChecks, SquareCheck, TextCursorInput } from "lucide-react";
// 方框打勾留给布尔；单选用下拉圆圈，两者一眼可分
export const iconForType = { number: Hash, text: TextCursorInput, singleSelect: CircleChevronDown, multiSelect: ListChecks, boolean: SquareCheck, date: Calendar };
