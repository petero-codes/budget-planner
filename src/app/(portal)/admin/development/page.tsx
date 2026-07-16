"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { apiGet, apiSend, ApiError } from "@/lib/client-api";
import type { FiscalYear, User } from "@/domain/entities";
import type {
  CloneFyPreview,
  DiagnosticsResult,
  IntegrityFinding,
  SessionListItem,
  ToolkitEnvironment,
  ToolkitHealth,
} from "@/domain/development/types";

type ConfirmState = {
  title: string;
  token: string;
  summary: string;
  danger?: boolean;
  onConfirm: (reason: string) => Promise<void>;
} | null;

function StatusCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "bad" | "neutral";
}) {
  const color =
    tone === "ok"
      ? "text-kengen-green"
      : tone === "bad"
        ? "text-kengen-red"
        : "text-kengen-navy";
  return (
    <div className="border border-neutral-400/40 bg-white px-4 py-3">
      <div className="text-meta text-neutral-600">{label}</div>
      <div className={`mt-1 text-lg font-medium ${color}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 border-t border-neutral-400/30 pt-5">
      <h2 className="mb-1 text-lg font-medium text-kengen-navy">{title}</h2>
      {description ? (
        <p className="mb-3 text-meta text-neutral-600">{description}</p>
      ) : null}
      {children}
    </section>
  );
}

function ToolButton({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
  disabled?: boolean;
  title?: string;
}) {
  const base =
    "rounded px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "border border-kengen-navy bg-kengen-navy text-white hover:bg-kengen-navy/90"
      : variant === "danger"
        ? "border border-kengen-red text-kengen-red hover:bg-red-50"
        : "border border-neutral-400 text-kengen-navy hover:bg-neutral-50";
  return (
    <button
      type="button"
      className={`${base} ${styles}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

function ConfirmModal({
  state,
  onClose,
}: {
  state: ConfirmState;
  onClose: () => void;
}) {
  const reasonId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state) return null;

  const reasonOk = reason.trim().length >= 3;
  const canSubmit = acknowledged && reasonOk && !busy;
  const hint = !acknowledged
    ? "Tick the confirmation box to continue."
    : !reasonOk
      ? "Enter a short reason (at least 3 characters)."
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-confirm-title"
    >
      <div className="w-full max-w-md border border-neutral-400 bg-white p-5 shadow-lg">
        <h3
          id="dev-confirm-title"
          className="text-lg font-medium text-kengen-navy"
        >
          {state.title}
        </h3>
        <p className="mt-2 text-body text-neutral-700">{state.summary}</p>
        <p className="mt-2 text-meta text-neutral-600">
          This is recorded in the audit log. It only affects development /
          test data flows.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-2 text-body text-neutral-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>
            I understand and want to run <strong>{state.title}</strong>
          </span>
        </label>

        <label className="mt-3 block text-meta" htmlFor={reasonId}>
          Reason <span className="text-neutral-500">(required)</span>
          <textarea
            id={reasonId}
            className="mt-1 w-full border border-neutral-400 px-3 py-2"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Preparing UAT cycle for FY clone"
            autoFocus
          />
        </label>

        {hint && !error ? (
          <p className="mt-2 text-sm text-amber-800">{hint}</p>
        ) : null}
        {error ? <p className="mt-2 text-sm text-kengen-red">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 text-body text-neutral-700 hover:underline"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className={
              state.danger
                ? "bg-kengen-red px-4 py-2 text-white disabled:opacity-40"
                : "bg-kengen-navy px-4 py-2 text-white disabled:opacity-40"
            }
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  await state.onConfirm(reason.trim());
                  onClose();
                } catch (e) {
                  setError(
                    e instanceof ApiError
                      ? e.message
                      : e instanceof Error
                        ? e.message
                        : "Action failed"
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "Working…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DevelopmentToolsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [health, setHealth] = useState<ToolkitHealth | null>(null);
  const [env, setEnv] = useState<ToolkitEnvironment | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [budgets, setBudgets] = useState<
    {
      id: string;
      description: string | null;
      status: string;
      versionLabel: string | null;
    }[]
  >([]);
  const [integrity, setIntegrity] = useState<IntegrityFinding[] | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(
    null
  );
  const [lastDiagnosticsAt, setLastDiagnosticsAt] = useState<string | null>(
    null
  );
  const [clonePreview, setClonePreview] = useState<CloneFyPreview | null>(null);
  const [sourceFyId, setSourceFyId] = useState("");
  const [targetBudgetId, setTargetBudgetId] = useState("");
  const [simTarget, setSimTarget] = useState<"Manager" | "GM" | "Finance">(
    "GM"
  );
  const [demoCount, setDemoCount] = useState<5 | 20 | 100 | 500>(5);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const selectedFy = fiscalYears.find((f) => f.id === sourceFyId);
  const openFy = fiscalYears.find((f) => f.status === "Open");
  const selectedBudget = budgets.find((b) => b.id === targetBudgetId);

  const reload = useCallback(async () => {
    const [h, e, s, fys, plans, diagMeta] = await Promise.all([
      apiGet<ToolkitHealth>("/api/v1/development/health"),
      apiGet<ToolkitEnvironment>("/api/v1/development/environment"),
      apiGet<SessionListItem[]>("/api/v1/development/sessions"),
      apiGet<FiscalYear[]>("/api/v1/development/fiscal-years"),
      apiGet<
        {
          id: string;
          description: string | null;
          status: string;
          versionLabel: string | null;
        }[]
      >("/api/v1/development/budgets"),
      apiGet<{ lastRunAt: string | null }>(
        "/api/v1/development/diagnostics"
      ).catch(() => ({ lastRunAt: null })),
    ]);
    setHealth(h);
    setEnv(e);
    setSessions(s);
    setFiscalYears(fys);
    setBudgets(plans.slice(0, 80));
    setLastDiagnosticsAt(diagMeta.lastRunAt);
    setSourceFyId((prev) => prev || fys[0]?.id || "");
    setTargetBudgetId((prev) => prev || plans[0]?.id || "");
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        if (!me.user.roleCodes.includes("SystemAdmin")) {
          router.replace("/access-denied");
          return;
        }
        await reload();
        setReady(true);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router, reload]);

  function showOk(text: string) {
    setErrorBanner(null);
    setMessage(text);
  }

  function showErr(e: unknown) {
    setMessage(null);
    setErrorBanner(
      e instanceof ApiError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Something went wrong"
    );
  }

  function openConfirm(opts: {
    title: string;
    token: string;
    summary: string;
    danger?: boolean;
    action: (reason: string) => Promise<void>;
  }) {
    setConfirm({
      title: opts.title,
      token: opts.token,
      summary: opts.summary,
      danger: opts.danger,
      onConfirm: async (reason) => {
        await opts.action(reason);
        showOk(`${opts.title} completed.`);
        await reload();
      },
    });
  }

  async function runPreviewClone() {
    if (!sourceFyId) {
      showErr(new Error("Select a fiscal year first."));
      return;
    }
    setBusyKey("preview-clone");
    setErrorBanner(null);
    try {
      const preview = await apiSend<CloneFyPreview>(
        "/api/v1/development/fiscal-years/clone/preview",
        "POST",
        {
          sourceFiscalYearId: sourceFyId,
          copyFinalizedAsDrafts: true,
          copyBudgetLines: true,
          copyAttachments: false,
        }
      );
      setClonePreview(preview);
      showOk(
        `Preview ready: FY${preview.sourceYearLabel} → FY${preview.targetYearLabel}`
      );
    } catch (e) {
      showErr(e);
    } finally {
      setBusyKey(null);
    }
  }

  if (!ready) {
    return <p className="p-4 text-meta">Loading development tools…</p>;
  }

  return (
    <PageShell>
      <PageHeader title="Development Tools" />

      <div className="mb-6 border border-amber-600/40 bg-amber-50 px-4 py-3 text-body text-amber-950">
        <strong>Development only</strong> — use these tools to set up and reset
        test cycles. Each action asks for a short reason and is written to the
        audit log.
      </div>

      {message ? (
        <div className="mb-4 flex items-start justify-between gap-3 border border-kengen-green/40 bg-green-50 px-4 py-3 text-sm text-kengen-green">
          <p>{message}</p>
          <button
            type="button"
            className="shrink-0 underline"
            onClick={() => setMessage(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {errorBanner ? (
        <div className="mb-4 flex items-start justify-between gap-3 border border-kengen-red/40 bg-red-50 px-4 py-3 text-sm text-kengen-red">
          <p>{errorBanner}</p>
          <button
            type="button"
            className="shrink-0 underline"
            onClick={() => setErrorBanner(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <Section
        title="Database Health"
        description="Live checks plus counts. Refresh after running toolkit actions."
      >
        <ul className="mb-4 space-y-1 text-sm">
          {(health?.checks ?? []).map((c) => (
            <li key={c.code}>
              <span className={c.ok ? "text-kengen-green" : "text-kengen-red"}>
                {c.ok ? "✓" : "✗"}
              </span>{" "}
              {c.label}
            </li>
          ))}
          {!health?.checks?.length ? (
            <li className="text-meta">No checks yet — refresh health.</li>
          ) : null}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            label="Database"
            value={health?.databaseStatus ?? "—"}
            tone={health?.databaseStatus === "Healthy" ? "ok" : "bad"}
          />
          <StatusCard
            label="Connection"
            value={health?.connectionStatus ?? "—"}
            tone={health?.connectionStatus === "Healthy" ? "ok" : "bad"}
          />
          <StatusCard label="Users" value={health?.users ?? 0} />
          <StatusCard label="Budgets" value={health?.budgets ?? 0} />
          <StatusCard label="Audit Logs" value={health?.auditLogs ?? 0} />
          <StatusCard label="Notifications" value={health?.notifications ?? 0} />
          <StatusCard
            label="Finance Claims"
            value={health?.financeClaims ?? 0}
          />
          <StatusCard label="Attachments" value={health?.attachments ?? 0} />
          <StatusCard
            label="Current FY"
            value={health?.currentFyLabel ?? "—"}
          />
          <StatusCard label="Open FY" value={health?.openFyLabel ?? "—"} />
        </div>
        <ToolButton
          onClick={() => {
            void (async () => {
              setBusyKey("health");
              try {
                await reload();
                showOk("Health refreshed.");
              } catch (e) {
                showErr(e);
              } finally {
                setBusyKey(null);
              }
            })();
          }}
          disabled={busyKey === "health"}
        >
          {busyKey === "health" ? "Refreshing…" : "Refresh health"}
        </ToolButton>
      </Section>

      <Section
        title="Fiscal Year"
        description="Open/close years for testing, or clone an FY into the next year as drafts."
      >
        <label className="mb-3 block text-meta">
          Fiscal year
          <select
            className="ml-2 border border-neutral-400 px-2 py-1"
            value={sourceFyId}
            onChange={(e) => {
              setSourceFyId(e.target.value);
              setClonePreview(null);
            }}
          >
            {fiscalYears.length === 0 ? (
              <option value="">No fiscal years found</option>
            ) : (
              fiscalYears.map((fy) => (
                <option key={fy.id} value={fy.id}>
                  FY{fy.yearLabel} — {fy.status}
                  {fy.isCurrent ? " (current)" : ""}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <ToolButton
            disabled={!sourceFyId}
            title={
              !sourceFyId
                ? "Select a fiscal year"
                : `Reopen FY${selectedFy?.yearLabel ?? ""}`
            }
            onClick={() =>
              openConfirm({
                title: "Reopen Fiscal Year",
                token: "REOPEN",
                summary: `Reopen FY${selectedFy?.yearLabel}. This is blocked if another year is already Open.`,
                action: (reason) =>
                  apiSend("/api/v1/development/fiscal-years/reopen", "POST", {
                    confirm: "REOPEN",
                    reason,
                    fiscalYearId: sourceFyId,
                  }),
              })
            }
          >
            Reopen FY
          </ToolButton>
          <ToolButton
            disabled={!sourceFyId}
            onClick={() =>
              openConfirm({
                title: "Close Fiscal Year",
                token: "CLOSE",
                summary: `Close FY${selectedFy?.yearLabel}.`,
                action: (reason) =>
                  apiSend("/api/v1/development/fiscal-years/close", "POST", {
                    confirm: "CLOSE",
                    reason,
                    fiscalYearId: sourceFyId,
                  }),
              })
            }
          >
            Close FY
          </ToolButton>
          <ToolButton
            disabled={!sourceFyId || busyKey === "preview-clone"}
            onClick={() => void runPreviewClone()}
          >
            {busyKey === "preview-clone" ? "Previewing…" : "Preview Clone FY"}
          </ToolButton>
          <ToolButton
            variant="primary"
            disabled={!sourceFyId}
            onClick={() =>
              openConfirm({
                title: "Clone Fiscal Year",
                token: "CLONE",
                summary: `Clone FY${selectedFy?.yearLabel} into the next year as draft budgets (no approvals or finance claims).`,
                action: (reason) =>
                  apiSend("/api/v1/development/fiscal-years/clone", "POST", {
                    confirm: "CLONE",
                    reason,
                    sourceFiscalYearId: sourceFyId,
                    copyFinalizedAsDrafts: true,
                    copyBudgetLines: true,
                    copyAttachments: false,
                  }),
              })
            }
          >
            Clone FY
          </ToolButton>
        </div>
        {clonePreview ? (
          <div className="mt-4 border border-neutral-400/40 bg-neutral-50 p-4 text-sm">
            <p className="font-medium text-kengen-navy">
              Clone FY{clonePreview.sourceYearLabel} → FY
              {clonePreview.targetYearLabel}
            </p>
            <p className="mt-2 font-medium text-kengen-green">Will create</p>
            <ul className="list-inside list-disc text-neutral-700">
              <li>Fiscal Year</li>
              <li>{clonePreview.willCreate.submissionRows} submission rows</li>
              <li>{clonePreview.willCreate.draftBudgets} draft budgets</li>
              <li>{clonePreview.willCreate.budgetLines} budget lines</li>
              <li>{clonePreview.willCreate.attachments} attachments</li>
            </ul>
            <p className="mt-2 font-medium text-neutral-600">Will not copy</p>
            <ul className="list-inside list-disc text-neutral-700">
              {clonePreview.willNotCopy.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section
        title="Budgets"
        description="Reset returns a plan to Draft. Generate/delete demos use the IsDemo flag only."
      >
        <label className="mb-3 block text-meta">
          Budget
          <select
            className="ml-2 max-w-xl border border-neutral-400 px-2 py-1"
            value={targetBudgetId}
            onChange={(e) => setTargetBudgetId(e.target.value)}
          >
            {budgets.length === 0 ? (
              <option value="">No budgets — generate demos first</option>
            ) : (
              budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.versionLabel ?? b.description ?? b.id.slice(0, 8)} —{" "}
                  {b.status}
                </option>
              ))
            )}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <ToolButton
            disabled={!targetBudgetId}
            onClick={() =>
              openConfirm({
                title: "Reset Workflow",
                token: "RESET",
                summary: `Return “${selectedBudget?.versionLabel ?? selectedBudget?.description ?? "budget"}” to Draft, clear approvals/claims, rebuild the route. History is kept.`,
                action: (reason) =>
                  apiSend("/api/v1/development/budgets/reset-workflow", "POST", {
                    confirm: "RESET",
                    reason,
                    budgetPlanId: targetBudgetId,
                  }),
              })
            }
          >
            Reset Workflow → Draft
          </ToolButton>
          <ToolButton
            disabled={!targetBudgetId || !openFy}
            title={
              !openFy
                ? "Need an Open fiscal year to clone into"
                : "Clone selected budget into the Open FY"
            }
            onClick={() => {
              if (!openFy) {
                showErr(
                  new Error(
                    "No Open fiscal year. Open or clone an FY first, then try again."
                  )
                );
                return;
              }
              openConfirm({
                title: "Clone Budget",
                token: "CLONE",
                summary: `Clone the selected budget into Open FY${openFy.yearLabel} as a new draft.`,
                action: (reason) =>
                  apiSend("/api/v1/development/budgets/clone", "POST", {
                    confirm: "CLONE",
                    reason,
                    sourcePlanId: targetBudgetId,
                    targetFiscalYearId: openFy.id,
                    copyAttachments: true,
                  }),
              });
            }}
          >
            Clone Budget
          </ToolButton>
          <select
            className="border border-neutral-400 px-2 py-1 text-sm"
            value={demoCount}
            onChange={(e) =>
              setDemoCount(Number(e.target.value) as 5 | 20 | 100 | 500)
            }
            aria-label="Number of demo budgets"
          >
            <option value={5}>5 demos</option>
            <option value={20}>20 demos</option>
            <option value={100}>100 demos</option>
            <option value={500}>500 demos</option>
          </select>
          <ToolButton
            onClick={() =>
              openConfirm({
                title: "Generate Demo Budgets",
                token: "GENERATE",
                summary: `Create ${demoCount} demo budgets marked IsDemo (safe to delete later).`,
                action: (reason) =>
                  apiSend("/api/v1/development/budgets/generate", "POST", {
                    confirm: "GENERATE",
                    reason,
                    count: demoCount,
                  }),
              })
            }
          >
            Generate Sample Budgets
          </ToolButton>
          <ToolButton
            variant="danger"
            onClick={() =>
              openConfirm({
                title: "Delete Demo Budgets",
                token: "DELETE_DEMO",
                danger: true,
                summary:
                  "Delete only IsDemo budgets and their demo lines, routes, notifications, and finance claims. Real budgets are left untouched.",
                action: (reason) =>
                  apiSend("/api/v1/development/budgets/delete-demo", "POST", {
                    confirm: "DELETE_DEMO",
                    reason,
                  }),
              })
            }
          >
            Delete Demo Budgets
          </ToolButton>
        </div>
      </Section>

      <Section
        title="Workflow Simulator"
        description="Jump a selected budget to Manager, GM, or Finance. Does not reset to Draft — use Reset Workflow for that."
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border border-neutral-400 px-2 py-1 text-sm"
            value={simTarget}
            onChange={(e) =>
              setSimTarget(e.target.value as typeof simTarget)
            }
            aria-label="Simulator target stage"
          >
            <option value="Manager">Move to Manager</option>
            <option value="GM">Move to GM</option>
            <option value="Finance">Move to Finance</option>
          </select>
          <ToolButton
            variant="primary"
            disabled={!targetBudgetId}
            onClick={() =>
              openConfirm({
                title: "Workflow Simulator",
                token: "SIMULATE",
                summary: `Move “${selectedBudget?.versionLabel ?? selectedBudget?.description ?? "budget"}” to ${simTarget} for testing.`,
                action: (reason) =>
                  apiSend("/api/v1/development/workflow/simulate", "POST", {
                    confirm: "SIMULATE",
                    reason,
                    budgetPlanId: targetBudgetId,
                    target: simTarget,
                  }),
              })
            }
          >
            Run simulator
          </ToolButton>
          <ToolButton
            onClick={() =>
              openConfirm({
                title: "Clear Finance Queue",
                token: "CLEAR",
                summary: "Release all active finance claims so the queue is empty.",
                action: (reason) =>
                  apiSend(
                    "/api/v1/development/workflow/clear-finance-queue",
                    "POST",
                    { confirm: "CLEAR", reason }
                  ),
              })
            }
          >
            Clear Finance Queue
          </ToolButton>
          <ToolButton
            onClick={() =>
              openConfirm({
                title: "Clear Notifications",
                token: "CLEAR",
                summary:
                  "Soft-clear notifications (rows kept for audit; they no longer appear in inboxes).",
                action: (reason) =>
                  apiSend(
                    "/api/v1/development/workflow/clear-notifications",
                    "POST",
                    { confirm: "CLEAR", reason }
                  ),
              })
            }
          >
            Clear Notifications
          </ToolButton>
        </div>
      </Section>

      <Section
        title="System Integrity"
        description="Point checks for lineages, routes, claims, and fiscal-year rules."
      >
        <ToolButton
          onClick={() =>
            openConfirm({
              title: "Run System Integrity",
              token: "VALIDATE",
              summary: "Run integrity checks and show findings below.",
              action: async (reason) => {
                const data = await apiSend<IntegrityFinding[]>(
                  "/api/v1/development/integrity/validate",
                  "POST",
                  { confirm: "VALIDATE", reason }
                );
                setIntegrity(data);
              },
            })
          }
        >
          Run Validation
        </ToolButton>
        {integrity ? (
          <ul className="mt-3 space-y-1 text-sm">
            {integrity.map((f) => (
              <li key={f.code}>
                <span
                  className={f.ok ? "text-kengen-green" : "text-kengen-red"}
                >
                  {f.ok ? "✓" : "✗"}
                </span>{" "}
                {f.message}
                {typeof f.count === "number" && f.count > 0
                  ? ` (${f.count})`
                  : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title="System Diagnostics"
        description="Full pre-UAT pack: RBAC, lineages, routes, finance queue, notifications, FY rules, connectivity, sessions."
      >
        <ToolButton
          variant="primary"
          onClick={() =>
            openConfirm({
              title: "Run Full Validation",
              token: "DIAGNOSE",
              summary: "Run the full diagnostics suite and store the last-run time.",
              action: async (reason) => {
                const data = await apiSend<DiagnosticsResult>(
                  "/api/v1/development/diagnostics",
                  "POST",
                  { confirm: "DIAGNOSE", reason }
                );
                setDiagnostics(data);
                setLastDiagnosticsAt(data.ranAt);
              },
            })
          }
        >
          Run Full Validation
        </ToolButton>
        <p className="mt-2 text-meta">
          Last run:{" "}
          {lastDiagnosticsAt
            ? new Date(lastDiagnosticsAt).toLocaleString()
            : "Never"}
        </p>
        {diagnostics ? (
          <ul className="mt-3 space-y-1 text-sm">
            {diagnostics.checks.map((f) => (
              <li key={f.code}>
                <span
                  className={f.ok ? "text-kengen-green" : "text-kengen-red"}
                >
                  {f.ok ? "✓" : "✗"}
                </span>{" "}
                {f.message}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section
        title="Sessions"
        description="Sessions registered while the toolkit is enabled. Invalidate forces that user to sign in again."
      >
        <div className="mb-2 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-400/40 text-meta">
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Browser</th>
                <th className="py-2 pr-3">Platform</th>
                <th className="py-2 pr-3">Last seen</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-meta">
                    No registered sessions yet. Sign out and sign in again while
                    the toolkit is enabled.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.sessionId} className="border-b border-neutral-200">
                    <td className="py-2 pr-3 font-mono text-xs">{s.userId}</td>
                    <td className="py-2 pr-3">{s.browser}</td>
                    <td className="py-2 pr-3">{s.platform}</td>
                    <td className="py-2 pr-3">
                      {new Date(s.lastSeenAt).toLocaleString()}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-kengen-red underline"
                        onClick={() =>
                          openConfirm({
                            title: "Invalidate Session",
                            token: "INVALIDATE",
                            danger: true,
                            summary: `Force sign-out for session ${s.sessionId.slice(0, 8)}… (${s.browser} on ${s.platform}).`,
                            action: (reason) =>
                              apiSend(
                                "/api/v1/development/sessions/invalidate",
                                "POST",
                                {
                                  confirm: "INVALIDATE",
                                  reason,
                                  sessionId: s.sessionId,
                                }
                              ),
                          })
                        }
                      >
                        Invalidate
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <ToolButton
          variant="danger"
          onClick={() =>
            openConfirm({
              title: "Invalidate All Sessions",
              token: "INVALIDATE",
              danger: true,
              summary:
                "Sign out every registered toolkit session. You will need to log in again.",
              action: (reason) =>
                apiSend("/api/v1/development/sessions/invalidate", "POST", {
                  confirm: "INVALIDATE",
                  reason,
                  all: true,
                }),
            })
          }
        >
          Invalidate All Sessions
        </ToolButton>
      </Section>

      <Section
        title="Environment"
        description="Deployment diagnostics. Secrets are never shown — only Configured / Missing."
      >
        {env ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            {(
              [
                ["Application Version", env.applicationVersion],
                ["Git Commit", env.gitCommit],
                ["Build Time", env.buildTime],
                ["NODE_ENV", env.nodeEnv ?? "—"],
                ["Repository Driver", env.repositoryDriver],
                ["Current FY", env.currentFyLabel ?? "—"],
                ["Open FY", env.openFyLabel ?? "—"],
                ["Database", env.databaseLabel],
                ["Migration Version", env.migrationVersion],
                [
                  "Connection Healthy",
                  env.connectionHealthy ? "Yes" : "No",
                ],
                ["Session Secret", env.sessionSecret],
                ["SMTP", env.smtp],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                className="flex gap-2 border-b border-neutral-200 py-1"
              >
                <dt className="w-44 shrink-0 text-meta">{k}</dt>
                <dd className="font-mono text-kengen-navy">{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-meta">Environment details unavailable.</p>
        )}
        {env?.repositoryDriver === "mock" ? (
          <div className="mt-4">
            <ToolButton
              onClick={() =>
                openConfirm({
                  title: "Reseed Mock Database",
                  token: "RESEED",
                  danger: true,
                  summary:
                    "Wipe and reload the in-memory mock store from seed data.",
                  action: (reason) =>
                    apiSend("/api/v1/development/database/reseed", "POST", {
                      confirm: "RESEED",
                      reason,
                    }),
                })
              }
            >
              Reseed Demo Data
            </ToolButton>
          </div>
        ) : (
          <p className="mt-4 border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700">
            <strong>Reseed is disabled</strong> for the SQL driver. From a
            terminal run{" "}
            <code className="font-mono text-xs">npm run db:seed</code>. The UI
            never reseeds production SQL.
          </p>
        )}
      </Section>

      {/* Remount modal each open so checkbox/reason reset cleanly */}
      {confirm ? (
        <ConfirmModal
          key={`${confirm.title}-${confirm.token}`}
          state={confirm}
          onClose={() => setConfirm(null)}
        />
      ) : null}
    </PageShell>
  );
}
