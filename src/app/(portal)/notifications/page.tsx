"use client";



import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";

import { PageShell } from "@/components/shared/page-shell";

import { EmptyState } from "@/components/shared/empty-state";

import { Button } from "@/components/ui/button";

import { ExternalLink, X } from "lucide-react";

import { apiGet, apiSend } from "@/lib/client-api";

import type { Notification } from "@/domain/entities";



export default function NotificationsPage() {

  const router = useRouter();

  const [items, setItems] = useState<Notification[]>([]);

  const [loading, setLoading] = useState(true);



  async function reload() {

    setItems(await apiGet<Notification[]>("/api/v1/notifications"));

  }



  useEffect(() => {

    void (async () => {

      await reload();

      setLoading(false);

    })();

  }, []);



  async function caterFor(notification: Notification) {

    await apiSend(`/api/v1/notifications?id=${notification.id}`, "DELETE");

    setItems((prev) => prev.filter((n) => n.id !== notification.id));

    if (notification.relatedPlanId) {

      router.push(`/budgets/${notification.relatedPlanId}`);

    }

  }



  async function dismissOnly(id: string) {

    await apiSend(`/api/v1/notifications?id=${id}`, "DELETE");

    setItems((prev) => prev.filter((n) => n.id !== id));

  }



  return (

    <PageShell>

      <PageHeader title="Notifications" />

      {loading ? (
        <p className="text-meta text-neutral-700">Loading…</p>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState fill title="No notifications" />
      ) : null}

      {!loading && items.length > 0 ? (

        <ul className="flex-1 space-y-2">

          {items.map((n) => (

            <li

              key={n.id}

              className="rounded border border-neutral-400/30 bg-white px-3 py-2 text-body"

            >

              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                <div className="min-w-0">

                  <p className="font-medium text-kengen-navy">{n.title}</p>

                  <p className="text-meta text-neutral-700">{n.body}</p>

                  <p className="mt-1 text-meta text-neutral-400">

                    {new Date(n.createdAt).toLocaleString()}

                  </p>

                </div>

                <div className="flex shrink-0 flex-wrap gap-2">

                  {n.relatedPlanId ? (

                    <Button

                      type="button"

                      variant="primary"

                      size="compact"

                      icon={ExternalLink}

                      onClick={() => void caterFor(n)}

                      aria-label="Open related budget and clear notification"

                    >

                      Open & clear

                    </Button>

                  ) : null}

                  <Button

                    type="button"

                    variant="secondary"

                    size="compact"

                    icon={X}

                    onClick={() => void dismissOnly(n.id)}

                    aria-label="Dismiss notification"

                  >

                    Dismiss

                  </Button>

                </div>

              </div>

            </li>

          ))}

        </ul>

      ) : null}

    </PageShell>

  );

}


