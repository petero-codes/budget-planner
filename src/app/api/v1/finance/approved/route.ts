import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import { getCurrentUser, repos } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

/** Finance inbox — pending queue, claimed, and finalized budgets. */
export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    if (!user.permissionCodes.includes("finance.view")) {
      throw new AuthorizationError("Missing permission: finance.view");
    }
    const [plans, users, centers, departments, years] = await Promise.all([
      repos.budgets.list(),
      repos.users.getAll(),
      repos.costCenters.getAll(),
      repos.departments.getAll(),
      repos.fiscalYears.getAll(),
    ]);
    const userMap = new Map(users.map((u) => [u.id, u]));
    const ccMap = new Map(centers.map((c) => [c.id, c]));
    const deptMap = new Map(departments.map((d) => [d.id, d]));
    const fyMap = new Map(years.map((y) => [y.id, y]));

    const financeStatuses = new Set([
      "PendingFinanceReview",
      "Claimed",
      "Finalized",
      "Approved",
    ]);

    const rows = plans
      .filter((p) => financeStatuses.has(p.status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((p) => {
        const cc = ccMap.get(p.costCenterId);
        return {
          planId: p.id,
          budgetNumber: p.versionLabel,
          status: p.status,
          employee: userMap.get(p.ownerId)?.name ?? p.ownerId,
          department: cc ? (deptMap.get(cc.departmentId)?.name ?? "—") : "—",
          costCenter: cc ? `${cc.name} (${cc.code})` : p.costCenterId,
          fiscalYear: fyMap.get(p.fiscalYearId)?.yearLabel ?? null,
          glCount: p.lines.length,
          amount: p.lines.reduce((s, l) => s + l.amount, 0),
          submissionDate: p.submittedAt,
          sapReference: p.sapVersion,
          claimDueAt: p.claimDueAt,
          reviewDueAt: p.reviewDueAt,
          escalationStatus: p.escalationStatus,
          financeClaimedBy: p.financeClaimedBy
            ? (userMap.get(p.financeClaimedBy)?.name ?? p.financeClaimedBy)
            : null,
          sapStatus:
            p.status === "Finalized" || p.status === "Approved"
              ? "Generated"
              : "Pending",
        };
      });

    return NextResponse.json({ data: rows, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}
