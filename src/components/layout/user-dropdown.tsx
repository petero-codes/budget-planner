"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@/domain/entities";
import { ChevronDown } from "lucide-react";
import { apiSend } from "@/lib/client/client-api";

export function UserDropdown({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  function updatePosition() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
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
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  async function signOut() {
    close();
    try {
      await apiSend("/api/v1/auth/logout", "POST");
    } finally {
      router.push("/login");
    }
  }

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");

  const menu =
    open && mounted && pos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="glass-menu-portal w-48"
            style={{
              position: "fixed",
              top: pos.top,
              right: pos.right,
              zIndex: 9999,
            }}
          >
            <div className="relative z-[1] space-y-0.5 p-1.5 text-body">
              <Link
                href="/profile"
                role="menuitem"
                className="glass-menu-item text-kengen-navy"
                onClick={close}
              >
                My Profile
              </Link>
              <Link
                href="/support"
                role="menuitem"
                className="glass-menu-item text-kengen-navy"
                onClick={close}
              >
                Help
              </Link>
              <div className="my-1 border-t border-white/40" aria-hidden />
              <button
                type="button"
                role="menuitem"
                className="glass-menu-item glass-menu-item-danger w-full text-left text-kengen-red"
                onClick={() => void signOut()}
              >
                Log Out
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((v) => !v)}
        className="glass-trigger"
      >
        <span className="relative z-[1] flex h-7 w-7 items-center justify-center rounded-full bg-kengen-navy/90 text-meta text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
          {initials}
        </span>
        <span className="relative z-[1] hidden max-w-[10rem] truncate text-body font-medium text-kengen-navy sm:block">
          {user.name}
        </span>
        <ChevronDown
          className={`relative z-[1] h-3.5 w-3.5 shrink-0 text-kengen-navy/70 transition-transform duration-200 ${
            open ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>
      {menu}
    </div>
  );
}
