"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { GlassSelect } from "@/components/ui/glass-select";
import { apiGet } from "@/lib/client-api";
import {
  BUDGET_CATEGORY_COLUMN_LABEL,
  BUDGET_CATEGORY_DISTRIBUTION_TITLE,
  budgetCategoryDistribution,
  budgetCategoryLabel,
  budgetCategoryFilterOptions,
  emptyBudgetCategorySummary,
  addToBudgetCategorySummary,
  addToLegacyBudgetCategorySummary,
  emptyLegacyBudgetCategorySummary,
  legacyBudgetCategoryDistribution,
  LEGACY_BUDGET_CATEGORY_DISTRIBUTION_HEADING,
} from "@/domain/constants/budget-types";
import type {
  BudgetPlan,
  CostCenter,
  Department,
  FiscalYear,
  GlAccount,
  User,
} from "@/domain/entities";
import { formatCurrency } from "@/lib/utils";

type ReportView =
  | "detail"
  | "budgetCategory"
  | "department"
  | "costCenter"
  | "gl"
  | "turnaround";

const VIEW_OPTIONS: { value: ReportView; label: string }[] = [
  { value: "detail", label: "Budget detail" },
  { value: "budgetCategory", label: "Budget by category" },
  { value: "department", label: "Budget by department" },
  { value: "costCenter", label: "Budget by cost center" },
  { value: "gl", label: "Budget by GL" },
  { value: "turnaround", label: "Approval turnaround" },
];

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [years, setYears] = useState<FiscalYear[]>([]);
  const [canExport, setCanExport] = useState(false);
  const [view, setView] = useState<ReportView>("detail");
  const [status, setStatus] = useState("all");
  const [ccFilter, setCcFilter] = useState("all");
  const [fyFilter, setFyFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        if (!me.user.permissionCodes.includes("report.view")) {
          router.replace("/access-denied");
          return;
        }
        setCanExport(me.user.permissionCodes.includes("report.export"));
        setPlans(await apiGet<BudgetPlan[]>("/api/v1/reports/budgets"));
        const ref = await apiGet<{
          costCenters: CostCenter[];
          fiscalYears: FiscalYear[];
          departments: Department[];
          glAccounts: GlAccount[];
        }>("/api/v1/reference");
        setCenters(ref.costCenters);
        setYears(ref.fiscalYears);
        setDepartments(ref.departments ?? []);
        setGlAccounts(ref.glAccounts ?? []);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load reports");
      }
    })();
  }, [router]);

  const filtered = useMemo(() => {
    return plans.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (ccFilter !== "all" && p.costCenterId !== ccFilter) return false;
      if (fyFilter !== "all" && p.fiscalYearId !== fyFilter) return false;
      if (typeFilter !== "all" && p.budgetCategory !== typeFilter) return false;
      return true;
    });
  }, [plans, status, ccFilter, fyFilter, typeFilter]);

  const yearLabel = (id: string) =>
    years.find((y) => y.id === id)?.yearLabel ?? id;
  const ccName = (id: string) =>
    centers.find((c) => c.id === id)?.name ?? id;

  const totalsByYear = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of filtered) {
      const y = years.find((fy) => fy.id === p.fiscalYearId)?.yearLabel ?? 0;
      const amt = p.lines.reduce((s, l) => s + l.amount, 0);
      map.set(y, (map.get(y) ?? 0) + amt);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [filtered, years]);

  const totalsByType = useMemo(() => {
    const summary = emptyBudgetCategorySummary();
    const legacySummary = emptyLegacyBudgetCategorySummary();
    for (const p of filtered) {
      const amt = p.lines.reduce((s, l) => s + l.amount, 0);
      addToBudgetCategorySummary(summary, p.budgetCategory, amt);
      addToLegacyBudgetCategorySummary(legacySummary, p.budgetCategory, amt);
    }
    return {
      catalog: budgetCategoryDistribution(summary),
      legacy: legacyBudgetCategoryDistribution(legacySummary),
    };
  }, [filtered]);

  const deptName = (ccId: string) => {
    const cc = centers.find((c) => c.id === ccId);
    return departments.find((d) => d.id === cc?.departmentId)?.name ?? "Unknown";
  };

  const grouped = useMemo(() => {
    if (
      view !== "budgetCategory" &&
      view !== "department" &&
      view !== "costCenter" &&
      view !== "gl"
    ) {
      return [];
    }
    const map = new Map<
      string,
      { key: string; count: number; requested: number; approved: number }
    >();
    const add = (key: string, amount: number, isApproved: boolean) => {
      const row = map.get(key) ?? { key, count: 0, requested: 0, approved: 0 };
      row.count += 1;
      row.requested += amount;
      if (isApproved) row.approved += amount;
      map.set(key, row);
    };
    for (const p of filtered) {
      const isApproved =
          p.status === "Approved" || p.status === "Finalized";
      if (view === "gl") {
        for (const l of p.lines) {
          const gl = glAccounts.find((g) => g.id === l.glAccountId);
          add(
            gl ? `${gl.code} — ${gl.description}` : l.glAccountId,
            l.amount,
            isApproved
          );
        }
      } else if (view === "budgetCategory") {
        const amt = p.lines.reduce((s, l) => s + l.amount, 0);
        add(budgetCategoryLabel(p.budgetCategory), amt, isApproved);
      } else {
        const amt = p.lines.reduce((s, l) => s + l.amount, 0);
        const key =
          view === "department" ? deptName(p.costCenterId) : ccName(p.costCenterId);
        add(key, amt, isApproved);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.requested - a.requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, view, centers, departments, glAccounts]);

  const turnaround = useMemo(() => {
    if (view !== "turnaround") return { rows: [] as { plan: BudgetPlan; days: number }[], avg: 0 };
    const rows = filtered
      .filter(
        (p) =>
          (p.status === "Approved" || p.status === "Finalized") && p.submittedAt
      )
      .map((p) => ({
        plan: p,
        days:
          Math.round(
            ((new Date(p.updatedAt).getTime() -
              new Date(p.submittedAt!).getTime()) /
              86400000) *
              10
          ) / 10,
      }))
      .sort((a, b) => b.days - a.days);
    const avg =
      rows.length > 0
        ? Math.round((rows.reduce((s, r) => s + r.days, 0) / rows.length) * 10) / 10
        : 0;
    return { rows, avg };
  }, [filtered, view]);

  function exportExcelCsv() {
    if (
      view === "budgetCategory" ||
      view === "department" ||
      view === "costCenter" ||
      view === "gl"
    ) {
      downloadCsv(`budget-by-${view}.csv`, [
        [
          view === "budgetCategory"
            ? BUDGET_CATEGORY_COLUMN_LABEL
            : view === "department"
              ? "Department"
              : view === "costCenter"
                ? "Cost Center"
                : "GL Account",
          view === "gl" ? "Lines" : "Budgets",
          "Requested",
          "Approved",
        ],
        ...grouped.map((g) => [
          g.key,
          String(g.count),
          String(g.requested),
          String(g.approved),
        ]),
      ]);
      return;
    }
    if (view === "turnaround") {
      downloadCsv("approval-turnaround.csv", [
        ["Cost Center", "FY", "Submitted", "Decided", "Days"],
        ...turnaround.rows.map((r) => [
          ccName(r.plan.costCenterId),
          String(yearLabel(r.plan.fiscalYearId)),
          r.plan.submittedAt ?? "",
          r.plan.updatedAt,
          String(r.days),
        ]),
      ]);
      return;
    }
    downloadCsv("budget-report.csv", [
      [
        "Financial Year",
        "Department",
        "Cost Center",
        BUDGET_CATEGORY_COLUMN_LABEL,
        "Status",
        "Total",
      ],
      ...filtered.map((p) => [
        String(yearLabel(p.fiscalYearId)),
        deptName(p.costCenterId),
        ccName(p.costCenterId),
        budgetCategoryLabel(p.budgetCategory),
        p.status,
        String(p.lines.reduce((s, l) => s + l.amount, 0)),
      ]),
    ]);
  }

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        actions={
          canExport ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                icon={Download}
                onClick={exportExcelCsv}
                disabled={filtered.length === 0}
              >
                Export CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={Printer}
                onClick={() => window.print()}
              >
                Print
              </Button>
            </div>
          ) : null
        }
      />
      {error ? <p className="mb-3 text-kengen-red">{error}</p> : null}
      {!ready && !error ? (
        <p className="text-meta text-neutral-700">Loading reports…</p>
      ) : null}
      {ready ? (
      <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap print:hidden">
        <GlassSelect
          aria-label="Report view"
          className="w-full sm:w-56"
          value={view}
          onChange={(v) => setView(v as ReportView)}
          options={VIEW_OPTIONS}
        />
        <GlassSelect
          aria-label="Filter by financial year"
          className="w-full sm:w-44"
          value={fyFilter}
          onChange={setFyFilter}
          options={[
            { value: "all", label: "All years" },
            ...years.map((y) => ({
              value: y.id,
              label:
                y.status === "Open"
                  ? String(y.yearLabel)
                  : `${y.yearLabel} (${y.status})`,
            })),
          ]}
        />
        <GlassSelect
          aria-label="Filter by status"
          className="w-full sm:w-44"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All statuses" },
            { value: "Draft", label: "Draft" },
            { value: "InApproval", label: "Pending Approval" },
            { value: "ReturnedForRevision", label: "Returned for Revision" },
            { value: "Approved", label: "Approved" },
            { value: "Rejected", label: "Rejected" },
          ]}
        />
        <GlassSelect
          aria-label="Filter by budget category"
          className="w-full sm:w-44"
          value={typeFilter}
          onChange={setTypeFilter}
          options={budgetCategoryFilterOptions()}
        />
        <GlassSelect
          aria-label="Filter by cost center"
          className="w-full sm:min-w-[14rem] sm:flex-1 sm:max-w-md"
          value={ccFilter}
          onChange={setCcFilter}
          options={[
            { value: "all", label: "All cost centers" },
            ...centers.map((c) => ({
              value: c.id,
              label: `${c.code} — ${c.name}`,
            })),
          ]}
        />
      </div>

      {totalsByYear.length > 0 ? (
        <div className="mb-3 rounded border border-neutral-400/30 bg-white p-3">
          <p className="mb-1 text-sm font-medium text-kengen-navy">
            Total budget by year
          </p>
          <ul className="flex flex-wrap gap-3 text-body">
            {totalsByYear.map(([y, amt]) => (
              <li key={y}>
                FY {y}: <strong>{formatCurrency(amt)}</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {totalsByType.catalog.some((t) => t.count > 0) ? (
        <div className="mb-3 rounded border border-neutral-400/30 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-kengen-navy">
            {BUDGET_CATEGORY_DISTRIBUTION_TITLE}
          </p>
          <ul className="space-y-1 text-body">
            {totalsByType.catalog.map((row) => (
              <li key={row.code} className="flex items-baseline gap-2">
                <span className="min-w-[10rem] font-medium">{row.label}</span>
                <span className="flex-1 border-b border-dotted border-neutral-300" />
                <span className="tabular-nums text-neutral-700">
                  {row.percent}%
                </span>
                <span className="min-w-[7rem] text-right tabular-nums">
                  {formatCurrency(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {totalsByType.legacy.length > 0 ? (
        <div className="mb-3 rounded border border-neutral-300/50 bg-neutral-50 p-3">
          <p className="mb-2 text-sm font-medium text-neutral-800">
            {LEGACY_BUDGET_CATEGORY_DISTRIBUTION_HEADING}
          </p>
          <ul className="space-y-1 text-body">
            {totalsByType.legacy.map((row) => (
              <li key={row.code} className="flex items-baseline gap-2">
                <span className="min-w-[10rem] font-medium">{row.label}</span>
                <span className="flex-1 border-b border-dotted border-neutral-300" />
                <span className="min-w-[7rem] text-right tabular-nums">
                  {formatCurrency(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          fill
          title="No budgets found"
          description="Adjust filters to see report rows."
        />
      ) : view === "budgetCategory" ||
        view === "department" ||
        view === "costCenter" ||
        view === "gl" ? (
        <DataTable
          className="flex-1"
          title={
            view === "budgetCategory"
              ? "By category"
              : view === "department"
                ? "By department"
                : view === "costCenter"
                  ? "By cost center"
                  : "By GL"
          }
          rows={grouped}
          rowKey={(g) => g.key}
          pageSize={15}
          searchFilter={(g, term) => g.key.toLowerCase().includes(term)}
          searchPlaceholder="Search groups…"
          emptyTitle="No groups found"
          columns={[
            {
              id: "key",
              header:
                view === "budgetCategory"
                  ? BUDGET_CATEGORY_COLUMN_LABEL
                  : view === "department"
                    ? "Department"
                    : view === "costCenter"
                      ? "Cost Center"
                      : "GL Account",
              sortable: true,
              sortValue: (g) => g.key,
              cell: (g) => g.key,
            },
            {
              id: "count",
              header: view === "gl" ? "Lines" : "Budgets",
              sortable: true,
              sortValue: (g) => g.count,
              className: "tabular-nums",
              cell: (g) => g.count,
            },
            {
              id: "requested",
              header: "Requested",
              sortable: true,
              sortValue: (g) => g.requested,
              className: "tabular-nums",
              cell: (g) => formatCurrency(g.requested),
            },
            {
              id: "approved",
              header: "Approved",
              sortable: true,
              sortValue: (g) => g.approved,
              className: "tabular-nums",
              cell: (g) => formatCurrency(g.approved),
            },
          ]}
        />
      ) : view === "turnaround" ? (
        <div className="flex flex-1 flex-col gap-0">
          <p className="rounded-t border border-b-0 border-neutral-400/30 bg-white px-3 py-2 text-body">
            Average turnaround (submission → final approval):{" "}
            <strong>{turnaround.avg} days</strong> over {turnaround.rows.length}{" "}
            approved budget(s)
          </p>
          <DataTable
            className="flex-1 !rounded-t-none"
            title="Turnaround"
            rows={turnaround.rows}
            rowKey={(r) => r.plan.id}
            pageSize={15}
            searchFilter={(r, term) =>
              ccName(r.plan.costCenterId).toLowerCase().includes(term) ||
              String(yearLabel(r.plan.fiscalYearId)).includes(term)
            }
            searchPlaceholder="Search turnaround…"
            emptyTitle="No turnaround data"
            columns={[
              {
                id: "cc",
                header: "Cost Center",
                sortable: true,
                sortValue: (r) => ccName(r.plan.costCenterId),
                cell: (r) => ccName(r.plan.costCenterId),
              },
              {
                id: "fy",
                header: "FY",
                sortable: true,
                sortValue: (r) => yearLabel(r.plan.fiscalYearId),
                cell: (r) => yearLabel(r.plan.fiscalYearId),
              },
              {
                id: "submitted",
                header: "Submitted",
                sortable: true,
                sortValue: (r) => r.plan.submittedAt ?? "",
                cell: (r) =>
                  r.plan.submittedAt
                    ? new Date(r.plan.submittedAt).toLocaleDateString()
                    : "—",
              },
              {
                id: "approved",
                header: "Approved",
                sortable: true,
                sortValue: (r) => r.plan.updatedAt,
                cell: (r) => new Date(r.plan.updatedAt).toLocaleDateString(),
              },
              {
                id: "days",
                header: "Days",
                sortable: true,
                sortValue: (r) => r.days,
                className: "tabular-nums",
                cell: (r) => r.days,
              },
            ]}
          />
        </div>
      ) : (
        <DataTable
          className="flex-1"
          title="Budget detail"
          rows={filtered}
          rowKey={(p) => p.id}
          pageSize={15}
          searchFilter={(p, term) =>
            deptName(p.costCenterId).toLowerCase().includes(term) ||
            ccName(p.costCenterId).toLowerCase().includes(term) ||
            budgetCategoryLabel(p.budgetCategory).toLowerCase().includes(term) ||
            p.status.toLowerCase().includes(term) ||
            String(yearLabel(p.fiscalYearId)).includes(term)
          }
          searchPlaceholder="Search detail rows…"
          emptyTitle="No budgets found"
          columns={[
            {
              id: "fy",
              header: "FY",
              sortable: true,
              sortValue: (p) => yearLabel(p.fiscalYearId),
              cell: (p) => yearLabel(p.fiscalYearId),
            },
            {
              id: "dept",
              header: "Department",
              sortable: true,
              sortValue: (p) => deptName(p.costCenterId),
              cell: (p) => deptName(p.costCenterId),
            },
            {
              id: "cc",
              header: "Cost Center",
              sortable: true,
              sortValue: (p) => ccName(p.costCenterId),
              cell: (p) => ccName(p.costCenterId),
            },
            {
              id: "category",
              header: BUDGET_CATEGORY_COLUMN_LABEL,
              sortable: true,
              sortValue: (p) => budgetCategoryLabel(p.budgetCategory),
              cell: (p) => budgetCategoryLabel(p.budgetCategory),
            },
            {
              id: "status",
              header: "Status",
              sortable: true,
              sortValue: (p) => p.status,
              cell: (p) => <StatusChip status={p.status} />,
            },
            {
              id: "total",
              header: "Total",
              sortable: true,
              sortValue: (p) => p.lines.reduce((s, l) => s + l.amount, 0),
              className: "tabular-nums",
              cell: (p) =>
                formatCurrency(p.lines.reduce((s, l) => s + l.amount, 0)),
            },
          ]}
        />
      )}
      </>
      ) : null}
    </PageShell>
  );
}
