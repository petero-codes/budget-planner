"use client";

import { useEffect, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { SkeletonTable } from "@/components/shared/skeleton-table";
import { ActionLink } from "@/components/ui/button";
import { apiGet } from "@/lib/client-api";
import type { BudgetPlan, User } from "@/domain/entities";
import { budgetCategoryLabel } from "@/domain/constants/budget-types";
import { formatCurrency } from "@/lib/utils";

export default function BudgetsPage() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        setCanCreate(me.user.permissionCodes.includes("budget.create"));
        const list = await apiGet<BudgetPlan[]>("/api/v1/budget-plans");
        setPlans(list.filter((p) => p.ownerId === me.user.id));
        const ref = await apiGet<{ users: User[] }>("/api/v1/reference");
        setNames(Object.fromEntries(ref.users.map((u) => [u.id, u.name])));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="My Budgets"
        actions={
          canCreate ? (
            <ActionLink href="/budgets/create" variant="primary" icon={Plus}>
              Create Budget
            </ActionLink>
          ) : undefined
        }
      />

      {error ? <p className="mb-3 text-kengen-red">{error}</p> : null}
      {loading ? <SkeletonTable /> : null}

      {!loading && plans.length === 0 ? (
        <EmptyState fill title="No budgets found" />
      ) : null}

      {!loading && plans.length > 0 ? (
        <div className="flex-1 overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <table className="w-full text-left text-body">
            <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Submitted</th>
                <th className="px-2 py-1.5">Total</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Current Approver</th>
                <th className="px-2 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const total = plan.lines.reduce((s, l) => s + l.amount, 0);
                const editable =
                  plan.status === "Draft" ||
                  plan.status === "ReturnedForRevision";
                return (
                  <tr key={plan.id} className="border-t border-neutral-400/20">
                    <td className="px-2 py-1.5">{budgetCategoryLabel(plan.budgetCategory)}</td>
                    <td className="px-2 py-1.5 text-meta">
                      {plan.submittedAt
                        ? new Date(plan.submittedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5">{formatCurrency(total)}</td>
                    <td className="px-2 py-1.5">
                      <StatusChip status={plan.status} />
                    </td>
                    <td className="px-2 py-1.5 text-meta">
                      {plan.currentApproverId
                        ? names[plan.currentApproverId] ?? plan.currentApproverId
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        <ActionLink
                          href={`/budgets/${plan.id}`}
                          variant="secondary"
                          icon={Eye}
                          aria-label={`View ${budgetCategoryLabel(plan.budgetCategory)} budget`}
                        >
                          View
                        </ActionLink>
                        {editable ? (
                          <ActionLink
                            href={`/budgets/create?edit=${plan.id}`}
                            variant={
                              plan.status === "ReturnedForRevision"
                                ? "warning"
                                : "secondary"
                            }
                            icon={Pencil}
                            aria-label={`Edit ${budgetCategoryLabel(plan.budgetCategory)} budget`}
                          >
                            Edit
                          </ActionLink>
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
