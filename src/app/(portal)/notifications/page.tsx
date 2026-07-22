"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { CheckCheck, ChevronRight, X } from "lucide-react";
import { apiGet, apiSend } from "@/lib/client-api";
import {
  isActionableNotification,
  type Notification,
} from "@/domain/entities";
import { notificationDestination } from "@/lib/shared/notification-destination";

type View = "active" | "history";

function priorityClass(priority: Notification["priority"]): string {
  switch (priority) {
    case "Critical":
      return "bg-red-100 text-red-800";
    case "High":
      return "bg-amber-100 text-amber-800";
    case "Low":
      return "bg-neutral-100 text-neutral-600";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("active");
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload(next: View) {
    setLoading(true);
    const path =
      next === "history"
        ? "/api/v1/notifications?view=history"
        : "/api/v1/notifications";
    setItems(await apiGet<Notification[]>(path));
    setLoading(false);
  }

  useEffect(() => {
    void reload(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function destinationFor(n: Notification): string | null {
    return notificationDestination(n);
  }

  async function open(n: Notification) {
    // Reading marks it read and navigates. Informational items are acknowledged
    // (resolved) server-side; actionable work stays until its workflow completes.
    await apiSend(`/api/v1/notifications?action=read&id=${n.id}`, "POST");
    const to = destinationFor(n);
    if (to) {
      router.push(to);
      return;
    }
    if (isActionableNotification(n.type)) {
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, isRead: true, readAt: new Date().toISOString() } : x
        )
      );
    } else {
      setItems((prev) => prev.filter((x) => x.id !== n.id));
    }
  }

  async function markAllRead() {
    await apiSend(`/api/v1/notifications?action=readAll`, "POST");
    await reload("active");
  }

  async function removeFromHistory(id: string) {
    await apiSend(`/api/v1/notifications?id=${id}`, "DELETE");
    setItems((prev) => prev.filter((n) => n.id !== id));
  }

  const hasUnread = items.some((n) => !n.isRead);

  return (
    <PageShell>
      <PageHeader title="Notifications" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-neutral-400/30 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView("active")}
            className={`rounded-md px-3 py-1 text-meta ${
              view === "active"
                ? "bg-kengen-navy text-white"
                : "text-neutral-700"
            }`}
          >
            To-do
          </button>
          <button
            type="button"
            onClick={() => setView("history")}
            className={`rounded-md px-3 py-1 text-meta ${
              view === "history"
                ? "bg-kengen-navy text-white"
                : "text-neutral-700"
            }`}
          >
            History
          </button>
        </div>
        {view === "active" && hasUnread ? (
          <Button
            type="button"
            variant="secondary"
            size="compact"
            icon={CheckCheck}
            onClick={() => void markAllRead()}
          >
            Mark all as read
          </Button>
        ) : null}
      </div>

      {loading ? <p className="text-meta text-neutral-700">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          fill
          title={
            view === "active"
              ? "You're all caught up"
              : "No resolved notifications"
          }
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="flex-1 space-y-2">
          {items.map((n) => {
            const unread = !n.isRead;
            const to = destinationFor(n);
            return (
              <li
                key={n.id}
                className="rounded border border-neutral-400/30 bg-white text-body"
              >
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => (view === "active" ? void open(n) : to ? router.push(to) : undefined)}
                    className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left"
                  >
                    {view === "active" && unread ? (
                      <span
                        aria-hidden
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-kengen-red"
                      />
                    ) : null}
                    <span className="min-w-0">
                      <span
                        className={`block ${
                          unread ? "font-semibold" : "font-medium"
                        } text-kengen-navy`}
                      >
                        {n.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityClass(n.priority)}`}
                        >
                          {n.priority}
                        </span>
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600">
                          {n.category}
                        </span>
                      </span>
                      <span className="block text-meta text-neutral-700">
                        {n.message}
                      </span>
                      <span className="mt-1 block text-meta text-neutral-400">
                        {new Date(n.createdAt).toLocaleString()}
                        {view === "history" && n.resolvedAt
                          ? ` · resolved ${new Date(n.resolvedAt).toLocaleDateString()}`
                          : ""}
                      </span>
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center pr-2">
                    {view === "active" ? (
                      to ? (
                        <span className="flex items-center gap-1 text-meta font-medium text-kengen-navy">
                          {n.actionLabel}
                          <ChevronRight
                            className="h-4 w-4 text-neutral-400"
                            aria-hidden
                          />
                        </span>
                      ) : null
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="compact"
                        icon={X}
                        onClick={() => void removeFromHistory(n.id)}
                        aria-label="Remove from history"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </PageShell>
  );
}
