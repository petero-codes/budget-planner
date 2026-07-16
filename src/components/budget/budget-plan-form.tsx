"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BudgetPlan,
  CostCenter,
  FiscalYear,
  GlAccount,
  User,
} from "@/domain/entities";
import type { ExistingActiveBudget } from "@/domain/existing-active-budget";
import { BUDGET_STATUS_LABEL } from "@/domain/value-objects/budget-status";
import { ApiError, apiGet, apiSend } from "@/lib/client-api";
import { GlassSelect } from "@/components/ui/glass-select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

function wholeNumberOnly(raw: string): string {
  // Digits only — no decimals, signs, or scientific notation.
  return raw.replace(/\D/g, "");
}

const ACTIVE_STATUSES = new Set([
  "Draft",
  "InApproval",
  "ReturnedForRevision",
]);

function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BudgetPlanForm({ planId }: { planId?: string }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [costCenter, setCostCenter] = useState<CostCenter | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [usersById, setUsersById] = useState<Map<string, string>>(new Map());
  const [existingPlans, setExistingPlans] = useState<BudgetPlan[]>([]);
  const [budgetType, setBudgetType] = useState("Primary");
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [fromPeriod, setFromPeriod] = useState("2026-07-01");
  const [toPeriod, setToPeriod] = useState("2027-06-30");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState([{ glAccountId: "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<ExistingActiveBudget | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadedPlanId, setLoadedPlanId] = useState<string | undefined>(planId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        const ref = await apiGet<{
          costCenters: CostCenter[];
          fiscalYears: FiscalYear[];
          glAccounts: GlAccount[];
          users: User[];
        }>("/api/v1/reference");
        if (cancelled) return;
        const current = me.user;
        const cc =
          ref.costCenters.find((c) => c.id === current.primaryCostCenterId) ??
          null;
        setUser(current);
        setCostCenter(cc);
        setUsersById(
          new Map(ref.users.map((candidate) => [candidate.id, candidate.name]))
        );
        const openYears = ref.fiscalYears.filter((fy) => fy.status === "Open");
        const selectable = planId ? ref.fiscalYears : openYears;
        setFiscalYears(selectable.length > 0 ? selectable : openYears);
        setGlAccounts(ref.glAccounts.filter((g) => g.isActive));
        const defaultFy =
          openYears.find((fy) => !fy.isLocked) ?? openYears[0] ?? null;
        if (defaultFy) {
          setFiscalYearId(defaultFy.id);
          setFromPeriod(defaultFy.startDate.slice(0, 10));
          setToPeriod(defaultFy.endDate.slice(0, 10));
        }

        if (!planId) {
          try {
            const plans = await apiGet<BudgetPlan[]>("/api/v1/budget-plans");
            if (!cancelled) setExistingPlans(plans);
          } catch {
            /* list is optional for proactive conflict — create still validates server-side */
          }
        }

        if (planId) {
          const plan = await apiGet<{
            id: string;
            budgetType: string;
            fiscalYearId: string;
            fromPeriod: string;
            toPeriod: string;
            description: string | null;
            lines: { glAccountId: string; amount: number }[];
          }>(`/api/v1/budget-plans/${planId}`);
          if (cancelled) return;
          setBudgetType(plan.budgetType);
          setFiscalYearId(plan.fiscalYearId);
          setFromPeriod(plan.fromPeriod);
          setToPeriod(plan.toPeriod);
          setDescription(plan.description ?? "");
          setLines(
            plan.lines.map((l) => ({
              glAccountId: l.glAccountId,
              amount: String(Math.trunc(l.amount)),
            }))
          );
          setLoadedPlanId(plan.id);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load form");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const proactiveConflict = useMemo((): ExistingActiveBudget | null => {
    if (planId || loadedPlanId || !user || !fiscalYearId || !budgetType) {
      return null;
    }
    const match = existingPlans.find(
      (plan) =>
        plan.costCenterId === user.primaryCostCenterId &&
        plan.fiscalYearId === fiscalYearId &&
        plan.budgetType === budgetType &&
        ACTIVE_STATUSES.has(plan.status)
    );
    if (!match) return null;
    const fy = fiscalYears.find((year) => year.id === match.fiscalYearId);
    return {
      id: match.id,
      status: match.status,
      budgetType: match.budgetType,
      costCenterId: match.costCenterId,
      costCenterCode: costCenter?.code ?? match.costCenterId,
      costCenterName: costCenter?.name ?? "",
      fiscalYearId: match.fiscalYearId,
      fiscalYearLabel: fy?.yearLabel ?? 0,
      ownerId: match.ownerId,
      ownerName: usersById.get(match.ownerId) ?? null,
      createdAt: match.createdAt,
    };
  }, [
    planId,
    loadedPlanId,
    user,
    fiscalYearId,
    budgetType,
    existingPlans,
    fiscalYears,
    costCenter,
    usersById,
  ]);

  const activeConflict = conflict ?? proactiveConflict;
  const createBlocked = !planId && !loadedPlanId && activeConflict !== null;

  function updateLine(
    index: number,
    field: "glAccountId" | "amount",
    value: string
  ) {
    const next = field === "amount" ? wholeNumberOnly(value) : value;
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: next } : line))
    );
  }

  async function saveDraft(submitAfter = false) {
    if (!user || saving || submitting || createBlocked) return;
    setError(null);
    setConflict(null);
    setSaving(true);
    if (submitAfter) setSubmitting(true);
    try {
      const payload = {
        budgetType,
        fiscalYearId,
        fromPeriod,
        toPeriod,
        costCenterId: user.primaryCostCenterId,
        description: description.trim() || null,
        lines: lines.map((l) => ({
          glAccountId: l.glAccountId,
          amount: Number(l.amount),
        })),
      };
      let id = loadedPlanId;
      if (id) {
        await apiSend(`/api/v1/budget-plans/${id}`, "PATCH", payload);
      } else {
        const created = await apiSend<{ id: string }>(
          "/api/v1/budget-plans",
          "POST",
          payload
        );
        id = created.id;
        setLoadedPlanId(id);
      }
      if (submitAfter && id) {
        await apiSend(`/api/v1/budget-plans/${id}/submit`, "POST");
        router.push("/budgets");
        return;
      }
      router.push(`/budgets/${id}`);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.code === "ACTIVE_BUDGET_EXISTS" &&
        e.existingBudget
      ) {
        setConflict(e.existingBudget);
        setError(null);
      } else {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }

  if (!user) {
    return <p className="text-meta text-neutral-700">Loading form…</p>;
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const glOptions = [
    { value: "", label: "Select GL…" },
    ...glAccounts.map((g) => ({
      value: g.id,
      label: `${g.code} — ${g.description}`,
    })),
  ];

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded border border-kengen-red/40 bg-red-50 px-3 py-2 text-body text-kengen-red">
          {error}
        </div>
      ) : null}

      {activeConflict ? (
        <div className="rounded border border-kengen-navy/25 bg-white px-4 py-3 text-body">
          <p className="font-medium text-kengen-navy">Active budget found</p>
          <p className="mt-1 text-neutral-700">
            An active {activeConflict.budgetType} budget already exists for Cost
            Center {activeConflict.costCenterCode} for FY
            {activeConflict.fiscalYearLabel}.
          </p>
          <dl className="mt-3 grid gap-1 text-meta text-neutral-700 sm:grid-cols-2">
            <div>
              <dt className="inline text-neutral-500">Status: </dt>
              <dd className="inline">
                {BUDGET_STATUS_LABEL[activeConflict.status] ??
                  activeConflict.status}
              </dd>
            </div>
            <div>
              <dt className="inline text-neutral-500">Created: </dt>
              <dd className="inline">
                {formatCreatedAt(activeConflict.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="inline text-neutral-500">Owner: </dt>
              <dd className="inline">
                {activeConflict.ownerName ?? "Unknown"}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(`/budgets/${activeConflict.id}`)}
            >
              Open Existing Budget
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/budgets")}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-white/50 bg-white/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md md:grid-cols-3">
        <label className="text-meta">
          Budget Type
          <GlassSelect
            className="mt-1"
            aria-label="Budget type"
            value={budgetType}
            onChange={(value) => {
              setBudgetType(value);
              setConflict(null);
              setError(null);
            }}
            options={[
              { value: "Primary", label: "Primary" },
              { value: "Supplementary", label: "Supplementary" },
            ]}
          />
        </label>
        <label className="text-meta">
          Fiscal Year
          <GlassSelect
            className="mt-1"
            aria-label="Fiscal year"
            value={fiscalYearId}
            onChange={(id) => {
              setFiscalYearId(id);
              setConflict(null);
              setError(null);
              const fy = fiscalYears.find((y) => y.id === id);
              if (fy) {
                setFromPeriod(fy.startDate.slice(0, 10));
                setToPeriod(fy.endDate.slice(0, 10));
              }
            }}
            options={fiscalYears.map((fy) => ({
              value: fy.id,
              label:
                fy.status === "Open"
                  ? String(fy.yearLabel)
                  : `${fy.yearLabel} (${fy.status})`,
            }))}
          />
        </label>
        <div className="text-meta">
          Cost Center
          <p
            className="glass-select mt-1 cursor-default select-text !shadow-none"
            aria-readonly="true"
          >
            {costCenter
              ? `${costCenter.code} — ${costCenter.name}`
              : user.primaryCostCenterId}
          </p>
        </div>
        <label className="text-meta">
          From Period
          <input
            type="date"
            className="glass-select mt-1"
            value={fromPeriod}
            onChange={(e) => setFromPeriod(e.target.value)}
          />
        </label>
        <label className="text-meta">
          To Period
          <input
            type="date"
            className="glass-select mt-1"
            value={toPeriod}
            onChange={(e) => setToPeriod(e.target.value)}
          />
        </label>
        <label className="text-meta md:col-span-3">
          Description
          <textarea
            className="glass-select mt-1 min-h-[4.5rem] resize-y"
            value={description}
            maxLength={1000}
            placeholder="Notes"
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/50 bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md">
        <table className="w-full text-left text-body">
          <thead className="bg-white/50 text-meta uppercase text-neutral-700">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Cost Element (GL)</th>
              <th className="px-2 py-1.5">Amount (KES)</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-white/40">
                <td className="px-2 py-1.5 text-meta">{index + 1}</td>
                <td className="relative z-10 px-2 py-1.5">
                  <GlassSelect
                    aria-label={`GL account line ${index + 1}`}
                    value={line.glAccountId}
                    onChange={(v) => updateLine(index, "glAccountId", v)}
                    options={glOptions}
                    menuClassName="min-w-[16rem]"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    className="glass-select"
                    value={line.amount}
                    onChange={(e) => updateLine(index, "amount", e.target.value)}
                    onKeyDown={(e) => {
                      if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Button
                    type="button"
                    variant="danger"
                    size="compact"
                    icon={Trash2}
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== index))
                    }
                    disabled={lines.length === 1}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-white/40 px-3 py-2">
          <Button
            type="button"
            variant="secondary"
            size="compact"
            icon={Plus}
            onClick={() =>
              setLines((prev) => [...prev, { glAccountId: "", amount: "" }])
            }
          >
            Add line
          </Button>
          <p className="text-body font-medium">
            Total: KES{" "}
            {total.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          loading={saving && !submitting}
          disabled={saving || submitting || createBlocked}
          onClick={() => void saveDraft(false)}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={submitting}
          disabled={saving || submitting || createBlocked}
          onClick={() => {
            if (
              window.confirm(
                loadedPlanId && lines.length
                  ? "Submit / resubmit this budget for approval?"
                  : "Submit this budget for approval?"
              )
            ) {
              void saveDraft(true);
            }
          }}
        >
          Submit for Approval
        </Button>
      </div>
    </div>
  );
}
