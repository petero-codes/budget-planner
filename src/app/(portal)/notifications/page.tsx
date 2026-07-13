"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getCurrentUser, repos } from "@/infrastructure/di";
import type { Notification } from "@/domain/entities";

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    void (async () => {
      const user = await getCurrentUser();
      setItems(await repos.notifications.listByUser(user.id));
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Notifications" description="Approval and system alerts" />
      {items.length === 0 ? (
        <EmptyState title="No notifications" />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded border border-neutral-400/30 bg-white px-3 py-2 text-body ${
                n.isRead ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-kengen-navy">{n.title}</p>
                  <p className="text-meta text-neutral-700">{n.body}</p>
                  <p className="mt-1 text-meta text-neutral-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {n.relatedPlanId ? (
                  <Link
                    href={`/budgets/${n.relatedPlanId}`}
                    className="text-meta text-kengen-blue hover:underline"
                  >
                    Open
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
