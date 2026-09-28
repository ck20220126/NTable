import * as Popover from "@radix-ui/react-popover";
export function ToolbarPopover({ icon: Icon, label, active, children, width = 340 }: any) {
  return <Popover.Root><Popover.Trigger asChild><button data-tool={label} className={active ? "toolbar-action active" : "toolbar-action"}><Icon size={16} />{label}</button></Popover.Trigger><Popover.Portal><Popover.Content className="panel" sideOffset={7} align="start" style={{ width }}>{children}</Popover.Content></Popover.Portal></Popover.Root>;
}
