"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import {
  budgetPlanService,
  getCurrentUser,
  repos,
} from "@/infrastructure/di";
import type { BudgetPlan, User } from "@/domain/entities";
import { formatCurrency } from "@/lib/utils";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [mine, setMine] = useState<BudgetPlan[]>([]);
  const [pending, setPending] = useState<BudgetPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const current = await getCurrentUser();
        setUser(current);
        setMine(await budgetPlanService.listMine(current));
        if (current.permissionCodes.includes("budget.approve")) {
          setPending(await budgetPlanService.listPendingApprovals(current));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, []);

  const latest = mine[0];
  const total = mine.reduce(
    (sum, p) => sum + p.lines.reduce((s, l) => s + l.amount, 0),
    0
  );

  return (
    <div>
      <PageHeader
        title={user ? `My Dashboard — ${user.name}` : "My Dashboard"}
        description="Your personal workspace only. Menus and data follow your SSO identity and reporting line."
        actions={
          <Link
            href="/budgets/create"
            className="rounded bg-kengen-green px-3 py-1.5 text-body font-medium text-white"
          >
            Create Budget
          </Link>
        }
      />
      {error ? (
        <p className="mb-3 text-body text-kengen-red">{error}</p>
      ) : null}
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded border border-neutral-400/30 bg-white p-3">
          <p className="text-meta text-neutral-700">Current FY status</p>
          <p className="mt-1 text-sm font-semibold text-kengen-navy">
            {latest ? <StatusChip status={latest.status} /> : "Not started"}
          </p>
        </div>
        <div className="rounded border border-neutral-400/30 bg-white p-3">
          <p className="text-meta text-neutral-700">My budget total</p>
          <p className="mt-1 text-sm font-semibold text-kengen-navy">
            {formatCurrency(total)}
          </p>
        </div>
        <div className="rounded border border-neutral-400/30 bg-white p-3">
          <p className="text-meta text-neutral-700">Awaiting my approval</p>
          <p className="mt-1 text-sm font-semibold text-kengen-navy">
            {pending.length}
          </p>
        </div>
      </div>
      {pending.length > 0 ? (
        <div className="mb-4 rounded border border-kengen-amber/30 bg-amber-50 px-3 py-2 text-body">
          You have {pending.length} budget(s) awaiting approval.{" "}
          <Link href="/approvals" className="font-medium text-kengen-blue underline">
            Open queue
          </Link>
        </div>
      ) : null}
      <div className="rounded border border-neutral-400/30 bg-white p-3">
        <p className="mb-2 text-meta font-medium uppercase text-neutral-700">
          Shortcuts
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/budgets" className="rounded border px-2 py-1 text-body hover:bg-neutral-100">
            My Budget Plans
          </Link>
          <Link href="/budgets/create" className="rounded border px-2 py-1 text-body hover:bg-neutral-100">
            Create Budget
          </Link>
          <Link href="/notifications" className="rounded border px-2 py-1 text-body hover:bg-neutral-100">
            Notifications
          </Link>
        </div>
      </div>
    </div>
  );
}
