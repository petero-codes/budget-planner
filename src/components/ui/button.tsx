import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Enterprise action variants (KenGen palette).
 * Canonical mapping: docs/button-design-system.md
 *
 * - primary  — Create, Save, Submit, Approve, Claim, Resubmit
 * - success  — Finalize, Complete (terminal)
 * - secondary — View, Edit (draft), Download, Export, SAP Package, Cancel, Back
 * - warning  — Return, Review, Edit returned budget, Reopen
 * - danger   — Reject, Delete, Archive, Deactivate, Remove
 * - ghost    — low-emphasis tertiary only
 *
 * Approve = Primary (blue). Finalize = Success (green). Do not conflate.
 */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "warning"
  | "danger"
  | "success"
  | "ghost";

export type ButtonSize = "default" | "compact";

type SharedProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Shown instead of children while loading (default: Please wait…). */
  loadingLabel?: string;
  icon?: LucideIcon;
  "aria-label"?: string;
  className?: string;
  children?: React.ReactNode;
};

const baseClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium " +
  "cursor-pointer select-none transition-all duration-150 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 " +
  "hover:-translate-y-px hover:shadow-md active:scale-[0.98] active:translate-y-0 " +
  "disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";

const sizeClass: Record<ButtonSize, string> = {
  default: "min-h-11 px-3.5 py-2 text-body",
  compact: "min-h-11 px-2.5 py-1.5 text-meta",
};

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-kengen-blue/80 bg-kengen-blue text-white hover:bg-kengen-blue/90 focus-visible:ring-kengen-blue/40",
  secondary:
    "border-kengen-navy/25 bg-white text-kengen-navy hover:bg-kengen-navy/5 focus-visible:ring-kengen-navy/30",
  warning:
    "border-kengen-amber/80 bg-kengen-amber text-white hover:bg-kengen-amber/90 focus-visible:ring-kengen-amber/40",
  danger:
    "border-kengen-red/80 bg-kengen-red text-white hover:bg-kengen-red/90 focus-visible:ring-kengen-red/40",
  success:
    "border-kengen-green/80 bg-kengen-green text-white hover:bg-kengen-green/90 focus-visible:ring-kengen-green/40",
  ghost:
    "border-transparent bg-transparent text-kengen-navy shadow-none hover:border-kengen-navy/15 hover:bg-kengen-navy/5 hover:shadow-sm focus-visible:ring-kengen-navy/30",
};

export function actionButtonClassName({
  variant = "secondary",
  size = "default",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cn(
    baseClass,
    sizeClass[size],
    variantClass[variant],
    fullWidth && "w-full",
    className
  );
}

type ButtonProps = SharedProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

/** Portal action button — primary / secondary / warning / danger / success / ghost. */
export function Button({
  variant = "primary",
  size = "default",
  fullWidth = false,
  loading = false,
  loadingLabel = "Please wait…",
  icon: Icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={actionButtonClassName({
        variant,
        size,
        fullWidth,
        className,
      })}
    >
      {loading ? (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : Icon ? (
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : null}
      {loading ? <span>{loadingLabel}</span> : children}
    </button>
  );
}

type ActionLinkProps = SharedProps &
  Omit<React.ComponentProps<typeof Link>, "className" | "children"> & {
    disabled?: boolean;
  };

/**
 * Next.js Link styled as an action button (table / header navigation actions).
 */
export function ActionLink({
  variant = "secondary",
  size = "compact",
  fullWidth = false,
  icon: Icon,
  className,
  children,
  disabled,
  "aria-label": ariaLabel,
  ...rest
}: ActionLinkProps) {
  if (disabled) {
    return (
      <span
        role="link"
        aria-disabled="true"
        aria-label={ariaLabel}
        className={actionButtonClassName({
          variant,
          size,
          fullWidth,
          className: cn("pointer-events-none opacity-50", className),
        })}
      >
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
        {children}
      </span>
    );
  }

  return (
    <Link
      {...rest}
      aria-label={ariaLabel}
      className={actionButtonClassName({
        variant,
        size,
        fullWidth,
        className,
      })}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
      {children}
    </Link>
  );
}
