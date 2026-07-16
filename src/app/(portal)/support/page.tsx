"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { apiGet } from "@/lib/client-api";
import type { SupportIssue } from "@/domain/entities";

export default function MySupportIssuesPage() {
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<SupportIssue[]>("/api/v1/support-issues");
        setIssues(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  return (
    <PageShell>
      <PageHeader title="My Support Issues" />
      <p className="mb-4 text-meta text-neutral-600">
        Track issues you submitted via Report an Issue.
      </p>
      {error ? <p className="text-kengen-red">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-400/40 text-meta">
              <th className="py-2 pr-3">Reference</th>
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.id} className="border-b border-neutral-200">
                <td className="py-2 pr-3 font-mono text-xs">
                  {issue.referenceNumber}
                </td>
                <td className="py-2 pr-3">{issue.title}</td>
                <td className="py-2 pr-3">{issue.category}</td>
                <td className="py-2 pr-3">{issue.status}</td>
                <td className="py-2">
                  {new Date(issue.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
            {issues.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4 text-meta">
                  You have not submitted any issues yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
