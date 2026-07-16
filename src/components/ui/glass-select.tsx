"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type GlassOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type GlassSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: GlassOption[];
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
};

type MenuPos = { top: number; left: number; width: number; openUp: boolean };

/**
 * Custom select with glassmorphism menu portaled to document.body
 * so it always paints above tables / overflow containers.
 */
export function GlassSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  className,
  menuClassName,
  disabled = false,
  "aria-label": ariaLabel,
  id,
}: GlassSelectProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  useEffect(() => setMounted(true), []);

  function updatePosition() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxH = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < maxH && rect.top > spaceBelow;
    setPos({
      top: openUp ? rect.top - 8 : rect.bottom + 8,
      left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 8),
      width: Math.max(rect.width, 160),
      openUp,
    });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    function onReposition() {
      updatePosition();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const enabled = options.filter((o) => !o.disabled);
      const idx = enabled.findIndex((o) => o.value === value);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = enabled[Math.min(idx + 1, enabled.length - 1)] ?? enabled[0];
        if (next) onChange(next.value);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = enabled[Math.max(idx - 1, 0)] ?? enabled[0];
        if (prev) onChange(prev.value);
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, options, value, onChange]);

  const menu =
    open && mounted && pos
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel ?? placeholder}
            className={cn("glass-menu-portal max-h-60 overflow-y-auto", menuClassName)}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
              transform: pos.openUp ? "translateY(-100%)" : undefined,
            }}
          >
            <div className="relative z-[1] space-y-0.5 p-1.5">
              {options.length === 0 ? (
                <p className="px-2.5 py-2 text-meta text-neutral-400">No options</p>
              ) : (
                options.map((opt) => {
                  const isSelected = opt.value === value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={opt.disabled}
                      className={cn(
                        "glass-menu-item flex w-full items-center justify-between gap-2 text-left disabled:opacity-40",
                        isSelected &&
                          "bg-[rgba(0,105,62,0.12)] font-medium text-kengen-navy"
                      )}
                      onClick={() => {
                        if (opt.disabled) return;
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 truncate">{opt.label}</span>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-kengen-green" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={cn("relative", className)} ref={rootRef}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className="glass-trigger relative z-[1] w-full justify-between gap-2 px-2.5 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className={cn(
            "relative z-[1] min-w-0 truncate text-body",
            selected ? "text-kengen-navy" : "text-neutral-400"
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "relative z-[1] h-3.5 w-3.5 shrink-0 text-kengen-navy/70 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {menu}
    </div>
  );
}
