import { Tooltip } from "../components/Tooltip";
import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
export interface SelectOption<T extends string = string> { value: T; label: string; icon?: LucideIcon }
interface SelectControlProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  compact?: boolean;
  inline?: boolean;
  searchable?: boolean;
  fluidLabels?: boolean;
  placeholder?: string;
  className?: string;
}
export function SelectControl<T extends string>({ value, options, onChange, ariaLabel, compact = false, inline = false, searchable = false, fluidLabels = false, placeholder, className }: SelectControlProps<T>) {
  const [query, setQuery] = useState("");
  const visibleOptions = searchable ? options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) : options;
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? (placeholder ? undefined : options[0]);
  const changeOpen = (next: boolean) => { setQuery(""); setOpen(next); };
  const choose = (nextValue: T) => { onChange(nextValue); changeOpen(false); };
  return <Popover.Root open={open} onOpenChange={changeOpen}>
    <Tooltip hoverOnly content={selected?.label} enabled={!inline}>
    <Popover.Trigger asChild>
      <button type="button" className={`select-trigger${className ? ` ${className}` : ""}${selected ? "" : " select-trigger--placeholder"}${fluidLabels ? " select-trigger--fluid" : ""}${compact ? " select-trigger--compact" : ""}${inline ? " select-trigger--inline" : ""}${open ? " open" : ""}`} aria-label={ariaLabel}
        onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); changeOpen(true); } }}
        >
        <span className="select-label">{selected?.label ?? placeholder ?? ""}</span><ChevronDown size={inline ? 12 : 14} />
      </button>
    </Popover.Trigger>
    </Tooltip>
    <Popover.Portal>
      <Popover.Content className={`ntable-portal select-menu${fluidLabels ? " select-menu--fluid" : ""}${compact ? " select-menu--compact" : ""}${inline ? " select-menu--inline" : ""}${searchable ? " select-menu--fields" : ""}`} collisionPadding={8} sticky="always" sideOffset={4} align="start" onKeyDown={moveOptionFocus}>
        {searchable && <div className="select-field-search"><Search size={16} /><input aria-label="搜索字段" placeholder="搜索字段" value={query} onChange={(event) => { setQuery(event.target.value); }} /></div>}
        <div className={searchable ? "select-field-options" : undefined}>
        {visibleOptions.map((option) => <Tooltip hoverOnly key={option.value} content={option.label} side="right" enabled={!inline}><button type="button" aria-label={option.label}
          aria-current={option.value === value ? "true" : undefined}
          className={option.value === value ? "select-option selected" : "select-option"}
          onClick={() => choose(option.value)}>
          {option.icon && <option.icon size={16} className="select-field-icon" />}<span className="select-label">{option.label}</span>{option.value === value && <Check size={14} />}
        </button></Tooltip>)}
        {visibleOptions.length === 0 && <div className="select-no-results">无匹配字段</div>}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

function moveOptionFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (event.nativeEvent.isComposing) return;
  if (event.target instanceof HTMLInputElement && ["Home", "End"].includes(event.key)) return;
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(".select-option"));
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : current < 0 ? (event.key === "ArrowUp" ? buttons.length - 1 : 0) : (current + (event.key === "ArrowUp" ? -1 : 1) + buttons.length) % buttons.length;
  buttons[index]?.focus();
}

interface MultiSelectControlProps<T extends string> {
  value: T[];
  options: SelectOption<T>[];
  onChange: (value: T[]) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}
/** Multiple-choice counterpart of SelectControl: options toggle in place and the menu stays open. */
export function MultiSelectControl<T extends string>({ value, options, onChange, ariaLabel, placeholder = "", className }: MultiSelectControlProps<T>) {
  const [open, setOpen] = useState(false);
  const chosen = new Set(value);
  const summary = options.filter((option) => chosen.has(option.value)).map((option) => option.label).join("、");
  // Keep the host's order of untouched values and append new ones in option order.
  const toggle = (next: T) => onChange(chosen.has(next) ? value.filter((item) => item !== next) : [...value, next]);
  // No Tooltip wrapper: it renders only with content, and remounting the trigger while toggling would drop the open menu's anchor.
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger asChild>
      <button type="button" className={`select-trigger select-trigger--fluid${className ? ` ${className}` : ""}${summary ? "" : " select-trigger--placeholder"}${open ? " open" : ""}`} aria-label={ariaLabel} title={summary || undefined}
        onKeyDown={(event) => { if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); } }}>
        <span className="select-label">{summary || placeholder}</span><ChevronDown size={14} />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className="ntable-portal select-menu select-menu--fluid" collisionPadding={8} sticky="always" sideOffset={4} align="start" onKeyDown={moveOptionFocus}>
        {options.map((option) => <button key={option.value} type="button" aria-label={option.label} aria-pressed={chosen.has(option.value)}
          className={chosen.has(option.value) ? "select-option selected" : "select-option"} onClick={() => toggle(option.value)}>
          <span className="select-label">{option.label}</span>{chosen.has(option.value) && <Check size={14} />}
        </button>)}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}

export function useOptimisticList<T>(value: T[], onChange: (value: T[]) => void): [T[], (value: T[]) => void] {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (next: T[]) => { setDraft(next); onChange(next); };
  return [draft, commit];
}
