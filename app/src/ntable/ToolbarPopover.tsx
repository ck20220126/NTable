import * as Popover from "@radix-ui/react-popover";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
export function ToolbarPopover({ icon: Icon, label, active, children, width = 340, className = "" }: { icon: LucideIcon; label: string; active: boolean; children: ReactNode; width?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const focusedControl = useRef<Element | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      focusedControl.current = null;
      return;
    }
    const previous = focusedControl.current;
    if (previous && !previous.isConnected && document.activeElement === document.body) {
      focusedControl.current = null;
      content.current?.focus({ preventScroll: true });
    }
  });
  const visibilityDismissal = useRef(false);
  useEffect(() => {
    if (!open || !trigger.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry || (entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0)) return;
      visibilityDismissal.current = true;
      setOpen(false);
    });
    observer.observe(trigger.current);
    return () => observer.disconnect();
  }, [open]);
  return <Popover.Root open={open} onOpenChange={(next) => { visibilityDismissal.current = false; setOpen(next); }}><Popover.Trigger asChild><button ref={trigger} type="button" data-tool={label} className={active ? "toolbar-action active" : "toolbar-action"}><Icon size={16} />{label}</button></Popover.Trigger><Popover.Portal><Popover.Content ref={content} aria-label={label.endsWith("配置") ? label : `${label}配置`} onFocusCapture={(event) => { focusedControl.current = event.target instanceof Element ? event.target : null; }} onBlurCapture={() => { focusedControl.current = null; }} className={`ntable-portal panel toolbar-panel ${className}`} onOpenAutoFocus={className === "filter-panel" ? (event) => { event.preventDefault(); content.current?.focus({ preventScroll: true }); } : undefined} onCloseAutoFocus={(event) => {
    if (visibilityDismissal.current) {
      event.preventDefault();
      visibilityDismissal.current = false;
    }
  }} collisionPadding={8} sideOffset={7} align="start" style={{ width }}>{children}</Popover.Content></Popover.Portal></Popover.Root>;
}
