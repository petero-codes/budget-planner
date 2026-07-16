"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonTable } from "@/components/shared/skeleton-table";
import { ApiError, apiGet } from "@/lib/client-api";
import type { AuditLogEntry, User } from "@/domain/entities";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        if (!me.user.permissionCodes.includes("audit.view")) {
          setError("You do not have permission to view the audit trail");
          return;
        }
        setEntries(await apiGet<AuditLogEntry[]>("/api/v1/audit"));
        const ref = await apiGet<{ users: User[] }>("/api/v1/reference");
        setNames(Object.fromEntries(ref.users.map((u) => [u.id, u.name])));
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          setError("You do not have permission to view the audit trail");
        } else {
          setError(e instanceof Error ? e.message : "Failed to load audit");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageShell>
      <PageHeader title="Audit Trail" />

      {error ? <p className="mb-3 text-kengen-red">{error}</p> : null}
      {loading ? <SkeletonTable /> : null}
      {!loading && !error && entries.length === 0 ? (
        <EmptyState fill title="No audit events" />
      ) : null}
      {!loading && entries.length > 0 ? (
        <div className="flex-1 overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <table className="w-full text-left text-meta">
            <thead className="bg-neutral-100 uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">Timestamp</th>
                <th className="px-2 py-1.5">Actor</th>
                <th className="px-2 py-1.5">Action</th>
                <th className="px-2 py-1.5">Entity</th>
                <th className="px-2 py-1.5">Correlation</th>
              </tr>
            </thead>
            <tbody>
              {[...entries].reverse().map((e) => (
                <tr key={e.id} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">
                    {new Date(e.timestamp).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5">
                    {names[e.performedBy] ?? e.performedBy}
                  </td>
                  <td className="px-2 py-1.5">{e.action}</td>
                  <td className="px-2 py-1.5">
                    {e.entity}:{e.entityId.slice(0, 12)}…
                  </td>
                  <td className="px-2 py-1.5">
                    {e.correlationId.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageShell>
  );
}
