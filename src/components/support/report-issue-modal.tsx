"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiSend } from "@/lib/client-api";
import type { SupportIssue } from "@/domain/entities";
import {
  SUPPORT_ISSUE_CATEGORIES,
  SUPPORT_ISSUE_PRIORITIES,
} from "@/domain/support-issue";
import { APP_VERSION } from "@/lib/shared/app-version";

function pageLabelFromPath(pathname: string): string {
  if (pathname.startsWith("/budgets/") && pathname !== "/budgets/create") {
    return "Budget Details";
  }
  if (pathname === "/budgets/create") return "Create Budget";
  if (pathname.startsWith("/budgets")) return "My Budget Plans";
  if (pathname.startsWith("/approvals")) return "Approvals";
  if (pathname.startsWith("/finance")) return "Finance";
  if (pathname.startsWith("/admin")) return "Administration";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/notifications")) return "Notifications";
  if (pathname.startsWith("/audit")) return "Audit Trail";
  if (pathname.startsWith("/home")) return "Dashboard";
  if (pathname.startsWith("/support")) return "Support Issues";
  return "Portal";
}

function detectBrowser(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua)) return "Safari";
  return "Unknown";
}

export type ReportIssueContext = {
  budgetPlanId?: string | null;
  fiscalYearId?: string | null;
  costCenterId?: string | null;
  correlationId?: string | null;
  budgetLabel?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  context?: ReportIssueContext;
};

export function ReportIssueModal({ open, onClose, context }: Props) {
  const pathname = usePathname() ?? "";
  const [title, setTitle] = useState("");
  const [category, setCategory] =
    useState<(typeof SUPPORT_ISSUE_CATEGORIES)[number]>("General");
  const [priority, setPriority] =
    useState<(typeof SUPPORT_ISSUE_PRIORITIES)[number]>("Medium");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<{
    fileName: string;
    contentType: string;
    contentBase64: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SupportIssue | null>(null);

  const auto = useMemo(
    () => ({
      pagePath: pathname,
      pageLabel: pageLabelFromPath(pathname),
      browser: detectBrowser(),
      appVersion: APP_VERSION,
      budgetPlanId: context?.budgetPlanId ?? null,
      fiscalYearId: context?.fiscalYearId ?? null,
      costCenterId: context?.costCenterId ?? null,
      correlationId: context?.correlationId ?? null,
      budgetLabel: context?.budgetLabel ?? null,
    }),
    [pathname, context]
  );

  useEffect(() => {
    if (!open) {
      setTitle("");
      setCategory("General");
      setPriority("Medium");
      setDescription("");
      setScreenshot(null);
      setError(null);
      setSubmitted(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-issue-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-neutral-400 bg-white p-5 shadow-lg"
      >
        {submitted ? (
          <>
            <h2
              id="report-issue-title"
              className="text-lg font-medium text-kengen-navy"
            >
              Issue Reported
            </h2>
            <p className="mt-3 text-body text-neutral-700">
              Your report has been sent to ICT Support.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-24 text-meta">Reference</dt>
                <dd className="font-mono font-medium text-kengen-navy">
                  {submitted.referenceNumber}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-24 text-meta">Status</dt>
                <dd>{submitted.status}</dd>
              </div>
            </dl>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="bg-kengen-navy px-4 py-2 text-white"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <h2
              id="report-issue-title"
              className="text-lg font-medium text-kengen-navy"
            >
              Report an Issue
            </h2>
            <p className="mt-1 text-meta text-neutral-600">
              Describe the problem. Technical context is captured automatically.
            </p>

            <label className="mt-4 block text-meta">
              Title *
              <input
                className="mt-1 w-full border border-neutral-400 px-3 py-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
              />
            </label>

            <label className="mt-3 block text-meta">
              Category *
              <select
                className="mt-1 w-full border border-neutral-400 px-3 py-2"
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as (typeof SUPPORT_ISSUE_CATEGORIES)[number]
                  )
                }
              >
                {SUPPORT_ISSUE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="mt-3">
              <legend className="text-meta">Priority</legend>
              <div className="mt-1 flex gap-4 text-sm">
                {SUPPORT_ISSUE_PRIORITIES.map((p) => (
                  <label key={p} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="priority"
                      checked={priority === p}
                      onChange={() => setPriority(p)}
                    />
                    {p}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-3 block text-meta">
              Description *
              <textarea
                className="mt-1 w-full border border-neutral-400 px-3 py-2"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={4000}
                required
              />
            </label>

            <label className="mt-3 block text-meta">
              Attachment (screenshot)
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setScreenshot(null);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = String(reader.result ?? "");
                    const base64 = result.includes(",")
                      ? result.split(",")[1]!
                      : result;
                    setScreenshot({
                      fileName: file.name,
                      contentType: file.type || "image/png",
                      contentBase64: base64,
                    });
                  };
                  reader.readAsDataURL(file);
                }}
              />
            </label>

            <div className="mt-4 border border-neutral-300 bg-neutral-50 p-3 text-sm">
              <p className="font-medium text-kengen-navy">Auto-captured</p>
              <ul className="mt-2 space-y-1 text-meta text-neutral-700">
                <li>Current page: {auto.pageLabel}</li>
                {auto.budgetLabel ? <li>Budget: {auto.budgetLabel}</li> : null}
                <li>Browser: {auto.browser}</li>
                <li>Version: v{auto.appVersion}</li>
              </ul>
            </div>

            {error ? (
              <p className="mt-3 text-sm text-kengen-red">{error}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 text-neutral-700 hover:underline"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bg-kengen-navy px-4 py-2 text-white disabled:opacity-40"
                disabled={busy || title.trim().length < 3 || description.trim().length < 10}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const data = await apiSend<SupportIssue>(
                        "/api/v1/support-issues",
                        "POST",
                        {
                          title: title.trim(),
                          description: description.trim(),
                          category,
                          priority,
                          pagePath: auto.pagePath,
                          pageLabel: auto.pageLabel,
                          budgetPlanId: auto.budgetPlanId,
                          fiscalYearId: auto.fiscalYearId,
                          costCenterId: auto.costCenterId,
                          browser: auto.browser,
                          appVersion: auto.appVersion,
                          correlationId: auto.correlationId,
                          screenshot,
                        }
                      );
                      setSubmitted(data);
                    } catch (e) {
                      setError(
                        e instanceof Error ? e.message : "Failed to submit"
                      );
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Submit Report
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
