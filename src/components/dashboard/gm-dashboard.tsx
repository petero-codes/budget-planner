"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { StatusChip } from "@/components/shared/status-chip";
import { ActionLink } from "@/components/ui/button";
import { apiGet } from "@/lib/client-api";
import type { ApprovalHistoryEntry, BudgetPlan } from "@/domain/entities";
import { cn, formatCurrency } from "@/lib/utils";

type DepartmentSummary = {
  departmentId: string;
  name: string;
  code: string;
  totalCostCenters: number;
  submitted: number;
  outstanding: number;
  completion: number;
  totalRequested: number;
  totalApproved: number;
};

type CostCenterRow = {
  costCenterId: string;
  code: string;
  name: string;
  responsiblePerson: string | null;
  managerName: string | null;
  status: string;
  glCount: number;
  totalRequested: number;
  totalApproved: number;
  lastUpdated: string | null;
  latestPlanId: string | null;
  currentApprover: string | null;
};

type CostCenterDetail = CostCenterRow & {
  departmentName: string;
  fiscalYearLabel: number | null;
  revisionCount: number;
  returnedCount: number;
  rejectedCount: number;
  submissionHistory: (ApprovalHistoryEntry & { performedByName: string })[];
  plans: BudgetPlan[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function GmDashboard() {
  const [overview, setOverview] = useState<{
    departments: DepartmentSummary[];
    fiscalYearLabel: number | null;
  } | null>(null);
  const [selectedDept, setSelectedDept] = useState<DepartmentSummary | null>(
    null
  );
  const [ccRows, setCcRows] = useState<CostCenterRow[]>([]);
  const [detail, setDetail] = useState<CostCenterDetail | null>(null);
  const [ccSearch, setCcSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingCc, setLoadingCc] = useState(false);

  const openDepartment = useCallback(async (dept: DepartmentSummary) => {
    setSelectedDept(dept);
    setDetail(null);
    setCcSearch("");
    setLoadingCc(true);
    try {
      const data = await apiGet<{
        departmentName: string;
        costCenters: CostCenterRow[];
      }>(`/api/v1/executive/departments/${dept.departmentId}`);
      setCcRows(data.costCenters);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cost centers");
    } finally {
      setLoadingCc(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<{
          departments: DepartmentSummary[];
          fiscalYearLabel: number | null;
        }>("/api/v1/executive/overview");
        setOverview(data);
        // Single-department org: open its cost centers immediately
        if (data.departments.length === 1) {
          void openDepartment(data.departments[0]!);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load overview");
      }
    })();
  }, [openDepartment]);

  const openCostCenter = useCallback(async (ccId: string) => {
    try {
      setDetail(
        await apiGet<CostCenterDetail>(`/api/v1/executive/cost-centers/${ccId}`)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load cost center");
    }
  }, []);

  const filteredCc = useMemo(() => {
    const term = ccSearch.trim().toLowerCase();
    if (!term) return ccRows;
    return ccRows.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        (c.responsiblePerson?.toLowerCase().includes(term) ?? false) ||
        c.status.toLowerCase().includes(term)
    );
  }, [ccRows, ccSearch]);

  if (error) return <p className="text-body text-kengen-red">{error}</p>;
  if (!overview) return <p className="text-meta">Loading executive overview…</p>;

  return (
    <div className="space-y-4">
      {/* Department cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overview.departments.map((d) => (
          <button
            key={d.departmentId}
            type="button"
            onClick={() => void openDepartment(d)}
            className={cn(
              "rounded-2xl border bg-white/80 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition hover:border-kengen-blue/50",
              selectedDept?.departmentId === d.departmentId
                ? "border-kengen-blue"
                : "border-white/50"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-kengen-navy">{d.name}</p>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                  d.outstanding > 0
                    ? "bg-red-50 text-kengen-red"
                    : "bg-emerald-50 text-kengen-green"
                )}
              >
                {d.completion}%
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-meta text-neutral-700">
              <span>
                CCs
                <br />
                <strong className="text-kengen-navy">
                  {d.totalCostCenters}
                </strong>
              </span>
              <span>
                Submitted
                <br />
                <strong className="text-kengen-navy">{d.submitted}</strong>
              </span>
              <span>
                Outstanding
                <br />
                <strong
                  className={
                    d.outstanding > 0 ? "text-kengen-red" : "text-kengen-navy"
                  }
                >
                  {d.outstanding}
                </strong>
              </span>
            </div>
            <div className="mt-2 space-y-0.5 text-meta text-neutral-700">
              <p>Requested: {formatCurrency(d.totalRequested)}</p>
              <p>Approved: {formatCurrency(d.totalApproved)}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Submission tracker */}
      <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
        <p className="border-b border-neutral-400/20 bg-neutral-100 px-3 py-2 text-meta font-medium uppercase text-neutral-700">
          Submission tracker
          {overview.fiscalYearLabel ? ` — FY ${overview.fiscalYearLabel}` : ""}
        </p>
        <table className="w-full text-left text-body">
          <thead className="sticky top-0 bg-neutral-100 text-meta uppercase text-neutral-700">
            <tr>
              <th className="px-2 py-1.5">Department</th>
              <th className="px-2 py-1.5">Submitted</th>
              <th className="px-2 py-1.5">Outstanding</th>
              <th className="px-2 py-1.5">Completion</th>
            </tr>
          </thead>
          <tbody>
            {overview.departments.map((d) => (
              <tr
                key={d.departmentId}
                className="cursor-pointer border-t border-neutral-400/20 hover:bg-neutral-50"
                onClick={() => void openDepartment(d)}
              >
                <td className="px-2 py-1.5">{d.name}</td>
                <td className="px-2 py-1.5">{d.submitted}</td>
                <td
                  className={cn(
                    "px-2 py-1.5 font-medium",
                    d.outstanding > 0 ? "text-kengen-red" : "text-kengen-green"
                  )}
                >
                  {d.outstanding}
                </td>
                <td className="px-2 py-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-meta font-semibold",
                      d.completion < 100
                        ? "bg-red-50 text-kengen-red"
                        : "bg-emerald-50 text-kengen-green"
                    )}
                  >
                    {d.completion}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Department drill-down */}
      {selectedDept ? (
        <div className="rounded border border-neutral-400/30 bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-kengen-navy">
              {selectedDept.name} — Cost Centers
            </p>
            <input
              className="glass-select w-full max-w-xs"
              placeholder="Search…"
              aria-label="Search cost centers"
              value={ccSearch}
              onChange={(e) => setCcSearch(e.target.value)}
            />
          </div>
          {loadingCc ? <p className="text-meta">Loading…</p> : null}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filteredCc.map((cc) => (
              <button
                key={cc.costCenterId}
                type="button"
                onClick={() => void openCostCenter(cc.costCenterId)}
                className={cn(
                  "rounded-xl border p-2.5 text-left transition hover:border-kengen-blue/60",
                  detail?.costCenterId === cc.costCenterId
                    ? "border-kengen-blue"
                    : "border-neutral-400/30"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-body font-medium text-kengen-navy">
                    {cc.name}
                  </p>
                  <StatusChip status={cc.status} />
                </div>
                <div className="mt-1.5 space-y-0.5 text-meta text-neutral-700">
                  <p>
                    Responsible:{" "}
                    <strong>{cc.responsiblePerson ?? "Unassigned"}</strong>
                  </p>
                  {cc.status !== "NotSubmitted" ? (
                    <>
                      <p>GLs submitted: {cc.glCount}</p>
                      <p>Requested: {formatCurrency(cc.totalRequested)}</p>
                      <p>Last updated: {fmtDate(cc.lastUpdated)}</p>
                      {cc.currentApprover ? (
                        <p>With: {cc.currentApprover}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="text-kengen-red">Pending submission</p>
                  )}
                </div>
              </button>
            ))}
            {!loadingCc && filteredCc.length === 0 ? (
              <p className="text-meta text-neutral-700">
                No cost centers match.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Cost center detail */}
      {detail ? (
        <div className="rounded border border-neutral-400/30 bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-kengen-navy">
              {detail.name} ({detail.code}) — {detail.departmentName}
            </p>
            {detail.latestPlanId ? (
              <ActionLink
                href={`/budgets/${detail.latestPlanId}`}
                variant="secondary"
                icon={Eye}
                size="default"
              >
                Open latest budget
              </ActionLink>
            ) : null}
          </div>
          <div className="mb-3 grid gap-2 text-body sm:grid-cols-2 lg:grid-cols-4">
            <p>
              <span className="text-meta text-neutral-700">Responsible</span>
              <br />
              {detail.responsiblePerson ?? "Unassigned"}
            </p>
            <p>
              <span className="text-meta text-neutral-700">Manager</span>
              <br />
              {detail.managerName ?? "—"}
            </p>
            <p>
              <span className="text-meta text-neutral-700">Financial year</span>
              <br />
              {detail.fiscalYearLabel ?? "—"}
            </p>
            <p>
              <span className="text-meta text-neutral-700">Status</span>
              <br />
              <StatusChip status={detail.status} />
            </p>
            <p>
              <span className="text-meta text-neutral-700">GLs</span>
              <br />
              {detail.glCount}
            </p>
            <p>
              <span className="text-meta text-neutral-700">Budget total</span>
              <br />
              {formatCurrency(detail.totalRequested)}
            </p>
            <p>
              <span className="text-meta text-neutral-700">Revisions</span>
              <br />
              {detail.revisionCount}
            </p>
            <p>
              <span className="text-meta text-neutral-700">
                Returned / Rejected
              </span>
              <br />
              <span
                className={detail.returnedCount > 0 ? "text-kengen-amber" : ""}
              >
                {detail.returnedCount}
              </span>{" "}
              /{" "}
              <span
                className={detail.rejectedCount > 0 ? "text-kengen-red" : ""}
              >
                {detail.rejectedCount}
              </span>
            </p>
          </div>
          <p className="mb-1 text-meta font-medium uppercase text-neutral-700">
            Submission history
          </p>
          {detail.submissionHistory.length === 0 ? (
            <p className="text-meta text-neutral-700">No history yet.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto text-body">
              {detail.submissionHistory.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center gap-2 border-b border-neutral-400/20 py-1"
                >
                  <span className="text-meta text-neutral-700">
                    {new Date(h.timestamp).toLocaleString()}
                  </span>
                  <span className="font-medium">{h.performedByName}</span>
                  <span>{h.action}</span>
                  <StatusChip status={h.newStatus} />
                  {h.comment ? (
                    <span className="text-meta text-neutral-700">
                      “{h.comment}”
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
