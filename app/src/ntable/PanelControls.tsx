import { useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
export function SelectControl({ value, options, onChange, ariaLabel }: any) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const choose = (nextValue) => { onChange(nextValue); setOpen(false); };
  return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><button className={`select-trigger${open ? " open" : ""}`} aria-label={ariaLabel}><span>{selected?.label}</span><ChevronDown size={14} /></button></Popover.Trigger><Popover.Portal><Popover.Content className="select-menu" sideOffset={5} align="start">{options.map((option) => <button key={option.value} className={option.value === value ? "select-option selected" : "select-option"} onClick={() => choose(option.value)}><span>{option.label}</span>{option.value === value && <Check size={14} />}</button>)}</Popover.Content></Popover.Portal></Popover.Root>;
}

export function useOptimisticList(value, onChange) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (next) => { setDraft(next); onChange(next); };
  return [draft, commit];
}
