"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { FiscalYear, GlAccount, User } from "@/domain/entities";
import { budgetPlanService, getCurrentUser, repos } from "@/infrastructure/di";

export function BudgetPlanForm({
  planId,
}: {
  planId?: string;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccount[]>([]);
  const [budgetType, setBudgetType] = useState("Primary");
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [fromPeriod, setFromPeriod] = useState("2026-07-01");
  const [toPeriod, setToPeriod] = useState("2027-06-30");
  const [lines, setLines] = useState([{ glAccountId: "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadedPlanId, setLoadedPlanId] = useState<string | undefined>(planId);

  useEffect(() => {
    void (async () => {
      const current = await getCurrentUser();
      const fys = await repos.fiscalYears.getAll();
      const gls = await repos.glAccounts.getAll();
      setUser(current);
      setFiscalYears(fys);
      setGlAccounts(gls.filter((g) => g.isActive));
      setFiscalYearId(fys[0]?.id ?? "");

      if (planId) {
        const plan = await budgetPlanService.getById(planId, current);
        setBudgetType(plan.budgetType);
        setFiscalYearId(plan.fiscalYearId);
        setFromPeriod(plan.fromPeriod);
        setToPeriod(plan.toPeriod);
        setLines(
          plan.lines.map((l) => ({
            glAccountId: l.glAccountId,
            amount: String(l.amount),
          }))
        );
        setLoadedPlanId(plan.id);
      }
    })();
  }, [planId]);

  function updateLine(
    index: number,
    field: "glAccountId" | "amount",
    value: string
  ) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  }

  async function saveDraft(submitAfter = false) {
    if (!user) return;
    setError(null);
    setSaving(true);
    if (submitAfter) setSubmitting(true);
    try {
      const payload = {
        budgetType,
        fiscalYearId,
        fromPeriod,
        toPeriod,
        costCenterId: user.primaryCostCenterId,
        lines: lines.map((l) => ({
          glAccountId: l.glAccountId,
          amount: Number(l.amount),
        })),
      };
      let id = loadedPlanId;
      if (id) {
        await budgetPlanService.updateDraft(id, user, payload);
      } else {
        const created = await budgetPlanService.createDraft(user, payload);
        id = created.id;
        setLoadedPlanId(id);
      }
      if (submitAfter && id) {
        await budgetPlanService.submit(id, user);
        router.push("/budgets");
        return;
      }
      router.push(`/budgets/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  }

  if (!user) {
    return <p className="text-meta text-neutral-700">Loading form…</p>;
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded border border-kengen-red/40 bg-red-50 px-3 py-2 text-body text-kengen-red">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 rounded border border-neutral-400/30 bg-white p-3 md:grid-cols-3">
        <label className="text-meta">
          Budget Type
          <select
            className="mt-1 w-full rounded border border-neutral-400/40 px-2 py-1.5 text-body"
            value={budgetType}
            onChange={(e) => setBudgetType(e.target.value)}
          >
            <option value="Primary">Primary</option>
            <option value="Amendment">Amendment</option>
          </select>
        </label>
        <label className="text-meta">
          Fiscal Year
          <select
            className="mt-1 w-full rounded border border-neutral-400/40 px-2 py-1.5 text-body"
            value={fiscalYearId}
            onChange={(e) => setFiscalYearId(e.target.value)}
          >
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.yearLabel}
              </option>
            ))}
          </select>
        </label>
        <label className="text-meta">
          Cost Center
          <input
            className="mt-1 w-full rounded border border-neutral-400/40 bg-neutral-100 px-2 py-1.5 text-body"
            value={user.primaryCostCenterId}
            readOnly
          />
        </label>
        <label className="text-meta">
          From Period
          <input
            type="date"
            className="mt-1 w-full rounded border border-neutral-400/40 px-2 py-1.5 text-body"
            value={fromPeriod}
            onChange={(e) => setFromPeriod(e.target.value)}
          />
        </label>
        <label className="text-meta">
          To Period
          <input
            type="date"
            className="mt-1 w-full rounded border border-neutral-400/40 px-2 py-1.5 text-body"
            value={toPeriod}
            onChange={(e) => setToPeriod(e.target.value)}
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded border border-neutral-400/30 bg-white">
        <table className="w-full text-left text-body">
          <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Cost Element (GL)</th>
              <th className="px-2 py-1.5">Amount (KES)</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="border-t border-neutral-400/20">
                <td className="px-2 py-1.5 text-meta">{index + 1}</td>
                <td className="px-2 py-1.5">
                  <select
                    className="w-full rounded border border-neutral-400/40 px-2 py-1"
                    value={line.glAccountId}
                    onChange={(e) =>
                      updateLine(index, "glAccountId", e.target.value)
                    }
                  >
                    <option value="">Select GL…</option>
                    {glAccounts.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.code} — {g.description}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="w-full rounded border border-neutral-400/40 px-2 py-1"
                    value={line.amount}
                    onChange={(e) => updateLine(index, "amount", e.target.value)}
                  />
                </td>
                <td className="px-2 py-1.5">
                  <button
                    type="button"
                    className="text-meta text-kengen-red hover:underline"
                    onClick={() =>
                      setLines((prev) => prev.filter((_, i) => i !== index))
                    }
                    disabled={lines.length === 1}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-neutral-400/20 px-3 py-2">
          <button
            type="button"
            className="text-body text-kengen-blue hover:underline"
            onClick={() =>
              setLines((prev) => [...prev, { glAccountId: "", amount: "" }])
            }
          >
            + Add line
          </button>
          <p className="text-body font-medium">
            Total: KES {total.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || submitting}
          onClick={() => void saveDraft(false)}
          className="rounded bg-kengen-navy px-3 py-1.5 text-body font-medium text-white hover:bg-kengen-navy/90 disabled:opacity-50"
        >
          {saving && !submitting ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          disabled={saving || submitting}
          onClick={() => {
            if (window.confirm("Submit this budget for approval?")) {
              void saveDraft(true);
            }
          }}
          className="rounded bg-kengen-green px-3 py-1.5 text-body font-medium text-white hover:bg-kengen-green/90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit for Approval"}
        </button>
      </div>
    </div>
  );
}
