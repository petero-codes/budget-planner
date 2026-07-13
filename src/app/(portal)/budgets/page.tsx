"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { SkeletonTable } from "@/components/shared/skeleton-table";
import { budgetPlanService, getCurrentUser, repos } from "@/infrastructure/di";
import type { BudgetPlan } from "@/domain/entities";
import { formatCurrency } from "@/lib/utils";

export default function BudgetsPage() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        const list = await budgetPlanService.listMine(user);
        setPlans(list);
        const users = await repos.users.getAll();
        setNames(Object.fromEntries(users.map((u) => [u.id, u.name])));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="My Budget Plans"
        description="History of your submissions"
        actions={
          <Link
            href="/budgets/create"
            className="rounded bg-kengen-green px-3 py-1.5 text-body font-medium text-white"
          >
            Create Budget
          </Link>
        }
      />
      {error ? <p className="mb-3 text-kengen-red">{error}</p> : null}
      {loading ? <SkeletonTable /> : null}
      {!loading && plans.length === 0 ? (
        <EmptyState
          title="No budget plans yet"
          description="Create a draft to start the FY budgeting cycle."
        />
      ) : null}
      {!loading && plans.length > 0 ? (
        <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
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
                return (
                  <tr key={plan.id} className="border-t border-neutral-400/20">
                    <td className="px-2 py-1.5">{plan.budgetType}</td>
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
                      <Link
                        href={`/budgets/${plan.id}`}
                        className="text-kengen-blue hover:underline"
                      >
                        View
                      </Link>
                      {plan.status === "Draft" ? (
                        <>
                          {" · "}
                          <Link
                            href={`/budgets/create?edit=${plan.id}`}
                            className="text-kengen-blue hover:underline"
                          >
                            Edit
                          </Link>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
