"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { apiGet, apiSend } from "@/lib/client-api";
import type { Notification } from "@/domain/entities";
import { notificationDestination } from "@/lib/shared/notification-destination";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function priorityDot(priority: Notification["priority"]): string {
  switch (priority) {
    case "Critical":
      return "bg-red-500";
    case "High":
      return "bg-amber-500";
    case "Low":
      return "bg-neutral-400";
    default:
      return "bg-blue-500";
  }
}

const DROPDOWN_LIMIT = 6;

/**
 * Notification bell + dropdown. The badge counts ACTIVE (unresolved) tasks,
 * not unread messages (K-001). Opening the dropdown never removes or resolves
 * anything; clicking an item marks it read and navigates to its work item.
 */
export function NotificationBell({
  count,
  onChanged,
}: {
  count: number;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const loadActive = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await apiGet<Notification[]>("/api/v1/notifications"));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadActive();
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loadActive]);

  async function openItem(n: Notification) {
    setOpen(false);
    // Read ≠ resolved: server marks it read; actionable work stays active
    // until its workflow completes, so the badge keeps counting it.
    try {
      await apiSend(`/api/v1/notifications?action=read&id=${n.id}`, "POST");
    } catch {
      /* navigation still proceeds; state refreshes on next load */
    }
    onChanged();
    const to = notificationDestination(n);
    if (to) router.push(to);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="glass-trigger relative !rounded-xl p-1.5 text-kengen-navy"
        aria-label="Notifications"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="relative z-[1] h-4 w-4" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 z-[2] flex h-4 min-w-4 items-center justify-center rounded-full bg-kengen-red px-1 text-[10px] text-white">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-neutral-400/30 bg-white shadow-lg"
        >
          <div className="border-b border-neutral-200 px-3 py-2">
            <p className="text-sm font-semibold text-kengen-navy">
              Notifications
            </p>
            <p className="text-meta text-neutral-600">
              Active ({count})
            </p>
          </div>

          {loading ? (
            <p className="px-3 py-4 text-meta text-neutral-600">Loading…</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-4 text-meta text-neutral-600">
              You&apos;re all caught up
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto">
              {items.slice(0, DROPDOWN_LIMIT).map((n) => (
                <li key={n.id} className="border-b border-neutral-100">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void openItem(n)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-neutral-50"
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityDot(n.priority)}`}
                    />
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-body ${
                          n.isRead ? "font-medium" : "font-semibold"
                        } text-kengen-navy`}
                      >
                        {n.title}
                      </span>
                      <span className="block text-meta text-kengen-green">
                        {n.actionLabel}
                      </span>
                      <span className="block text-meta text-neutral-500">
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-center text-meta font-medium text-kengen-navy hover:bg-neutral-50"
          >
            View all notifications
          </Link>
        </div>
      ) : null}
    </div>
  );
}
