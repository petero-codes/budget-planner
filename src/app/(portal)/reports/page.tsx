"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { GlassSelect } from "@/components/ui/glass-select";
import { apiGet } from "@/lib/client-api";
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
  | "department"
  | "costCenter"
  | "gl"
  | "turnaround";

const VIEW_OPTIONS: { value: ReportView; label: string }[] = [
  { value: "detail", label: "Budget detail" },
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
      return true;
    });
  }, [plans, status, ccFilter, fyFilter]);

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

  const deptName = (ccId: string) => {
    const cc = centers.find((c) => c.id === ccId);
    return departments.find((d) => d.id === cc?.departmentId)?.name ?? "Unknown";
  };

  const grouped = useMemo(() => {
    if (view !== "department" && view !== "costCenter" && view !== "gl") {
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
    if (view === "department" || view === "costCenter" || view === "gl") {
      downloadCsv(`budget-by-${view}.csv`, [
        [
          view === "department"
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
      ["Financial Year", "Department", "Cost Center", "Type", "Status", "Total"],
      ...filtered.map((p) => [
        String(yearLabel(p.fiscalYearId)),
        deptName(p.costCenterId),
        ccName(p.costCenterId),
        p.budgetType,
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

      {filtered.length === 0 ? (
        <EmptyState fill title="No budgets found" />
      ) : view === "department" || view === "costCenter" || view === "gl" ? (
        <div className="flex-1 overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <table className="w-full text-left text-body">
            <thead className="sticky top-0 bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">
                  {view === "department"
                    ? "Department"
                    : view === "costCenter"
                      ? "Cost Center"
                      : "GL Account"}
                </th>
                <th className="px-2 py-1.5">
                  {view === "gl" ? "Lines" : "Budgets"}
                </th>
                <th className="px-2 py-1.5">Requested</th>
                <th className="px-2 py-1.5">Approved</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <tr key={g.key} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">{g.key}</td>
                  <td className="px-2 py-1.5">{g.count}</td>
                  <td className="px-2 py-1.5">{formatCurrency(g.requested)}</td>
                  <td className="px-2 py-1.5">{formatCurrency(g.approved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "turnaround" ? (
        <div className="flex-1 overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <p className="border-b border-neutral-400/20 px-3 py-2 text-body">
            Average turnaround (submission → final approval):{" "}
            <strong>{turnaround.avg} days</strong> over {turnaround.rows.length}{" "}
            approved budget(s)
          </p>
          <table className="w-full text-left text-body">
            <thead className="sticky top-0 bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">Cost Center</th>
                <th className="px-2 py-1.5">FY</th>
                <th className="px-2 py-1.5">Submitted</th>
                <th className="px-2 py-1.5">Approved</th>
                <th className="px-2 py-1.5">Days</th>
              </tr>
            </thead>
            <tbody>
              {turnaround.rows.map((r) => (
                <tr key={r.plan.id} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">{ccName(r.plan.costCenterId)}</td>
                  <td className="px-2 py-1.5">
                    {yearLabel(r.plan.fiscalYearId)}
                  </td>
                  <td className="px-2 py-1.5">
                    {r.plan.submittedAt
                      ? new Date(r.plan.submittedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="px-2 py-1.5">
                    {new Date(r.plan.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-2 py-1.5">{r.days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto rounded border border-neutral-400/30 bg-white">
          <table className="w-full text-left text-body">
            <thead className="sticky top-0 bg-neutral-100 text-meta uppercase text-neutral-700">
              <tr>
                <th className="px-2 py-1.5">FY</th>
                <th className="px-2 py-1.5">Department</th>
                <th className="px-2 py-1.5">Cost Center</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Status</th>
                <th className="px-2 py-1.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">{yearLabel(p.fiscalYearId)}</td>
                  <td className="px-2 py-1.5">{deptName(p.costCenterId)}</td>
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
      </>
      ) : null}
    </PageShell>
  );
}
