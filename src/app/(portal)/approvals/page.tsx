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

export default function ApprovalsPage() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [glNames, setGlNames] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        setPlans(await budgetPlanService.listPendingApprovals(user));
        const users = await repos.users.getAll();
        setNames(Object.fromEntries(users.map((u) => [u.id, u.name])));
        const gls = await repos.glAccounts.getAll();
        setGlNames(
          Object.fromEntries(gls.map((g) => [g.id, `${g.code} ${g.description}`]))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load queue");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Budgets where you are the current approver (managerId walk)"
      />
      {error ? <p className="mb-3 text-kengen-red">{error}</p> : null}
      {loading ? <SkeletonTable /> : null}
      {!loading && plans.length === 0 ? (
        <EmptyState title="No pending approvals" description="Your queue is empty." />
      ) : null}
      {!loading && plans.length > 0 ? (
        <div className="space-y-2">
          {plans.map((plan) => {
            const total = plan.lines.reduce((s, l) => s + l.amount, 0);
            const open = expanded === plan.id;
            return (
              <div
                key={plan.id}
                className="rounded border border-neutral-400/30 bg-white"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-body hover:bg-neutral-100"
                  onClick={() => setExpanded(open ? null : plan.id)}
                >
                  <span>
                    <span className="font-medium">
                      {names[plan.ownerId] ?? plan.ownerId}
                    </span>
                    <span className="ml-2 text-meta text-neutral-700">
                      {plan.budgetType} · {formatCurrency(total)}
                    </span>
                  </span>
                  <StatusChip status={plan.status} />
                </button>
                {open ? (
                  <div className="border-t border-neutral-400/20 px-3 py-2">
                    <ul className="mb-2 space-y-1 text-meta">
                      {plan.lines.map((l) => (
                        <li key={l.id}>
                          {glNames[l.glAccountId] ?? l.glAccountId}:{" "}
                          {formatCurrency(l.amount)}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={`/budgets/${plan.id}`}
                      className="text-body text-kengen-blue hover:underline"
                    >
                      Open full review
                    </Link>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
