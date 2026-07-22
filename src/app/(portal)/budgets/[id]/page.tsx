"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Download,
  GitBranch,
  Pencil,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { ApprovalTimeline } from "@/components/budget/approval-timeline";
import { ActionLink, Button } from "@/components/ui/button";
import { ApiError, apiGet, apiSend } from "@/lib/client-api";
import type {
  ApprovalHistoryEntry,
  BudgetPlan,
  GlAccount,
  User,
  WorkflowHistoryEntry,
} from "@/domain/entities";
import type { VersionCompareResult } from "@/lib/shared/version-compare-types";
import { formatCurrency } from "@/lib/utils";
import { budgetCategoryLabel } from "@/domain/constants/budget-types";
import { latestApprovalOutcome } from "@/domain/rules/approval-outcome";
import { resolveOrgRole } from "@/domain/rules/org-role";
import { reviewStageLabel } from "@/domain/value-objects/budget-status";
import type { OrgRole } from "@/domain/rules/org-role";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function BudgetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Notification deep-link (?action=approve): focus the Decision panel so the
  // approver lands on the exact task, not just the page.
  const deepLinkAction = searchParams?.get("action") ?? null;
  const decisionRef = useRef<HTMLDivElement>(null);
  const id = String(params?.id ?? "");
  const [plan, setPlan] = useState<BudgetPlan | null>(null);
  const [history, setHistory] = useState<ApprovalHistoryEntry[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowHistoryEntry[]>([]);
  const [compare, setCompare] = useState<VersionCompareResult | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [orgRole, setOrgRole] = useState<OrgRole | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [refUsers, setRefUsers] = useState<User[]>([]);
  const [glMap, setGlMap] = useState<Map<string, GlAccount>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const me = await apiGet<{
        user: User;
        orgRole: OrgRole;
      }>("/api/v1/me");
      setUser(me.user);
      setOrgRole(me.orgRole);
      const detail = await apiGet<{
        plan: BudgetPlan;
        history: ApprovalHistoryEntry[];
      }>(`/api/v1/budget-plans/${id}/history`);
      setPlan(detail.plan);
      setHistory(detail.history);
      const [wf, cmp] = await Promise.all([
        apiGet<WorkflowHistoryEntry[]>(
          `/api/v1/budget-plans/${id}/workflow`
        ).catch(() => [] as WorkflowHistoryEntry[]),
        apiGet<VersionCompareResult>(
          `/api/v1/budget-plans/${id}/compare`
        ).catch(() => null),
      ]);
      setWorkflow(wf);
      setCompare(cmp);
      const ref = await apiGet<{ users: User[]; glAccounts: GlAccount[] }>(
        "/api/v1/reference"
      );
      setNames(Object.fromEntries(ref.users.map((u) => [u.id, u.name])));
      setRefUsers(ref.users);
      setGlMap(new Map(ref.glAccounts.map((g) => [g.id, g])));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Access denied");
      if (
        e instanceof ApiError &&
        (e.status === 403 ||
          e.message.toLowerCase().includes("access") ||
          e.message.toLowerCase().includes("forbidden"))
      ) {
        router.push("/access-denied");
      }
    }
  }, [id, router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const deepLinkFocused = useRef(false);
  useEffect(() => {
    if (deepLinkFocused.current || deepLinkAction !== "approve") return;
    if (!plan || !user) return;
    const isPendingApprover =
      plan.status === "InApproval" &&
      plan.currentApproverId === user.id &&
      user.permissionCodes.includes("budget.approve");
    if (!isPendingApprover) return;
    deepLinkFocused.current = true;
    decisionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [deepLinkAction, plan, user]);

  async function onApprove() {
    if (!plan) return;
    if (
      !window.confirm(
        "Approve this budget and advance it to the next step?"
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/budget-plans/${plan.id}/approve`, "POST", {
        comment: approveComment.trim() || null,
      });
      setApproveComment("");
      setNotice("Budget approved.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReturn() {
    if (!plan) return;
    if (!comment.trim()) {
      setError("A reason is required to return for revision");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/budget-plans/${plan.id}/return`, "POST", {
        reason: comment,
      });
      setComment("");
      setNotice("Budget returned for revision.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Return failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReject() {
    if (!plan) return;
    if (!comment.trim()) {
      setError("Rejection reason is required");
      return;
    }
    if (
      !window.confirm(
        "Reject permanently? The owner cannot edit or resubmit this budget."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/budget-plans/${plan.id}/reject`, "POST", {
        reason: comment,
      });
      setComment("");
      setNotice("Budget rejected.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  }

  async function onResubmit() {
    if (!plan) return;
    if (!window.confirm("Resubmit this budget for approval?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiSend(`/api/v1/budget-plans/${plan.id}/submit`, "POST");
      setNotice("Budget resubmitted for approval.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resubmit failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadCsv() {
    if (!plan) return;
    void (async () => {
      const res = await fetch(`/api/v1/budget-plans/${plan.id}/sap-export`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!res.ok) {
        let detail = `Export failed (${res.status})`;
        try {
          const body = (await res.json()) as {
            error?: { message?: string };
          };
          if (body.error?.message) detail = body.error.message;
        } catch {
          /* keep status fallback */
        }
        setError(detail);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `sap-budget-${plan.id}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    })();
  }

  if (!plan || !user) {
    return <p className="text-meta text-neutral-700">{error ?? "Loading…"}</p>;
  }

  const total = plan.lines.reduce((s, l) => s + l.amount, 0);
  const isOwner = plan.ownerId === user.id;
  const isCurrentApprover =
    plan.status === "InApproval" && plan.currentApproverId === user.id;
  const canReview =
    isCurrentApprover && user.permissionCodes.includes("budget.approve");
  const canReturn = canReview;
  const canReject =
    canReview &&
    orgRole === "gm" &&
    user.permissionCodes.includes("budget.reject");
  const canEdit =
    isOwner &&
    (plan.status === "Draft" || plan.status === "ReturnedForRevision");
  const canResubmit =
    isOwner &&
    plan.status === "ReturnedForRevision" &&
    user.permissionCodes.includes("budget.submit");
  const outcome = latestApprovalOutcome(history);
  const currentApprover = plan.currentApproverId
    ? refUsers.find((u) => u.id === plan.currentApproverId)
    : null;
  const currentApproverRole = currentApprover
    ? resolveOrgRole(currentApprover)
    : null;
  const stageLabel =
    plan.status === "InApproval"
      ? reviewStageLabel(
          plan.status,
          currentApproverRole === "gm" || currentApproverRole === "manager"
            ? currentApproverRole
            : null
        )
      : null;

  return (
    <div>
      <PageHeader
        title="Budget Details"
        description={
          plan.versionLabel
            ? `${plan.versionLabel} · ${budgetCategoryLabel(plan.budgetCategory)}`
            : `${budgetCategoryLabel(plan.budgetCategory)} · ${plan.id}`
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <ActionLink
                href={`/budgets/create?edit=${plan.id}`}
                variant={
                  plan.status === "ReturnedForRevision"
                    ? "warning"
                    : "secondary"
                }
                icon={Pencil}
                size="default"
              >
                {plan.status === "ReturnedForRevision"
                  ? "Edit & revise"
                  : "Edit Draft"}
              </ActionLink>
            ) : null}
            {canResubmit ? (
              <Button
                type="button"
                variant="primary"
                icon={Send}
                loading={busy}
                disabled={busy}
                onClick={() => void onResubmit()}
              >
                Resubmit
              </Button>
            ) : null}
            {(plan.status === "Finalized" || plan.status === "Approved") &&
            isOwner &&
            user.permissionCodes.includes("budget.create") ? (
              <Button
                type="button"
                variant="primary"
                icon={GitBranch}
                loading={busy}
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt("Amendment reason (required):");
                  if (!reason?.trim()) return;
                  void (async () => {
                    setBusy(true);
                    try {
                      const next = await apiSend<BudgetPlan>(
                        `/api/v1/budget-plans/${plan.id}/amend`,
                        "POST",
                        { reason: reason.trim() }
                      );
                      router.push(`/budgets/${next.id}`);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Amendment failed"
                      );
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Create Amendment
              </Button>
            ) : null}
            {(plan.status === "Finalized" || plan.status === "Approved") &&
            user?.permissionCodes.includes("report.export") ? (
              <Button
                type="button"
                variant="secondary"
                icon={Download}
                onClick={downloadCsv}
              >
                Export SAP Package
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="mb-3 rounded border border-kengen-red/40 bg-red-50 px-3 py-2 text-body text-kengen-red">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-3 rounded border border-kengen-green/40 bg-[rgba(0,105,62,0.08)] px-3 py-2 text-body text-kengen-green">
          {notice}
        </div>
      ) : null}

      {plan.status === "Claimed" ? (
        <div className="mb-3 rounded border border-indigo-300 bg-indigo-50 px-3 py-2 text-body">
          <p className="font-medium text-indigo-900">Locked — Finance review</p>
        </div>
      ) : null}

      {plan.status === "PendingFinanceReview" ? (
        <div className="mb-3 rounded border border-violet-300 bg-violet-50 px-3 py-2 text-body">
          <p className="font-medium text-violet-900">Awaiting Finance claim</p>
        </div>
      ) : null}

      {plan.status === "Rejected" && outcome ? (
        <div className="mb-3 rounded border border-kengen-red/30 bg-red-50 px-3 py-2 text-body">
          <p className="font-medium text-kengen-red">Rejected</p>
          <p className="mt-1 text-meta text-neutral-800">
            Rejected by:{" "}
            <strong>{names[outcome.performedBy] ?? outcome.performedBy}</strong>
          </p>
          <p className="text-meta text-neutral-800">
            Rejection reason: <strong>{outcome.reason}</strong>
          </p>
          <p className="text-meta text-neutral-700">
            Rejection date: {fmtDate(outcome.timestamp)}
          </p>
        </div>
      ) : null}

      {plan.status === "ReturnedForRevision" && outcome ? (
        <div className="mb-3 rounded border border-kengen-amber/30 bg-amber-50 px-3 py-2 text-body">
          <p className="font-medium text-kengen-amber">Returned for correction</p>
          <p className="mt-1 text-meta text-neutral-800">
            Returned by:{" "}
            <strong>{names[outcome.performedBy] ?? outcome.performedBy}</strong>
          </p>
          <p className="text-meta text-neutral-800">
            Return reason: <strong>{outcome.reason}</strong>
          </p>
          <p className="text-meta text-neutral-700">
            Return date: {fmtDate(outcome.timestamp)}
          </p>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-3 text-body">
        {stageLabel ? (
          <span className="inline-flex items-center rounded border border-kengen-blue/40 bg-blue-50 px-1.5 py-0.5 text-meta font-medium text-kengen-blue">
            {stageLabel}
          </span>
        ) : (
          <StatusChip status={plan.status} />
        )}
        <span>Total: {formatCurrency(total)}</span>
        <span className="text-meta text-neutral-700">
          Owner: {names[plan.ownerId] ?? plan.ownerId}
        </span>
        {plan.currentApproverId ? (
          <span className="text-meta text-neutral-700">
            Current approver: {names[plan.currentApproverId] ?? plan.currentApproverId}
          </span>
        ) : null}
      </div>

      {plan.description ? (
        <div className="mb-4 rounded-2xl border border-white/50 bg-white/70 px-3 py-2 text-body shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md">
          <p className="text-meta uppercase text-neutral-700">Description</p>
          <p className="mt-1 whitespace-pre-wrap text-kengen-navy">
            {plan.description}
          </p>
        </div>
      ) : null}

      <div className="mb-4 overflow-x-auto rounded border border-neutral-400/30 bg-white">
        <table className="w-full text-left text-body">
          <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Cost Element</th>
              <th className="px-2 py-1.5">Description</th>
              <th className="px-2 py-1.5">Amount</th>
            </tr>
          </thead>
          <tbody>
            {plan.lines.map((line) => {
              const gl = glMap.get(line.glAccountId);
              return (
                <tr key={line.id} className="border-t border-neutral-400/20">
                  <td className="px-2 py-1.5">{line.lineNumber}</td>
                  <td className="px-2 py-1.5">{gl?.code ?? "—"}</td>
                  <td className="px-2 py-1.5">{gl?.description ?? "—"}</td>
                  <td className="px-2 py-1.5">{formatCurrency(line.amount)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mb-4 rounded border border-neutral-400/30 bg-white p-3">
        <p className="mb-3 text-sm font-medium text-kengen-navy">
          Approval Timeline
        </p>
        <ApprovalTimeline
          history={history}
          names={names}
          currentStatus={plan.status}
        />
      </div>

      <div className="mb-4 rounded border border-neutral-400/30 bg-white p-3">
        <p className="mb-3 text-sm font-medium text-kengen-navy">
          Workflow history
        </p>
        {workflow.length === 0 ? (
          <p className="text-meta text-neutral-600">No workflow events yet.</p>
        ) : (
          <ul className="space-y-2 text-body">
            {workflow.map((w) => (
              <li
                key={w.id}
                className="border-b border-neutral-200/80 pb-2 last:border-0"
              >
                <p className="font-medium text-kengen-navy">
                  {w.stage} · {w.action}
                </p>
                <p className="text-meta text-neutral-700">
                  {names[w.actorId] ?? w.actorId} · {fmtDate(w.timestamp)}
                </p>
                {w.comment ? (
                  <p className="mt-0.5 text-meta text-neutral-800">{w.comment}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {compare ? (
        <div className="mb-4 rounded border border-neutral-400/30 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-kengen-navy">
            Version compare
          </p>
          <p className="mb-2 text-meta text-neutral-700">
            {compare.fromLabel ?? "Prior"} → {compare.toLabel ?? "Current"} ·
            Delta {formatCurrency(compare.totalDelta)}
          </p>
          <p className="mb-3 text-meta text-neutral-600">
            Lines +{compare.summary.linesAdded} / −{compare.summary.linesRemoved}{" "}
            / ~{compare.summary.linesModified}
            {compare.summary.headerFieldsChanged
              ? ` · ${compare.summary.headerFieldsChanged} header field(s) changed`
              : ""}
          </p>
          {compare.lineDiffs.filter((d) => d.change !== "unchanged").length >
          0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body">
                <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
                  <tr>
                    <th className="px-2 py-1.5">Change</th>
                    <th className="px-2 py-1.5">Cost Element</th>
                    <th className="px-2 py-1.5">From</th>
                    <th className="px-2 py-1.5">To</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.lineDiffs
                    .filter((d) => d.change !== "unchanged")
                    .map((d) => {
                      const gl = glMap.get(d.glAccountId);
                      return (
                        <tr
                          key={`${d.glAccountId}-${d.change}`}
                          className="border-t border-neutral-400/20"
                        >
                          <td className="px-2 py-1.5 capitalize">{d.change}</td>
                          <td className="px-2 py-1.5">
                            {gl?.code ?? d.glCode ?? d.glAccountId}
                          </td>
                          <td className="px-2 py-1.5">
                            {d.fromAmount != null
                              ? formatCurrency(d.fromAmount)
                              : "—"}
                          </td>
                          <td className="px-2 py-1.5">
                            {d.toAmount != null
                              ? formatCurrency(d.toAmount)
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-meta text-neutral-600">
              No line-item changes versus the prior version.
            </p>
          )}
        </div>
      ) : null}

      {canReview ? (
        <div
          ref={decisionRef}
          className={`rounded border bg-white p-3 ${
            deepLinkAction === "approve"
              ? "border-kengen-green ring-2 ring-kengen-green/30"
              : "border-neutral-400/30"
          }`}
        >
          <p className="mb-2 text-sm font-medium text-kengen-navy">Decision</p>
          <label className="mb-3 block text-meta">
            Comment
            <textarea
              className="glass-select mt-1 min-h-[2.5rem] w-full resize-y"
              rows={2}
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              icon={Check}
              loading={busy}
              disabled={busy}
              onClick={() => void onApprove()}
            >
              Approve
            </Button>
          </div>
          {canReturn ? (
            <>
              <label className="block text-meta">
                Return reason
                <textarea
                  className="glass-select mt-1 min-h-[3.5rem] w-full resize-y"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Required"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="warning"
                  icon={RotateCcw}
                  loading={busy}
                  disabled={busy}
                  onClick={() => void onReturn()}
                >
                  Return
                </Button>
                {canReject ? (
                  <Button
                    type="button"
                    variant="danger"
                    icon={X}
                    loading={busy}
                    disabled={busy}
                    onClick={() => void onReject()}
                  >
                    Reject
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
