"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import {
  approvalService,
  budgetPlanService,
  getCurrentUser,
  repos,
} from "@/infrastructure/di";
import type { BudgetPlan, GlAccount, User } from "@/domain/entities";
import { formatCurrency } from "@/lib/utils";
import { buildSapCsv } from "@/infrastructure/export/sap-csv-writer";
import { IDS } from "@/infrastructure/repositories/mock/seed";

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [glMap, setGlMap] = useState<Map<string, GlAccount>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const current = await getCurrentUser();
    setUser(current);
    try {
      const p = await budgetPlanService.getById(id, current);
      setPlan(p);
      const gls = await repos.glAccounts.getAll();
      setGlMap(new Map(gls.map((g) => [g.id, g])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Access denied");
      if (String(e).includes("access")) {
        router.push("/access-denied");
      }
    }
  }

  useEffect(() => {
    void reload();
  }, [id]);

  async function onApprove() {
    if (!user || !plan) return;
    setBusy(true);
    try {
      await approvalService.approve(plan.id, user);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!user || !plan) return;
    if (!rejectComment.trim()) {
      setError("Rejection reason is required");
      return;
    }
    setBusy(true);
    try {
      await approvalService.reject(plan.id, user, rejectComment);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    if (!plan) return;
    void (async () => {
      const cc = await repos.costCenters.getById(plan.costCenterId);
      const fy = await repos.fiscalYears.getById(plan.fiscalYearId);
      if (!cc || !fy) return;
      const csv = buildSapCsv(plan, cc, glMap, fy.yearLabel);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sap-budget-${cc.code}-${fy.yearLabel}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    })();
  }

  if (!plan || !user) {
    return <p className="text-meta text-neutral-700">{error ?? "Loading…"}</p>;
  }

  const total = plan.lines.reduce((s, l) => s + l.amount, 0);
  const canApprove =
    plan.status === "InApproval" &&
    plan.currentApproverId === user.id &&
    user.permissionCodes.includes("budget.approve");

  return (
    <div>
      <PageHeader
        title="Budget Review"
        description={`${plan.budgetType} · ${plan.id}`}
        actions={
          <div className="flex gap-2">
            {plan.status === "Draft" && plan.ownerId === user.id ? (
              <Link
                href={`/budgets/create?edit=${plan.id}`}
                className="rounded border px-3 py-1.5 text-body"
              >
                Edit Draft
              </Link>
            ) : null}
            {plan.status === "Approved" ? (
              <button
                type="button"
                onClick={downloadCsv}
                className="rounded bg-kengen-navy px-3 py-1.5 text-body text-white"
              >
                Export SAP CSV
              </button>
            ) : null}
          </div>
        }
      />
      {error ? (
        <div className="mb-3 rounded border border-kengen-red/40 bg-red-50 px-3 py-2 text-body text-kengen-red">
          {error}
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap gap-3 text-body">
        <StatusChip status={plan.status} />
        <span>Total: {formatCurrency(total)}</span>
        <span className="text-meta text-neutral-700">
          Cost center: {plan.costCenterId}
        </span>
      </div>
      <div className="mb-4 overflow-x-auto rounded border border-neutral-400/30 bg-white">
        <table className="w-full text-left text-body">
          <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Cost Element</th>
              <th className="px-2 py-1.5">Description</th>
              <th className="px-2 py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {plan.lines.map((line) => {
              const gl = glMap.get(line.glAccountId);
              return (
                <tr key={line.id} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">{line.lineNumber}</td>
                  <td className="px-2 py-1.5">{gl?.code ?? "—"}</td>
                  <td className="px-2 py-1.5">{gl?.description ?? "—"}</td>
                  <td className="px-2 py-1.5">{formatCurrency(line.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canApprove ? (
        <div className="rounded border border-neutral-400/30 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-kengen-navy">
            Your decision
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onApprove()}
              className="rounded bg-kengen-green px-3 py-1.5 text-body text-white disabled:opacity-50"
            >
              Approve
            </button>
          </div>
          <label className="mt-3 block text-meta">
            Reason for rejection (required to reject)
            <textarea
              className="mt-1 w-full rounded border border-neutral-400/40 px-2 py-1.5 text-body"
              rows={3}
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onReject()}
            className="mt-2 rounded bg-kengen-red px-3 py-1.5 text-body text-white disabled:opacity-50"
          >
            Reject / Return
          </button>
        </div>
      ) : null}
      {plan.ownerId === user.id && plan.status === "Draft" && plan.costCenterId === IDS.ccGm ? null : null}
    </div>
  );
}
