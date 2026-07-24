"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Eye,
  FileText,
  Hand,
  LockOpen,
  RotateCcw,
  BadgeCheck,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { ActionLink, Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ApiError, apiGet, apiSend } from "@/lib/client-api";
import {
  type BudgetCategoryCode,
  type BudgetCategorySummary,
  type LegacyBudgetCategoryRow,
  BUDGET_CATEGORY_DISTRIBUTION_HEADING,
  LEGACY_BUDGET_CATEGORY_DISTRIBUTION_HEADING,
  budgetCategoryDistribution,
  budgetCategoryLabel,
  budgetCategoryAccentClasses,
} from "@/domain/constants/budget-types";
import type { FiscalYear, User } from "@/domain/entities";
import { formatCurrency } from "@/lib/utils";

type InboxRow = {
  planId: string;
  budgetNumber: string | null;
  budgetCategory: string;
  status: string;
  employee: string;
  department: string;
  costCenter: string;
  fiscalYear: number | null;
  glCount: number;
  amount: number;
  submissionDate: string | null;
  sapReference: string | null;
  claimDueAt: string | null;
  reviewDueAt: string | null;
  escalationStatus: string;
  financeClaimedBy: string | null;
  sapStatus: "Generated" | "Pending";
};

type Dash = {
  totals: {
    submitted: number;
    approved: number;
    rejected: number;
    returned: number;
    pending: number;
    draft: number;
    totalRequested: number;
    totalApproved: number;
    utilization: number;
  };
  byYear: Record<string, { count: number; amount: number }>;
  byCostCenter: Record<string, { count: number; amount: number }>;
  byBudgetCategory: BudgetCategorySummary;
  byLegacyBudgetCategory: LegacyBudgetCategoryRow[];
  years: FiscalYear[];
};

export default function FinanceDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlanId = searchParams?.get("planId") ?? null;
  const [data, setData] = useState<Dash | null>(null);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [returnTarget, setReturnTarget] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<
    BudgetCategoryCode | string | null
  >(null);

  async function reload() {
    // Best-effort: persist overdue escalations + notify Finance admins.
    try {
      await apiSend("/api/v1/finance/escalations", "POST");
    } catch {
      /* inbox still loads if escalation pass fails */
    }
    const [dash, rows] = await Promise.all([
      apiGet<Dash>("/api/v1/finance/dashboard"),
      apiGet<InboxRow[]>("/api/v1/finance/approved"),
    ]);
    setData(dash);
    setInbox(rows);
  }

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        if (!me.user.permissionCodes.includes("finance.view")) {
          router.replace("/access-denied");
          return;
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    let rows = inbox;
    if (selectedPlanId) {
      rows = rows.filter((row) => row.planId === selectedPlanId);
    }
    if (categoryFilter) {
      rows = rows.filter((r) => r.budgetCategory === categoryFilter);
    }
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        r.employee.toLowerCase().includes(term) ||
        r.department.toLowerCase().includes(term) ||
        r.costCenter.toLowerCase().includes(term) ||
        budgetCategoryLabel(r.budgetCategory).toLowerCase().includes(term) ||
        (r.budgetNumber?.toLowerCase().includes(term) ?? false) ||
        String(r.fiscalYear ?? "").includes(term) ||
        (r.sapReference?.toLowerCase().includes(term) ?? false) ||
        r.status.toLowerCase().includes(term)
    );
  }, [inbox, search, selectedPlanId, categoryFilter]);

  const waiting = filtered.filter((r) => r.status === "PendingFinanceReview");
  const claimed = filtered.filter((r) => r.status === "Claimed");
  const finalized = filtered.filter(
    (r) => r.status === "Finalized" || r.status === "Approved"
  );
  const overdue = filtered.filter(
    (r) =>
      (r.status === "PendingFinanceReview" || r.status === "Claimed") &&
      ((r.claimDueAt && new Date(r.claimDueAt) < new Date()) ||
        (r.reviewDueAt && new Date(r.reviewDueAt) < new Date()) ||
        r.escalationStatus === "Escalated")
  );

  async function claim(planId: string) {
    if (!window.confirm("Claim this budget for Finance review?")) {
      return;
    }
    setBusy(planId);
    setError(null);
    try {
      await apiSend(`/api/v1/budget-plans/${planId}/finance/claim`, "POST");
      setNotice("Budget claimed.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(null);
    }
  }

  async function finalize(planId: string) {
    if (
      !window.confirm(
        "Finalize this budget? This locks it and generates the SAP package."
      )
    ) {
      return;
    }
    setBusy(planId);
    setError(null);
    try {
      await apiSend(`/api/v1/budget-plans/${planId}/finance/finalize`, "POST");
      setNotice("Budget finalized. SAP package is ready.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Finalize failed");
    } finally {
      setBusy(null);
    }
  }

  async function release(planId: string) {
    setBusy(planId);
    setError(null);
    try {
      await apiSend(`/api/v1/budget-plans/${planId}/finance/release`, "POST");
      setNotice("Claim released. Budget is back in the queue.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Release failed");
    } finally {
      setBusy(null);
    }
  }

  async function returnPlan(planId: string) {
    if (!returnReason.trim()) {
      setError("Return reason is required");
      return;
    }
    setBusy(planId);
    setError(null);
    try {
      await apiSend(`/api/v1/budget-plans/${planId}/finance/return`, "POST", {
        reason: returnReason.trim(),
      });
      setReturnTarget(null);
      setReturnReason("");
      setNotice("Budget returned by Finance.");
      await reload();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Return failed"
      );
    } finally {
      setBusy(null);
    }
  }

  if (error && !data) return <p className="text-kengen-red">{error}</p>;
  if (!data) return <p className="text-meta">Loading finance dashboard…</p>;

  const cards = [
    { label: "Waiting", value: String(waiting.length) },
    { label: "Claimed", value: String(claimed.length) },
    { label: "Finalized", value: String(finalized.length) },
    { label: "Overdue", value: String(overdue.length) },
    {
      label: "Approved amount",
      value: formatCurrency(data.totals.totalApproved),
    },
  ];

  function renderActions(r: InboxRow) {
    if (r.status === "PendingFinanceReview") {
      return (
        <Button
          type="button"
          variant="primary"
          size="compact"
          icon={Hand}
          loading={busy === r.planId}
          disabled={busy === r.planId}
          onClick={() => void claim(r.planId)}
          aria-label={`Claim budget ${r.budgetNumber ?? r.planId}`}
        >
          Claim
        </Button>
      );
    }
    if (r.status === "Claimed") {
      return (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="success"
            size="compact"
            icon={BadgeCheck}
            loading={busy === r.planId}
            disabled={busy === r.planId}
            onClick={() => void finalize(r.planId)}
            aria-label="Finalize budget"
          >
            Finalize
          </Button>
          <Button
            type="button"
            variant="warning"
            size="compact"
            icon={RotateCcw}
            disabled={busy === r.planId}
            onClick={() => setReturnTarget(r.planId)}
            aria-label="Return for revision"
          >
            Return
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            icon={LockOpen}
            loading={busy === r.planId}
            disabled={busy === r.planId}
            onClick={() => void release(r.planId)}
            aria-label="Release claim"
          >
            Release
          </Button>
          <ActionLink
            href={`/budgets/${r.planId}`}
            variant="secondary"
            icon={Eye}
            aria-label="View budget"
          >
            View
          </ActionLink>
        </div>
      );
    }
    return (
      <ActionLink
        href={`/finance/sap/${r.planId}`}
        variant="secondary"
        icon={FileText}
        aria-label="Open SAP package"
      >
        SAP Package
      </ActionLink>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Finance Queue" actions={
          <ActionLink href="/reports" variant="secondary" icon={BarChart3}>
            Open reports
          </ActionLink>
        } />

      {error ? <p className="mb-2 text-kengen-red">{error}</p> : null}
      {notice ? (
        <p className="mb-2 rounded border border-kengen-green/40 bg-[rgba(0,105,62,0.08)] px-2 py-1.5 text-body text-kengen-green">
          {notice}
        </p>
      ) : null}

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-white/50 bg-white/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
          >
            <p className="text-meta text-neutral-700">{c.label}</p>
            <p className="text-base font-semibold text-kengen-navy">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium text-kengen-navy">
          {BUDGET_CATEGORY_DISTRIBUTION_HEADING}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={`rounded-2xl border px-3 py-3 text-left transition ${
              categoryFilter === null
                ? "border-kengen-blue bg-kengen-blue/10 ring-1 ring-kengen-blue/40"
                : "border-white/50 bg-white/70 hover:border-kengen-blue/30"
            }`}
          >
            <p className="text-meta font-semibold uppercase text-kengen-navy">
              All
            </p>
            <p className="mt-1 text-2xl font-semibold text-kengen-navy">
              {inbox.length}
            </p>
            <p className="text-meta text-neutral-700">All categories</p>
          </button>
          {budgetCategoryDistribution(data.byBudgetCategory).map((row) => {
            const active = categoryFilter === row.code;
            const accent = budgetCategoryAccentClasses(row.code);
            return (
              <button
                key={row.code}
                type="button"
                onClick={() =>
                  setCategoryFilter(active ? null : row.code)
                }
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  active
                    ? `ring-1 ${accent.ring} ${accent.border} ${accent.bg}`
                    : "border-white/50 bg-white/70 hover:border-kengen-blue/30"
                }`}
              >
                <p className={`text-meta font-semibold uppercase ${accent.text}`}>
                  {row.shortLabel}
                </p>
                <p className="mt-1 text-2xl font-semibold text-kengen-navy">
                  {row.count}
                </p>
                <p className="text-meta text-neutral-700">
                  {formatCurrency(row.amount)}
                  {row.percent > 0 ? ` · ${row.percent}%` : ""}
                </p>
              </button>
            );
          })}
        </div>
        {data.byLegacyBudgetCategory.length > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-meta font-medium text-neutral-700">
              {LEGACY_BUDGET_CATEGORY_DISTRIBUTION_HEADING}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.byLegacyBudgetCategory.map((row) => {
                const active = categoryFilter === row.code;
                return (
                  <button
                    key={row.code}
                    type="button"
                    onClick={() =>
                      setCategoryFilter(active ? null : row.code)
                    }
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-neutral-500 bg-neutral-100 ring-1 ring-neutral-400/40"
                        : "border-neutral-300/60 bg-neutral-50/80 hover:border-neutral-400/50"
                    }`}
                  >
                    <p className="text-meta font-semibold text-neutral-800">
                      {row.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-kengen-navy">
                      {row.count}
                    </p>
                    <p className="text-meta text-neutral-600">
                      {formatCurrency(row.amount)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <DataTable
        className="mb-4"
        title="Finance inbox"
        rows={filtered}
        rowKey={(r) => r.planId}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search inbox…"
        selectedRowKey={selectedPlanId}
        emptyTitle="No budgets found"
        emptyDescription="Try clearing search or the category filter."
        pageSize={12}
        columns={[
          {
            id: "budgetNumber",
            header: "Budget #",
            sortable: true,
            sortValue: (r) => r.budgetNumber ?? r.planId,
            cell: (r) => (
              <span className="font-medium">
                {r.budgetNumber ?? r.planId.slice(0, 8)}
              </span>
            ),
          },
          {
            id: "category",
            header: "Category",
            sortable: true,
            sortValue: (r) => budgetCategoryLabel(r.budgetCategory),
            cell: (r) => budgetCategoryLabel(r.budgetCategory),
          },
          {
            id: "status",
            header: "Status",
            sortable: true,
            sortValue: (r) => r.status,
            cell: (r) => <StatusChip status={r.status} />,
          },
          {
            id: "employee",
            header: "Employee",
            sortable: true,
            sortValue: (r) => r.employee,
            cell: (r) => r.employee,
          },
          {
            id: "costCenter",
            header: "Cost center",
            sortable: true,
            sortValue: (r) => r.costCenter,
            cell: (r) => r.costCenter,
          },
          {
            id: "amount",
            header: "Amount",
            sortable: true,
            sortValue: (r) => r.amount,
            className: "tabular-nums",
            cell: (r) => formatCurrency(r.amount),
          },
          {
            id: "sla",
            header: "SLA",
            cell: (r) => (
              <span className="text-meta">
                {r.escalationStatus !== "None" ? (
                  <span className="text-kengen-amber">{r.escalationStatus}</span>
                ) : r.claimDueAt ? (
                  `Claim due ${new Date(r.claimDueAt).toLocaleDateString()}`
                ) : (
                  "—"
                )}
              </span>
            ),
          },
        ]}
        actions={(r) => renderActions(r)}
      />

      {returnTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <p className="mb-2 font-medium text-kengen-navy">
              Return for revision
            </p>
            <textarea
              className="mb-3 w-full rounded border p-2 text-body"
              rows={3}
              placeholder="Reason"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setReturnTarget(null);
                  setReturnReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="warning"
                icon={RotateCcw}
                onClick={() => void returnPlan(returnTarget)}
              >
                Return
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
