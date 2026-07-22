import "server-only";

import type {
  SupportIssue,
  SupportIssueCategory,
  SupportIssuePriority,
  SupportIssueStatus,
  User,
} from "@/domain/entities";
import {
  SUPPORT_ISSUE_CATEGORIES,
  SUPPORT_ISSUE_PRIORITIES,
  SUPPORT_ISSUE_STATUSES,
  formatSupportReference,
} from "@/domain/support-issue";
import type {
  IAuditLogRepository,
  INotificationRepository,
  ISupportIssueRepository,
  IUnitOfWork,
  IUserAdminRepository,
} from "@/infrastructure/repositories/interfaces";
import { newId } from "@/infrastructure/id";

/**
 * SupportIssueService
 *
 * Responsibility
 * --------------
 * Owns support ticket create / update / resolve and related user notifications.
 *
 * Does NOT:
 * - touch budget approval or finance state
 *
 * Business Rules: support invariants in domain/support-issue
 * Workflows: WF-015
 * Dependencies: UnitOfWork, supportIssues/users/notifications/audits
 */
export class SupportIssueServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "SupportIssueServiceError";
  }
}

export type CreateSupportIssueInput = {
  title: string;
  description: string;
  category: SupportIssueCategory;
  priority: SupportIssuePriority;
  pagePath?: string | null;
  pageLabel?: string | null;
  budgetPlanId?: string | null;
  fiscalYearId?: string | null;
  costCenterId?: string | null;
  browser?: string | null;
  appVersion?: string | null;
  correlationId?: string | null;
  screenshot?: {
    fileName: string;
    contentType: string;
    contentBase64: string;
  } | null;
};

export type UpdateSupportIssueInput = {
  status?: SupportIssueStatus;
  assignedTo?: string | null;
  adminNotes?: string | null;
};

export class SupportIssueService {
  constructor(
    private readonly issues: ISupportIssueRepository,
    private readonly users: IUserAdminRepository,
    private readonly notifications: INotificationRepository,
    private readonly audits: IAuditLogRepository,
    private readonly uow: IUnitOfWork,
    private readonly appVersion: string
  ) {}

  async create(
    actor: User,
    input: CreateSupportIssueInput,
    correlationId = newId("corr")
  ): Promise<SupportIssue> {
    const title = input.title?.trim() ?? "";
    const description = input.description?.trim() ?? "";
    if (title.length < 3) {
      throw new SupportIssueServiceError("Title is required", "VALIDATION");
    }
    if (description.length < 10) {
      throw new SupportIssueServiceError(
        "Description must be at least 10 characters",
        "VALIDATION"
      );
    }
    if (!SUPPORT_ISSUE_CATEGORIES.includes(input.category)) {
      throw new SupportIssueServiceError("Invalid category", "VALIDATION");
    }
    if (!SUPPORT_ISSUE_PRIORITIES.includes(input.priority)) {
      throw new SupportIssueServiceError("Invalid priority", "VALIDATION");
    }

    let screenshotBuf: Buffer | null = null;
    let fileName: string | null = null;
    let contentType: string | null = null;
    if (input.screenshot?.contentBase64) {
      const raw = input.screenshot.contentBase64.replace(/^data:[^;]+;base64,/, "");
      screenshotBuf = Buffer.from(raw, "base64");
      if (screenshotBuf.length > 5 * 1024 * 1024) {
        throw new SupportIssueServiceError(
          "Screenshot must be 5MB or smaller",
          "VALIDATION"
        );
      }
      fileName = input.screenshot.fileName.slice(0, 260);
      contentType = input.screenshot.contentType.slice(0, 120);
    }

    const yearLabel = new Date().getUTCFullYear();
    const now = new Date().toISOString();

    return this.uow.runInTransaction(async () => {
      const seq = await this.issues.nextSequence(yearLabel);
      const referenceNumber = formatSupportReference(yearLabel, seq);
      const issue: SupportIssue = {
        id: newId(),
        referenceNumber,
        title,
        description,
        category: input.category,
        priority: input.priority,
        status: "Open",
        reportedBy: actor.id,
        assignedTo: null,
        pagePath: input.pagePath?.trim() || null,
        pageLabel: input.pageLabel?.trim() || null,
        budgetPlanId: input.budgetPlanId || null,
        fiscalYearId: input.fiscalYearId || null,
        costCenterId: input.costCenterId || actor.primaryCostCenterId || null,
        browser: input.browser?.trim() || null,
        appVersion: input.appVersion?.trim() || this.appVersion,
        correlationId: input.correlationId?.trim() || correlationId,
        adminNotes: null,
        screenshotFileName: fileName,
        screenshotContentType: contentType,
        hasScreenshot: Boolean(screenshotBuf),
        createdAt: now,
        updatedAt: now,
        closedAt: null,
      };

      const saved = await this.issues.save(issue, screenshotBuf);

      const admins = (await this.users.getAll()).filter(
        (u) => u.active && u.roleCodes.includes("SystemAdmin")
      );
      for (const admin of admins) {
        await this.notifications.create({
          id: newId("notif"),
          userId: admin.id,
          type: "SupportIssue",
          title: "New Issue Reported",
          message: `${actor.name} · ${saved.pageLabel ?? saved.pagePath ?? "Portal"} · ${saved.title}`,
          priority: saved.priority,
          category: "Support",
          actionLabel: "Open Issue",
          relatedPlanId: saved.budgetPlanId,
          entityType: "Issue",
          entityId: saved.id,
          targetUrl: "/admin/support",
          isRead: false,
          createdAt: now,
        });
      }

      await this.audits.append({
        id: newId("audit"),
        entity: "SupportIssue",
        entityId: saved.id,
        action: "SupportIssueCreated",
        performedBy: actor.id,
        ipAddress: null,
        correlationId,
        beforeJson: null,
        afterJson: JSON.stringify({
          referenceNumber: saved.referenceNumber,
          category: saved.category,
          priority: saved.priority,
        }),
        timestamp: now,
      });

      return saved;
    });
  }

  async listMine(actor: User): Promise<SupportIssue[]> {
    return this.issues.listMine(actor.id);
  }

  async listAll(
    actor: User,
    filters?: { status?: string }
  ): Promise<SupportIssue[]> {
    this.assertAdmin(actor);
    return this.issues.listAll(filters);
  }

  async get(actor: User, id: string): Promise<SupportIssue> {
    const issue = await this.issues.getById(id);
    if (!issue) {
      throw new SupportIssueServiceError("Issue not found", "NOT_FOUND");
    }
    if (
      issue.reportedBy !== actor.id &&
      !actor.roleCodes.includes("SystemAdmin")
    ) {
      throw new SupportIssueServiceError("Issue not found", "NOT_FOUND");
    }
    return issue;
  }

  async update(
    actor: User,
    id: string,
    input: UpdateSupportIssueInput,
    correlationId = newId("corr")
  ): Promise<SupportIssue> {
    this.assertAdmin(actor);
    const issue = await this.issues.getById(id);
    if (!issue) {
      throw new SupportIssueServiceError("Issue not found", "NOT_FOUND");
    }

    const nextStatus = input.status ?? issue.status;
    if (!SUPPORT_ISSUE_STATUSES.includes(nextStatus)) {
      throw new SupportIssueServiceError("Invalid status", "VALIDATION");
    }

    let assignedTo =
      input.assignedTo !== undefined ? input.assignedTo : issue.assignedTo;
    if (nextStatus === "Assigned" && !assignedTo) {
      assignedTo = actor.id;
    }

    const now = new Date().toISOString();
    const closedAt =
      nextStatus === "Closed" || nextStatus === "Resolved"
        ? issue.closedAt ?? now
        : nextStatus === "Open" ||
            nextStatus === "Assigned" ||
            nextStatus === "InProgress"
          ? null
          : issue.closedAt;

    const updated: SupportIssue = {
      ...issue,
      status: nextStatus,
      assignedTo,
      adminNotes:
        input.adminNotes !== undefined
          ? input.adminNotes?.trim() || null
          : issue.adminNotes,
      updatedAt: now,
      closedAt,
    };

    return this.uow.runInTransaction(async () => {
      const saved = await this.issues.save(updated);

      if (
        (nextStatus === "Resolved" || nextStatus === "Closed") &&
        issue.status !== nextStatus
      ) {
        // The ticket is done: clear the admin queue items for this issue, then
        // notify the reporter that their issue was resolved.
        await this.notifications.resolveForEntity("Issue", issue.id, {
          types: ["SupportIssue"],
          resolvedBy: actor.id,
        });
        await this.notifications.create({
          id: newId("notif"),
          userId: issue.reportedBy,
          type: "Outcome",
          title: `Issue ${issue.referenceNumber} ${nextStatus}`,
          message:
            saved.adminNotes?.trim() ||
            `Your support issue ${issue.referenceNumber} is now ${nextStatus}.`,
          priority: "Medium",
          category: "Outcome",
          actionLabel: "View Issue",
          relatedPlanId: issue.budgetPlanId,
          entityType: "Issue",
          entityId: issue.id,
          targetUrl: "/support",
          isRead: false,
          createdAt: now,
        });
      }

      await this.audits.append({
        id: newId("audit"),
        entity: "SupportIssue",
        entityId: saved.id,
        action: "SupportIssueUpdated",
        performedBy: actor.id,
        ipAddress: null,
        correlationId,
        beforeJson: JSON.stringify({
          status: issue.status,
          assignedTo: issue.assignedTo,
        }),
        afterJson: JSON.stringify({
          status: saved.status,
          assignedTo: saved.assignedTo,
        }),
        timestamp: now,
      });

      return saved;
    });
  }

  private assertAdmin(actor: User): void {
    if (!actor.roleCodes.includes("SystemAdmin")) {
      throw new SupportIssueServiceError("Forbidden", "FORBIDDEN");
    }
  }
}
