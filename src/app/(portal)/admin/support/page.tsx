"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { apiGet, apiSend } from "@/lib/client-api";
import type { SupportIssue, User } from "@/domain/entities";
import { SUPPORT_ISSUE_STATUSES } from "@/domain/support-issue";
import { useRouter } from "next/navigation";

export default function AdminSupportIssuesPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportIssue | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<(typeof SUPPORT_ISSUE_STATUSES)[number]>(
    "Open"
  );
  const [assignedTo, setAssignedTo] = useState<string>("");

  async function reload() {
    const [list, adminUsers] = await Promise.all([
      apiGet<SupportIssue[]>("/api/v1/support-issues?scope=all"),
      apiGet<User[]>("/api/v1/admin/users").catch(() => [] as User[]),
    ]);
    setIssues(list);
    setUsers(adminUsers);
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        if (!me.user.roleCodes.includes("SystemAdmin")) {
          router.replace("/access-denied");
          return;
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [router]);

  const openCount = issues.filter(
    (i) => i.status === "Open" || i.status === "Assigned" || i.status === "InProgress"
  ).length;

  return (
    <PageShell>
      <PageHeader title="Support Issues" />
      <p className="mb-4 text-meta text-neutral-600">
        Open / in progress: <strong className="text-kengen-navy">{openCount}</strong>
      </p>
      {error ? <p className="text-kengen-red">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-400/40 text-meta">
              <th className="py-2 pr-3">Reference</th>
              <th className="py-2 pr-3">Reporter</th>
              <th className="py-2 pr-3">Page</th>
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Priority</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr
                key={issue.id}
                className="cursor-pointer border-b border-neutral-200 hover:bg-neutral-50"
                onClick={() => {
                  setSelected(issue);
                  setNotes(issue.adminNotes ?? "");
                  setStatus(issue.status);
                  setAssignedTo(issue.assignedTo ?? "");
                }}
              >
                <td className="py-2 pr-3 font-mono text-xs">
                  {issue.referenceNumber}
                </td>
                <td className="py-2 pr-3">
                  {users.find((u) => u.id === issue.reportedBy)?.name ??
                    issue.reportedBy.slice(0, 8)}
                </td>
                <td className="py-2 pr-3">{issue.pageLabel ?? "—"}</td>
                <td className="py-2 pr-3">{issue.title}</td>
                <td className="py-2 pr-3">{issue.priority}</td>
                <td className="py-2">{issue.status}</td>
              </tr>
            ))}
            {issues.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-meta">
                  No support issues yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto border border-neutral-400 bg-white p-5">
            <h3 className="text-lg font-medium text-kengen-navy">
              {selected.referenceNumber}
            </h3>
            <p className="mt-1 text-sm text-neutral-700">{selected.title}</p>
            <p className="mt-3 whitespace-pre-wrap text-sm">
              {selected.description}
            </p>
            <dl className="mt-4 grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-meta">Category</dt>
                <dd>{selected.category}</dd>
              </div>
              <div>
                <dt className="text-meta">Page</dt>
                <dd>{selected.pageLabel}</dd>
              </div>
              <div>
                <dt className="text-meta">Browser</dt>
                <dd>{selected.browser}</dd>
              </div>
              <div>
                <dt className="text-meta">Version</dt>
                <dd>{selected.appVersion}</dd>
              </div>
            </dl>

            <label className="mt-4 block text-meta">
              Status
              <select
                className="mt-1 w-full border border-neutral-400 px-2 py-1"
                value={status}
                onChange={(e) =>
                  setStatus(
                    e.target.value as (typeof SUPPORT_ISSUE_STATUSES)[number]
                  )
                }
              >
                {SUPPORT_ISSUE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block text-meta">
              Assign to
              <select
                className="mt-1 w-full border border-neutral-400 px-2 py-1"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
              >
                <option value="">Unassigned</option>
                {users
                  .filter((u) => u.roleCodes.includes("SystemAdmin"))
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="mt-3 block text-meta">
              Admin notes
              <textarea
                className="mt-1 w-full border border-neutral-400 px-2 py-1"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm hover:underline"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-kengen-navy px-3 py-2 text-sm text-white"
                onClick={() => {
                  void (async () => {
                    await apiSend(`/api/v1/support-issues/${selected.id}`, "PATCH", {
                      status,
                      assignedTo: assignedTo || null,
                      adminNotes: notes,
                    });
                    setSelected(null);
                    await reload();
                  })();
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
