"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { getCurrentUser, repos } from "@/infrastructure/di";
import type { AuditLogEntry } from "@/domain/entities";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user.permissionCodes.includes("audit.view")) {
          setError("You do not have permission to view the audit trail");
          return;
        }
        setEntries(await repos.audits.list());
        const users = await repos.users.getAll();
        setNames(Object.fromEntries(users.map((u) => [u.id, u.name])));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load audit");
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description="Immutable log of system actions (append-only)"
      />
      {error ? <p className="mb-3 text-kengen-red">{error}</p> : null}
      {!error && entries.length === 0 ? (
        <EmptyState title="No audit events yet" />
      ) : null}
      {entries.length > 0 ? (
        <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
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
                  <td className="px-2 py-1.5">{e.correlationId.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
