"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ClipboardCheck,
  Eye,
  FolderPlus,
  ListChecks,
  MapPin,
  Pencil,
  Plus,
  Search,
  Send,
  TrendingUp,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { StatusChip } from "@/components/shared/status-chip";
import { GmDashboard } from "@/components/dashboard/gm-dashboard";
import { ActionLink } from "@/components/ui/button";
import { apiGet } from "@/lib/client-api";
import type { BudgetPlan, User } from "@/domain/entities";
import { budgetCategoryLabel } from "@/domain/constants/budget-types";
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
        p.budgetCategory.toLowerCase().includes(term) ||
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
             <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-kengen-amber/20 bg-amber-50 px-4 py-3 text-sm font-medium">
               <span className="flex items-center gap-2">
                 <AlertTriangle className="h-4 w-4 text-kengen-amber" />
                 <span>{pending.length} awaiting approval</span>
               </span>
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
           <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
             <div className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 hover:border-kengen-green/20 hover:bg-kengen-green/5 transition-all duration-200">
               <div className="flex items-start gap-3">
                 <div className="flex h-8 w-8 items-center justify-center rounded-md bg-kengen-green/10">
                   <ClipboardCheck className="h-4 w-4 text-kengen-green" />
                 </div>
                 <div>
                   <p className="text-xs font-medium text-muted-foreground">Total submitted</p>
                   <p className="mt-1 text-lg font-semibold text-kengen-navy">
                     {dash.totals.total}
                   </p>
                 </div>
               </div>
             </div>
             <div className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 hover:border-kengen-green/20 hover:bg-kengen-green/5 transition-all duration-200">
               <div className="flex items-start gap-3">
                 <div className="flex h-8 w-8 items-center justify-center rounded-md bg-kengen-green/10">
                   <Send className="h-4 w-4 text-kengen-green" />
                 </div>
                 <div>
                   <p className="text-xs font-medium text-muted-foreground">Total requested</p>
                   <p className="mt-1 text-lg font-semibold text-kengen-navy">
                     {formatCurrency(dash.totals.totalRequested)}
                   </p>
                 </div>
               </div>
             </div>
             <div className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 hover:border-kengen-green/20 hover:bg-kengen-green/5 transition-all duration-200">
               <div className="flex items-start gap-3">
                 <div className="flex h-8 w-8 items-center justify-center rounded-md bg-kengen-green/10">
                   <Check className="h-4 w-4 text-kengen-green" />
                 </div>
                 <div>
                   <p className="text-xs font-medium text-muted-foreground">Total approved</p>
                   <p className="mt-1 text-lg font-semibold text-kengen-navy">
                     {formatCurrency(dash.totals.totalApproved)}
                   </p>
                 </div>
               </div>
             </div>
             <div className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 hover:border-kengen-green/20 hover:bg-kengen-green/5 transition-all duration-200">
               <div className="flex items-start gap-3">
                 <div className="flex h-8 w-8 items-center justify-center rounded-md bg-kengen-green/10">
                   <TrendingUp className="h-4 w-4 text-kengen-green" />
                 </div>
                 <div>
                   <p className="text-xs font-medium text-muted-foreground">Approval rate</p>
                   <p className="mt-1 text-lg font-semibold text-kengen-navy">
                     {dash.totals.approvalRate}%
                   </p>
                 </div>
               </div>
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
             <div className="mb-4">
               <div className="relative">
                 <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground">
                   <Search className="h-4 w-4" />
                 </div>
                 <input
                   className="block w-full pl-10 pr-3 py-2.5 text-base rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-kengen-green focus:border-kengen-green/50 dark:bg-dark-surface dark:border-dark-border/60 placeholder:text-muted-foreground/70"
                   placeholder="Search budgets by cost center, type, or status..."
                   aria-label="Search budgets"
                   value={q}
                   onChange={(e) => setQ(e.target.value)}
                 />
               </div>
             </div>
           )}

<div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-neutral-200">
                 <thead className="bg-neutral-50">
                   <tr>
                     <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                       Cost center
                     </th>
                     <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                       Type
                     </th>
                     <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                       Status
                     </th>
                     {role === "employee" ? (
                       <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                         Outcome
                       </th>
                     ) : null}
                     <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                       Total
                     </th>
                     <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                       Actions
                     </th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-neutral-200">
                   {filteredPlans.length === 0 ? (
                     <tr>
                       <td
                         colSpan={role === "employee" ? 6 : 5}
                         className="px-6 py-8 text-center text-sm text-muted-foreground"
                       >
                         <div className="flex flex-col items-center gap-3">
                           <FolderPlus className="h-8 w-8 text-muted-foreground/50" />
                           <p className="text-center">No budgets found</p>
                           <p className="text-xs text-muted-foreground">
                             Try adjusting your search filters or create a new budget to get started.
                           </p>
                         </div>
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
                         <tr
                           key={p.id}
                           className="hover:bg-neutral-50 transition-colors"
                         >
                           <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex items-center space-x-3">
                               <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-100">
                                 <MapPin className="h-4 w-4 text-muted-foreground" />
                               </div>
                               <div className="flex-1">
                                 <p className="text-sm font-medium text-foreground">{cc?.name ?? p.costCenterId}</p>
                                 <p className="text-xs text-muted-foreground">{cc?.code ?? ''}</p>
                               </div>
                             </div>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                             <span className="px-2.5 py-0.5 text-xs font-medium rounded-full 
                                {p.budgetCategory === 'RECURRENT' && 'bg-green-100 text-green-800'}
                                {p.budgetCategory === 'MAJOR' && 'bg-blue-100 text-blue-800'}
                                {p.budgetCategory === 'CAPEX' && 'bg-purple-100 text-purple-800'}">
                               {budgetCategoryLabel(p.budgetCategory)}
                             </span>
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap">
                             <span className="px-2.5 py-0.5 text-xs font-medium rounded-full 
                                {p.status === 'Draft' && 'bg-gray-100 text-gray-800'}
                                {p.status === 'InApproval' && 'bg-blue-100 text-blue-800'}
                                {p.status === 'ReturnedForRevision' && 'bg-amber-100 text-amber-800'}
                                {p.status === 'PendingFinanceReview' && 'bg-indigo-100 text-indigo-800'}
                                {p.status === 'Claimed' && 'bg-violet-100 text-violet-800'}
                                {p.status === 'Approved' && 'bg-green-100 text-green-800'}
                                {p.status === 'Finalized' && 'bg-emerald-100 text-emerald-800'}
                                {p.status === 'Rejected' && 'bg-red-100 text-red-800'}">
                               {p.status.replace(/([A-Z])/g, ' $1').trim()}
                             </span>
                           </td>
{role === "employee" ? (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                {isReturned && outcome ? (
                                  <div className="space-y-1">
                                    <p className="flex items-center gap-1.5 text-xs">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span>{outcome.performedByName}</span>
                                      <time className="ml-2" dateTime={outcome.timestamp}>
                                        {fmtDate(outcome.timestamp)}
                                      </time>
                                    </p>
                                    <p className="line-clamp-1 text-sm text-muted-foreground">
                                      {outcome.reason}
                                    </p>
                                  </div>
                                ) : isRejected && outcome ? (
                                  <div className="space-y-1">
                                    <p className="flex items-center gap-1.5 text-xs">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span>{outcome.performedByName}</span>
                                      <span className="text-xs text-muted-foreground">(GM)</span>
                                      <time className="ml-2" dateTime={outcome.timestamp}>
                                        {fmtDate(outcome.timestamp)}
                                      </time>
                                    </p>
                                    <p className="line-clamp-1 text-sm text-muted-foreground">
                                      {outcome.reason}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            ) : null}
                           <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                             {formatCurrency(
                               p.lines.reduce((s, l) => s + l.amount, 0)
                             )}
                           </td>
                           <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                             <div className="flex items-center space-x-2">
                               {role === "manager" &&
                               pending.some((q) => q.id === p.id) ? (
                                 <ActionLink
                                   href={`/budgets/${p.id}`}
                                   variant="outline"
                                   icon={ClipboardCheck}
                                   size="icon"
                                   aria-label={`Review budget ${budgetCategoryLabel(p.budgetCategory)}`}
                                 />
                               ) : (
                                 <ActionLink
                                   href={`/budgets/${p.id}`}
                                   variant="outline"
                                   icon={Eye}
                                   size="icon"
                                   aria-label={`View budget ${budgetCategoryLabel(p.budgetCategory)}`}
                                 />
                               )}
                               {role === "employee" && isReturned ? (
                                 <>
                                   <ActionLink
                                     href={`/budgets/create?edit=${p.id}`}
                                     variant="outline"
                                     icon={Pencil}
                                     size="icon"
                                     aria-label="Edit returned budget"
                                   />
                                   <ActionLink
                                     href={`/budgets/${p.id}`}
                                     variant="outline"
                                     icon={Send}
                                     size="icon"
                                     aria-label="Open budget to resubmit"
                                   />
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
           </div>
        </>
      ) : null}
    </PageShell>
  );
}

