"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Eye,
  ListChecks,
  Pencil,
  Plus,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { GmDashboard } from "@/components/dashboard/gm-dashboard";
import { ActionLink } from "@/components/ui/button";
import { apiGet } from "@/lib/client-api";
import type { BudgetPlan, User } from "@/domain/entities";
import { formatCurrency } from "@/lib/utils";

type StatusCounts = {
  pending: number;
  returned: number;
  approved: number;
  rejected: number;
  draft: number;
  total: number;
  totalRequested: number;
  totalApproved: number;
  approvalRate: number;
};

type CostCenterSummary = StatusCounts & {
  costCenterId: string;
  code: string;
  name: string;
};

type PlanOutcome = {
  action: "Returned" | "Rejected";
  reason: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
};

type Dash = {
  orgRole: "employee" | "manager" | "gm" | "finance" | "systemAdmin";
  canExport: boolean;
  summaries: CostCenterSummary[];
  totals: StatusCounts;
  byDepartment: Record<string, StatusCounts>;
  byYear: Record<string, StatusCounts>;
  byManager: Record<string, StatusCounts>;
  plans: BudgetPlan[];
  planOutcomes: Record<string, PlanOutcome>;
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dash, setDash] = useState<Dash | null>(null);
  const [pending, setPending] = useState<BudgetPlan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        const current = me.user;
        setUser(current);

        if (current.roleCodes.includes("SystemAdmin")) {
          router.replace("/admin");
          return;
        }
        if (current.roleCodes.includes("FinanceAdministrator")) {
          router.replace("/finance");
          return;
        }

        const data = await apiGet<Dash>("/api/v1/dashboard");
        setDash(data);

        if (current.permissionCodes.includes("budget.approve")) {
          setPending(await apiGet<BudgetPlan[]>("/api/v1/approvals/pending"));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [router]);

  const filteredPlans = useMemo(() => {
    if (!dash) return [];
    const term = q.trim().toLowerCase();
    if (!term) return dash.plans;
    return dash.plans.filter((p) => {
      const cc = dash.summaries.find((s) => s.costCenterId === p.costCenterId);
      return (
        p.status.toLowerCase().includes(term) ||
        p.budgetType.toLowerCase().includes(term) ||
        (cc?.name.toLowerCase().includes(term) ?? false) ||
        (cc?.code.toLowerCase().includes(term) ?? false)
      );
    });
  }, [dash, q]);

  if (!user || (!dash && !error)) {
    return <p className="text-meta">Loading dashboard…</p>;
  }

  const role = dash?.orgRole;
  const title =
    role === "manager"
      ? "Manager Dashboard"
      : role === "gm"
        ? "GM Dashboard"
        : "My Dashboard";

  if (role === "gm") {
    return (
      <PageShell>
        <PageHeader title={title} />
        {pending.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-kengen-amber/30 bg-amber-50 px-3 py-2 text-body">
            <span>{pending.length} awaiting approval</span>
            <ActionLink href="/approvals" variant="secondary" icon={ListChecks} size="compact">
              Open queue
            </ActionLink>
          </div>
        ) : null}
        <GmDashboard />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={title}
        actions={
          user.permissionCodes.includes("budget.create") ? (
            <ActionLink href="/budgets/create" variant="primary" icon={Plus}>
              Create Budget
            </ActionLink>
          ) : null
        }
      />
      {error ? (
        <p className="mb-3 text-body text-kengen-red">{error}</p>
      ) : null}

      {dash ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-neutral-400/30 bg-white p-3">
              <p className="text-meta text-neutral-700">Total submitted</p>
              <p className="text-base font-semibold text-kengen-navy">
                {dash.totals.total}
              </p>
            </div>
            <div className="rounded border border-neutral-400/30 bg-white p-3">
              <p className="text-meta text-neutral-700">Total requested</p>
              <p className="text-base font-semibold text-kengen-navy">
                {formatCurrency(dash.totals.totalRequested)}
              </p>
            </div>
            <div className="rounded border border-neutral-400/30 bg-white p-3">
              <p className="text-meta text-neutral-700">Total approved</p>
              <p className="text-base font-semibold text-kengen-navy">
                {formatCurrency(dash.totals.totalApproved)}
              </p>
            </div>
            <div className="rounded border border-neutral-400/30 bg-white p-3">
              <p className="text-meta text-neutral-700">Approval rate</p>
              <p className="text-base font-semibold text-kengen-navy">
                {dash.totals.approvalRate}%
              </p>
            </div>
          </div>

          {pending.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-kengen-amber/30 bg-amber-50 px-3 py-2 text-body">
              <span>{pending.length} awaiting approval</span>
              <ActionLink href="/approvals" variant="secondary" icon={ListChecks} size="compact">
                Open queue
              </ActionLink>
            </div>
          ) : null}

          {role === "manager" && (
            <div className="mb-3">
              <input
                className="glass-select w-full max-w-md"
                placeholder="Search…"
                aria-label="Search budgets"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          )}

          <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
            <table className="w-full text-left text-body">
              <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
                <tr>
                  <th className="px-2 py-1.5">Cost center</th>
                  <th className="px-2 py-1.5">Type</th>
                  <th className="px-2 py-1.5">Status</th>
                  {role === "employee" ? (
                    <th className="px-2 py-1.5">Outcome</th>
                  ) : null}
                  <th className="px-2 py-1.5">Total</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {filteredPlans.length === 0 ? (
                  <tr>
                    <td
                      colSpan={role === "employee" ? 6 : 5}
                      className="px-2 py-4 text-meta text-neutral-700"
                    >
                      No budgets found.
                    </td>
                  </tr>
                ) : (
                  filteredPlans.map((p) => {
                    const cc = dash.summaries.find(
                      (s) => s.costCenterId === p.costCenterId
                    );
                    const outcome = dash.planOutcomes[p.id];
                    const isReturned = p.status === "ReturnedForRevision";
                    const isRejected = p.status === "Rejected";
                    return (
                      <tr key={p.id} className="border-t border-neutral-400/20">
                        <td className="px-2 py-1.5">
                          {cc?.name ?? p.costCenterId}
                        </td>
                        <td className="px-2 py-1.5">{p.budgetType}</td>
                        <td className="px-2 py-1.5">
                          <StatusChip status={p.status} />
                        </td>
                        {role === "employee" ? (
                          <td className="px-2 py-1.5 text-meta text-neutral-700">
                            {isReturned && outcome ? (
                              <div>
                                <p>
                                  By {outcome.performedByName} ·{" "}
                                  {fmtDate(outcome.timestamp)}
                                </p>
                                <p className="text-neutral-800">
                                  {outcome.reason}
                                </p>
                              </div>
                            ) : isRejected && outcome ? (
                              <div>
                                <p>
                                  By {outcome.performedByName} (GM) ·{" "}
                                  {fmtDate(outcome.timestamp)}
                                </p>
                                <p className="text-neutral-800">
                                  {outcome.reason}
                                </p>
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        ) : null}
                        <td className="px-2 py-1.5">
                          {formatCurrency(
                            p.lines.reduce((s, l) => s + l.amount, 0)
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            {role === "manager" &&
                            pending.some((q) => q.id === p.id) ? (
                              <ActionLink
                                href={`/budgets/${p.id}`}
                                variant="warning"
                                icon={ClipboardCheck}
                                aria-label={`Review budget ${p.budgetType}`}
                              >
                                Review
                              </ActionLink>
                            ) : (
                              <ActionLink
                                href={`/budgets/${p.id}`}
                                variant="secondary"
                                icon={Eye}
                                aria-label={`View budget ${p.budgetType}`}
                              >
                                View
                              </ActionLink>
                            )}
                            {role === "employee" && isReturned ? (
                              <>
                                <ActionLink
                                  href={`/budgets/create?edit=${p.id}`}
                                  variant="warning"
                                  icon={Pencil}
                                  aria-label="Edit returned budget"
                                >
                                  Edit
                                </ActionLink>
                                <ActionLink
                                  href={`/budgets/${p.id}`}
                                  variant="primary"
                                  icon={Send}
                                  aria-label="Open budget to resubmit"
                                >
                                  Resubmit
                                </ActionLink>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </PageShell>
  );
}

