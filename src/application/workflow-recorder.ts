import "server-only";

import type { BudgetPlan, User, WorkflowHistoryEntry } from "@/domain/entities";
import type { WorkflowStage } from "@/domain/value-objects/budget-status";
import type { IWorkflowHistoryRepository } from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";

/**
 * WorkflowRecorder (+ finance-queue notify helpers)
 *
 * Responsibility
 * --------------
 * Appends WorkflowHistory rows and fans out finance-queue notifications used by
 * approval/finance services.
 *
 * Does NOT:
 * - decide status transitions (callers own that)
 *
 * Workflows: supporting WF-002…010
 * Dependencies: IWorkflowHistoryRepository; notification writes via callers
 */
export class WorkflowRecorder {
  constructor(private readonly workflow: IWorkflowHistoryRepository) {}

  async record(
    planId: string,
    actorId: string,
    stage: WorkflowStage,
    action: string,
    comment: string | null = null
  ): Promise<void> {
    const entry: WorkflowHistoryEntry = {
      id: newId("wf"),
      budgetVersionId: planId,
      stage,
      actorId,
      action,
      comment,
      timestamp: new Date().toISOString(),
    };
    await this.workflow.append(entry);
  }
}

export async function notifyFinanceQueue(
  notifications: {
    create(n: import("@/domain/entities").Notification): Promise<void>;
  },
  financeUsers: User[],
  plan: BudgetPlan,
  actorName: string
): Promise<void> {
  const now = new Date().toISOString();
  for (const user of financeUsers) {
    await notifications.create({
      id: newId("notif"),
      userId: user.id,
      type: "FinanceQueue",
      title: "Budget awaiting Finance review",
      message: `${actorName} approved a budget for Finance finalization.`,
      priority: "High",
      category: "Finance",
      actionLabel: "Review Finance Queue",
      relatedPlanId: plan.id,
      entityType: "Budget",
      entityId: plan.id,
      targetUrl: `/finance?planId=${plan.id}`,
      isRead: false,
      createdAt: now,
    });
  }
}

export function listFinanceAdministrators(users: User[]): User[] {
  return users.filter(
    (u) =>
      u.active &&
      (u.roleCodes.includes("FinanceAdministrator") ||
        u.permissionCodes.includes("finance.view"))
  );
}
