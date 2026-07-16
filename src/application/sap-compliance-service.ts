import type { User } from "@/domain/entities";
import type {
  IApprovalHistoryRepository,
  IAuditLogRepository,
  IBudgetPlanRepository,
  ICostCenterRepository,
  IDepartmentRepository,
  IFiscalYearRepository,
  IGlAccountRepository,
  ISapPackageRepository,
  IUserRepository,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";
import {
  AuthorizationError,
  AuthorizationService,
} from "./authorization-service";

export type SapGlLine = {
  glCode: string;
  glDescription: string;
  amount: number;
};

export type SapApprovalStep = {
  role: "Manager" | "GM";
  name: string;
  date: string;
  comment: string | null;
};

export type SapComplianceForm = {
  budgetNumber: string;
  sapReference: string;
  fiscalYear: number;
  department: string;
  costCenterCode: string;
  costCenterName: string;
  responsiblePerson: string;
  glLines: SapGlLine[];
  requestedAmount: number;
  approvedAmount: number;
  approvals: SapApprovalStep[];
  submissionDate: string | null;
  generationDate: string;
};

export class SapComplianceService {
  constructor(
    private readonly budgets: IBudgetPlanRepository,
    private readonly users: IUserRepository,
    private readonly departments: IDepartmentRepository,
    private readonly costCenters: ICostCenterRepository,
    private readonly fiscalYears: IFiscalYearRepository,
    private readonly glAccounts: IGlAccountRepository,
    private readonly history: IApprovalHistoryRepository,
    private readonly audits: IAuditLogRepository,
    private readonly authz: AuthorizationService,
    private readonly sapPackages: ISapPackageRepository
  ) {}

  /** Finance-only view of the compliance form for a finalized budget. */
  async getForm(actor: User, planId: string): Promise<SapComplianceForm> {
    this.authz.assertPermission(actor, "finance.view");
    const plan = await this.budgets.getById(planId);
    if (!plan) throw new Error("Budget not found");

    const frozen = await this.sapPackages.getByBudgetPlanId(planId);
    if (frozen) {
      return JSON.parse(frozen.packageJson) as SapComplianceForm;
    }

    if (plan.status !== "Finalized" && plan.status !== "Approved") {
      throw new AuthorizationError(
        "SAP compliance forms exist only for finalized budgets"
      );
    }

    const [cc, fy, userMap, gls, entries] = await Promise.all([
      this.costCenters.getById(plan.costCenterId),
      this.fiscalYears.getById(plan.fiscalYearId),
      this.users.getUsersByIdMap(),
      this.glAccounts.getAll(),
      this.history.listByBudgetId(plan.id),
    ]);
    const dept = cc ? await this.departments.getById(cc.departmentId) : null;
    const glMap = new Map(gls.map((g) => [g.id, g]));

    const approvalEntries = entries
      .filter(
        (e) => e.action === "Approved" || e.action === "SubmittedAndCompleted"
      )
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const approvals: SapApprovalStep[] = approvalEntries.map((e, i) => ({
      role: i === approvalEntries.length - 1 ? "GM" : "Manager",
      name: userMap.get(e.performedBy)?.name ?? e.performedBy,
      date: e.timestamp,
      comment: e.comment,
    }));

    const total = plan.lines.reduce((s, l) => s + l.amount, 0);

    return {
      budgetNumber: plan.versionLabel ?? `BGT-${plan.id.replace(/-/g, "").slice(0, 10).toUpperCase()}`,
      sapReference:
        plan.sapVersion && plan.sapVersion !== "V1"
          ? plan.sapVersion
          : buildSapReference(
              fy?.yearLabel ?? 0,
              cc?.code ?? "CC",
              plan.id
            ),
      fiscalYear: fy?.yearLabel ?? 0,
      department: dept?.name ?? "Unknown",
      costCenterCode: cc?.code ?? "",
      costCenterName: cc?.name ?? "",
      responsiblePerson: userMap.get(plan.ownerId)?.name ?? plan.ownerId,
      glLines: plan.lines.map((l) => ({
        glCode: glMap.get(l.glAccountId)?.code ?? l.glAccountId,
        glDescription: glMap.get(l.glAccountId)?.description ?? "",
        amount: l.amount,
      })),
      requestedAmount: total,
      approvedAmount: total,
      approvals,
      submissionDate: plan.submittedAt,
      generationDate: new Date().toISOString(),
    };
  }

  /** Finance-only download; every download is audited and immutable. */
  async getFormForDownload(
    actor: User,
    planId: string,
    format: "csv" | "excel" | "pdf",
    correlationId = newId("corr")
  ): Promise<SapComplianceForm> {
    this.authz.assertPermission(actor, "finance.view");
    this.authz.assertPermission(actor, "report.export");
    const frozen = await this.sapPackages.getByBudgetPlanId(planId);
    const form = frozen
      ? (JSON.parse(frozen.packageJson) as SapComplianceForm)
      : await this.getForm(actor, planId);
    const action =
      format === "csv"
        ? "SapCsvDownload"
        : format === "excel"
          ? "SapExcelDownload"
          : "SapPdfDownload";
    await this.audits.append({
      id: newId("audit"),
      entity: "BudgetPlan",
      entityId: planId,
      action,
      performedBy: actor.id,
      ipAddress: null,
      correlationId,
      beforeJson: null,
      afterJson: JSON.stringify({
        sapReference: form.sapReference,
        format,
      }),
      timestamp: new Date().toISOString(),
    });
    return form;
  }
}

export function buildSapReference(
  fyLabel: number,
  ccCode: string,
  planId: string
): string {
  return `SAP-${fyLabel}-${ccCode}-${planId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function sapFormToCsv(form: SapComplianceForm): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: string[][] = [
    ["SAP Compliance Form"],
    ["Budget Number", form.budgetNumber],
    ["SAP Reference", form.sapReference],
    ["Financial Year", String(form.fiscalYear)],
    ["Department", form.department],
    ["Cost Center", `${form.costCenterCode} ${form.costCenterName}`],
    ["Responsible Person", form.responsiblePerson],
    ["Submission Date", form.submissionDate ?? ""],
    ["Requested Amount", String(form.requestedAmount)],
    ["Approved Amount", String(form.approvedAmount)],
    ["Generation Date", form.generationDate],
    [],
    ["Approvals"],
    ["Role", "Name", "Date", "Comment"],
    ...form.approvals.map((a) => [a.role, a.name, a.date, a.comment ?? ""]),
    [],
    ["GL Breakdown"],
    ["GL Code", "Description", "Amount"],
    ...form.glLines.map((l) => [l.glCode, l.glDescription, String(l.amount)]),
  ];
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}

/** HTML table document — Excel opens .xls HTML natively. */
export function sapFormToExcelHtml(form: SapComplianceForm): string {
  const esc = (v: unknown) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const row = (cells: unknown[], header = false) =>
    `<tr>${cells
      .map((c) => (header ? `<th>${esc(c)}</th>` : `<td>${esc(c)}</td>`))
      .join("")}</tr>`;
  return `<html><head><meta charset="utf-8" /></head><body>
<table border="1">
${row(["SAP Compliance Form"], true)}
${row(["Budget Number", form.budgetNumber])}
${row(["SAP Reference", form.sapReference])}
${row(["Financial Year", form.fiscalYear])}
${row(["Department", form.department])}
${row(["Cost Center", `${form.costCenterCode} ${form.costCenterName}`])}
${row(["Responsible Person", form.responsiblePerson])}
${row(["Submission Date", form.submissionDate ?? ""])}
${row(["Requested Amount", form.requestedAmount])}
${row(["Approved Amount", form.approvedAmount])}
${row(["Generation Date", form.generationDate])}
</table>
<br />
<table border="1">
${row(["Role", "Name", "Date", "Comment"], true)}
${form.approvals.map((a) => row([a.role, a.name, a.date, a.comment ?? ""])).join("\n")}
</table>
<br />
<table border="1">
${row(["GL Code", "Description", "Amount"], true)}
${form.glLines.map((l) => row([l.glCode, l.glDescription, l.amount])).join("\n")}
</table>
</body></html>`;
}
