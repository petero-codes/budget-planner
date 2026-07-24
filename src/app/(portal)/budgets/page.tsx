"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { ActionLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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

  const rows = useMemo(
    () =>
      plans.map((plan) => ({
        plan,
        total: plan.lines.reduce((s, l) => s + l.amount, 0),
        editable:
          plan.status === "Draft" || plan.status === "ReturnedForRevision",
      })),
    [plans]
  );

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

      <DataTable
        className="flex-1"
        title="Budgets"
        loading={loading}
        rows={rows}
        rowKey={(r) => r.plan.id}
        searchFilter={(r, term) => {
          const p = r.plan;
          return (
            budgetCategoryLabel(p.budgetCategory).toLowerCase().includes(term) ||
            p.status.toLowerCase().includes(term) ||
            (p.currentApproverId
              ? (names[p.currentApproverId] ?? p.currentApproverId)
                  .toLowerCase()
                  .includes(term)
              : false) ||
            formatCurrency(r.total).toLowerCase().includes(term)
          );
        }}
        searchPlaceholder="Search my budgets…"
        emptyTitle="No budgets found"
        emptyDescription="Create a budget to get started."
        pageSize={12}
        columns={[
          {
            id: "type",
            header: "Type",
            sortable: true,
            sortValue: (r) => budgetCategoryLabel(r.plan.budgetCategory),
            cell: (r) => budgetCategoryLabel(r.plan.budgetCategory),
          },
          {
            id: "submitted",
            header: "Submitted",
            sortable: true,
            sortValue: (r) => r.plan.submittedAt ?? "",
            className: "text-meta",
            cell: (r) =>
              r.plan.submittedAt
                ? new Date(r.plan.submittedAt).toLocaleString()
                : "—",
          },
          {
            id: "total",
            header: "Total",
            sortable: true,
            sortValue: (r) => r.total,
            className: "tabular-nums",
            cell: (r) => formatCurrency(r.total),
          },
          {
            id: "status",
            header: "Status",
            sortable: true,
            sortValue: (r) => r.plan.status,
            cell: (r) => <StatusChip status={r.plan.status} />,
          },
          {
            id: "approver",
            header: "Current Approver",
            sortable: true,
            sortValue: (r) =>
              r.plan.currentApproverId
                ? names[r.plan.currentApproverId] ?? r.plan.currentApproverId
                : "",
            className: "text-meta",
            cell: (r) =>
              r.plan.currentApproverId
                ? names[r.plan.currentApproverId] ?? r.plan.currentApproverId
                : "—",
          },
        ]}
        actions={(r) => (
          <div className="flex flex-wrap gap-1.5">
            <ActionLink
              href={`/budgets/${r.plan.id}`}
              variant="secondary"
              icon={Eye}
              aria-label={`View ${budgetCategoryLabel(r.plan.budgetCategory)} budget`}
            >
              View
            </ActionLink>
            {r.editable ? (
              <ActionLink
                href={`/budgets/create?edit=${r.plan.id}`}
                variant={
                  r.plan.status === "ReturnedForRevision"
                    ? "warning"
                    : "secondary"
                }
                icon={Pencil}
                aria-label={`Edit ${budgetCategoryLabel(r.plan.budgetCategory)} budget`}
              >
                Edit
              </ActionLink>
            ) : null}
          </div>
        )}
      />
    </PageShell>
  );
}
