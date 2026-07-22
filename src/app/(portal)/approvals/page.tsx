"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Eye } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { SkeletonTable } from "@/components/shared/skeleton-table";
import { ActionLink } from "@/components/ui/button";
import { apiGet } from "@/lib/client-api";
import type { BudgetPlan, CostCenter, User } from "@/domain/entities";
import { budgetCategoryLabel } from "@/domain/constants/budget-types";
import { cn, formatCurrency } from "@/lib/utils";

type Tab = "pending" | "returned" | "approved" | "rejected";

const APPROVED_STATUSES = new Set<BudgetPlan["status"]>([
  "Approved",
  "Finalized",
  "PendingFinanceReview",
  "Claimed",
]);

function matchesTab(tab: Tab, status: BudgetPlan["status"]): boolean {
  switch (tab) {
    case "pending":
      return status === "InApproval";
    case "returned":
      return status === "ReturnedForRevision";
    case "approved":
      return APPROVED_STATUSES.has(status);
    case "rejected":
      return status === "Rejected";
  }
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [myQueueIds, setMyQueueIds] = useState<Set<string>>(new Set());
  const [names, setNames] = useState<Record<string, string>>({});
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [all, queue, ref] = await Promise.all([
          apiGet<BudgetPlan[]>("/api/v1/budget-plans"),
          apiGet<BudgetPlan[]>("/api/v1/approvals/pending"),
          apiGet<{ users: User[]; costCenters: CostCenter[] }>(
            "/api/v1/reference"
          ),
        ]);
        setPlans(all);
        setMyQueueIds(new Set(queue.map((p) => p.id)));
        setNames(Object.fromEntries(ref.users.map((u) => [u.id, u.name])));
        setCenters(ref.costCenters);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const counts = useMemo(() => {
    const c: Record<Tab, number> = {
      pending: 0,
      returned: 0,
      approved: 0,
      rejected: 0,
    };
    for (const p of plans) {
      if (p.status === "InApproval") c.pending += 1;
      else if (p.status === "ReturnedForRevision") c.returned += 1;
      else if (APPROVED_STATUSES.has(p.status)) c.approved += 1;
      else if (p.status === "Rejected") c.rejected += 1;
    }
    return c;
  }, [plans]);

  const rows = useMemo(
    () => plans.filter((p) => matchesTab(tab, p.status)),
    [plans, tab]
  );

  const ccLabel = (id: string) => {
    const cc = centers.find((c) => c.id === id);
    return cc ? `${cc.name} (${cc.code})` : id;
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "pending", label: `Pending Approval (${counts.pending})` },
    { id: "returned", label: `Returned (${counts.returned})` },
    { id: "approved", label: `Approved (${counts.approved})` },
    { id: "rejected", label: `Rejected (${counts.rejected})` },
  ];

  const emptyCopy: Record<Tab, string> = {
    pending: "No pending budgets",
    returned: "No returned budgets",
    approved: "No approved budgets",
    rejected: "No rejected budgets",
  };

  return (
    <PageShell>
      <PageHeader title="Approvals" />

      <div className="mb-4 flex flex-wrap gap-1 rounded-2xl border border-white/50 bg-white/40 p-1 text-meta shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-md">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              "rounded-xl px-2.5 py-1.5 transition",
              tab === t.id
                ? "bg-kengen-navy/90 font-medium text-white shadow-sm"
                : "text-neutral-700 hover:bg-white/50"
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 text-kengen-red">{error}</p> : null}
      {loading ? <SkeletonTable /> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState fill title={emptyCopy[tab]} />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="flex-1 overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <table className="w-full text-left text-body">
            <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">Cost Center</th>
                <th className="px-2 py-1.5">Owner</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Total</th>
                <th className="px-2 py-1.5">Last updated</th>
                <th className="px-2 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((plan) => {
                const total = plan.lines.reduce((s, l) => s + l.amount, 0);
                const awaitingMe =
                  tab === "pending" && myQueueIds.has(plan.id);
                return (
                  <tr key={plan.id} className="border-t border-neutral-400/20">
                    <td className="px-2 py-1.5">
                      {ccLabel(plan.costCenterId)}
                    </td>
                    <td className="px-2 py-1.5">
                      {names[plan.ownerId] ?? plan.ownerId}
                    </td>
                    <td className="px-2 py-1.5">{budgetCategoryLabel(plan.budgetCategory)}</td>
                    <td className="px-2 py-1.5">{formatCurrency(total)}</td>
                    <td className="px-2 py-1.5 text-meta">
                      {new Date(plan.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <ActionLink
                          href={`/budgets/${plan.id}`}
                          variant={awaitingMe ? "warning" : "secondary"}
                          icon={awaitingMe ? ClipboardCheck : Eye}
                          aria-label={
                            awaitingMe
                              ? "Review budget awaiting your approval"
                              : "View budget"
                          }
                        >
                          {awaitingMe ? "Review" : "View"}
                        </ActionLink>
                        {awaitingMe ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-kengen-amber">
                            Awaiting you
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </PageShell>
  );
}
