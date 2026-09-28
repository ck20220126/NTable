import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import "./Button.css";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
  variant?: "contained" | "outlined" | "text";
  color?: "default" | "primary" | "danger";
  size?: "small" | "medium" | "large";
  icon?: ReactNode;
  iconOnly?: boolean;
  loading?: boolean;
  block?: boolean;
}

/** Native button semantics and ref forwarding also support Radix asChild triggers. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = "text", color = "default", size = "medium", icon,
  iconOnly = false, loading = false, block = false, disabled,
  className = "", children, type = "button", ...props
}, ref) {
  return <button {...props} ref={ref} type={type} disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={`ui-button ui-button--${variant} ui-button--${color} ui-button--${size}${iconOnly ? " ui-button--icon" : ""}${block ? " ui-button--block" : ""} ${className}`}>
    {loading ? <span className="ui-button-spinner" aria-hidden="true" /> : icon}
    {children}
  </button>;
});
