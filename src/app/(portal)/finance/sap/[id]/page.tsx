"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, FileSpreadsheet, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageShell } from "@/components/shared/page-shell";
import { ActionLink, Button } from "@/components/ui/button";
import { apiGet } from "@/lib/client-api";
import type { User } from "@/domain/entities";
import { formatCurrency } from "@/lib/utils";

type SapForm = {
  budgetNumber: string;
  sapReference: string;
  fiscalYear: number;
  department: string;
  costCenterCode: string;
  costCenterName: string;
  responsiblePerson: string;
  glLines: { glCode: string; glDescription: string; amount: number }[];
  requestedAmount: number;
  approvedAmount: number;
  approvals: {
    role: "Manager" | "GM";
    name: string;
    date: string;
    comment: string | null;
  }[];
  submissionDate: string | null;
  generationDate: string;
};

export default function SapCompliancePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const planId = params?.id ?? "";
  const [form, setForm] = useState<SapForm | null>(null);
  const [canExport, setCanExport] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    void (async () => {
      try {
        const me = await apiGet<{ user: User }>("/api/v1/me");
        if (!me.user.permissionCodes.includes("finance.view")) {
          router.replace("/access-denied");
          return;
        }
        setCanExport(me.user.permissionCodes.includes("report.export"));
        setForm(
          await apiGet<SapForm>(`/api/v1/budget-plans/${planId}/sap-form`)
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load SAP form");
      }
    })();
  }, [planId, router]);

  const download = (format: "csv" | "excel") => {
    window.location.href = `/api/v1/budget-plans/${planId}/sap-form?format=${format}`;
  };

  const printPdf = async () => {
    // Audit the PDF download server-side before opening the print dialog
    try {
      await fetch(`/api/v1/budget-plans/${planId}/sap-form?format=pdf`);
    } catch {
      // printing proceeds even if audit call fails
    }
    window.print();
  };

  if (error) {
    return (
      <PageShell>
        <p className="text-body text-kengen-red">{error}</p>
      </PageShell>
    );
  }
  if (!form) {
    return (
      <PageShell>
        <p className="text-meta">Loading SAP compliance form…</p>
      </PageShell>
    );
  }

  const manager = form.approvals.find((a) => a.role === "Manager");
  const gm = form.approvals.find((a) => a.role === "GM");

  return (
    <PageShell>
      <PageHeader
        title="SAP Compliance Form"
        description={form.sapReference}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <ActionLink
              href="/finance"
              variant="secondary"
              icon={ArrowLeft}
              size="default"
            >
              Back to Finance
            </ActionLink>
            {canExport ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  icon={Download}
                  onClick={() => download("csv")}
                >
                  Download CSV
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={FileSpreadsheet}
                  onClick={() => download("excel")}
                >
                  Download Excel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={Printer}
                  onClick={() => void printPdf()}
                >
                  Print
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <div className="rounded border border-neutral-400/30 bg-white p-4">
        <div className="mb-4 grid gap-3 text-body sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Budget Number", form.budgetNumber],
            ["SAP Reference", form.sapReference],
            ["Financial Year", String(form.fiscalYear)],
            ["Department", form.department],
            [
              "Cost Center",
              `${form.costCenterName} (${form.costCenterCode})`,
            ],
            ["Responsible Person", form.responsiblePerson],
            [
              "Submission Date",
              form.submissionDate
                ? new Date(form.submissionDate).toLocaleString()
                : "—",
            ],
            ["Requested Amount", formatCurrency(form.requestedAmount)],
            ["Approved Amount", formatCurrency(form.approvedAmount)],
            ["Manager", manager?.name ?? "—"],
            ["General Manager", gm?.name ?? "—"],
            [
              "Generation Date",
              new Date(form.generationDate).toLocaleString(),
            ],
          ].map(([label, value]) => (
            <p key={label}>
              <span className="text-meta text-neutral-700">{label}</span>
              <br />
              <span className="font-medium text-kengen-navy">{value}</span>
            </p>
          ))}
        </div>

        <p className="mb-1 text-meta font-medium uppercase text-neutral-700">
          Approval timeline
        </p>
        <ul className="mb-4 space-y-1 text-body">
          {form.approvals.map((a, i) => (
            <li
              key={`${a.role}-${i}`}
              className="flex flex-wrap items-center gap-2 border-b border-neutral-400/20 py-1"
            >
              <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-meta font-medium">
                {a.role}
              </span>
              <span className="font-medium">{a.name}</span>
              <span className="text-meta text-neutral-700">
                {new Date(a.date).toLocaleString()}
              </span>
              {a.comment ? (
                <span className="text-meta text-neutral-700">
                  “{a.comment}”
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="mb-1 text-meta font-medium uppercase text-neutral-700">
          GL breakdown
        </p>
        <table className="w-full text-left text-body">
          <thead className="bg-neutral-100 text-meta uppercase text-neutral-700">
            <tr>
              <th className="px-2 py-1.5">GL Code</th>
              <th className="px-2 py-1.5">Description</th>
              <th className="px-2 py-1.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {form.glLines.map((l, i) => (
              <tr key={`${l.glCode}-${i}`} className="border-t border-neutral-400/20">
                <td className="px-2 py-1.5">{l.glCode}</td>
                <td className="px-2 py-1.5">{l.glDescription}</td>
                <td className="px-2 py-1.5 text-right">
                  {formatCurrency(l.amount)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-neutral-400/40 font-semibold">
              <td className="px-2 py-1.5" colSpan={2}>
                Total
              </td>
              <td className="px-2 py-1.5 text-right">
                {formatCurrency(form.approvedAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
