"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { BudgetPlanForm } from "@/components/budget/budget-plan-form";

function CreateBudgetInner() {
  const params = useSearchParams();
  const editId = params?.get("edit") ?? undefined;

  return (
    <div>
      <PageHeader title={editId ? "Edit Budget" : "Create Budget"} />
      <BudgetPlanForm planId={editId} />
    </div>
  );
}

export default function CreateBudgetPage() {
  return (
    <Suspense fallback={<p className="text-meta">Loading…</p>}>
      <CreateBudgetInner />
    </Suspense>
  );
}
