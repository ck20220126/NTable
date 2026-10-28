import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";

interface TooltipProps {
  children: ReactElement;
  content: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  enabled?: boolean;
  settleFocus?: boolean;
  /** Open on pointer hover only. For tooltips that repeat a label the control already exposes, so focus moves (including a menu's automatic focus) stay quiet. */
  hoverOnly?: boolean;
}

function FocusSettledTooltip({ children, portal }: { children: ReactElement; portal: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pending = useRef<number | null>(null);
  const cancel = () => {
    if (pending.current !== null) cancelAnimationFrame(pending.current);
    pending.current = null;
  };
  useEffect(() => () => cancel(), []);
  return <RadixTooltip.Root open={open} onOpenChange={setOpen}>
    <RadixTooltip.Trigger asChild onFocus={(event) => {
      // Skip Radix's immediate focus opening until the local reveal scroll settles.
      event.preventDefault();
      cancel();
      setOpen(false);
      const trigger = event.currentTarget;
      pending.current = requestAnimationFrame(() => {
        pending.current = requestAnimationFrame(() => {
          pending.current = null;
          if (document.activeElement === trigger) setOpen(true);
        });
      });
    }} onBlur={cancel} onPointerDown={cancel} onClick={cancel} onKeyDown={(event) => {
      if (["Escape", "Enter", " "].includes(event.key)) {
        cancel();
        setOpen(false);
      }
    }}>{children}</RadixTooltip.Trigger>
    {portal}
  </RadixTooltip.Root>;
}

export function Tooltip({ children, content, side = "top", enabled = true, settleFocus = false, hoverOnly = false }: TooltipProps) {
  if (!enabled || !content) return children;
  const portal = <RadixTooltip.Portal>
        <RadixTooltip.Content className="ntable-portal ui-tooltip" side={side} sideOffset={8} collisionPadding={8} hideWhenDetached>
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>;
  return <RadixTooltip.Provider delayDuration={400}>
    {settleFocus ? <FocusSettledTooltip portal={portal}>{children}</FocusSettledTooltip> : <RadixTooltip.Root>
      {/* preventDefault skips Radix's composed focus handler, which would open the tooltip immediately. */}
      <RadixTooltip.Trigger asChild onFocus={hoverOnly ? (event) => event.preventDefault() : undefined}>{children}</RadixTooltip.Trigger>
      {portal}
    </RadixTooltip.Root>}
  </RadixTooltip.Provider>;
}
