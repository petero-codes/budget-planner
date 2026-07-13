"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { budgetPlanService, getCurrentUser, repos } from "@/infrastructure/di";
import type { BudgetPlan, CostCenter } from "@/domain/entities";
import { formatCurrency } from "@/lib/utils";

export default function ReportsPage() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [status, setStatus] = useState("all");
  const [ccFilter, setCcFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const user = await getCurrentUser();
        setPlans(await budgetPlanService.listVisible(user));
        setCenters(await repos.costCenters.getAll());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load reports");
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (ccFilter !== "all" && p.costCenterId !== ccFilter) return false;
      return true;
    });
  }, [plans, status, ccFilter]);

  const ccName = (id: string) =>
    centers.find((c) => c.id === id)?.name ?? id;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Approved and in-flight budgets scoped to your visibility tree"
      />
      {error ? <p className="mb-3 text-kengen-red">{error}</p> : null}
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          className="rounded border border-neutral-400/40 px-2 py-1 text-body"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="Draft">Draft</option>
          <option value="InApproval">InApproval</option>
          <option value="Approved">Approved</option>
        </select>
        <select
          className="rounded border border-neutral-400/40 px-2 py-1 text-body"
          value={ccFilter}
          onChange={(e) => setCcFilter(e.target.value)}
        >
          <option value="all">All cost centers</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No budgets match filters" />
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <table className="w-full text-left text-body">
            <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">Cost Center</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">{ccName(p.costCenterId)}</td>
                  <td className="px-2 py-1.5">{p.budgetType}</td>
                  <td className="px-2 py-1.5">
                    <StatusChip status={p.status} />
                  </td>
                  <td className="px-2 py-1.5">
                    {formatCurrency(p.lines.reduce((s, l) => s + l.amount, 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
