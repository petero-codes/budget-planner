import { describe, expect, it, beforeEach } from "vitest";
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationDestination,
} from "@/application/notification-task-actions";
import { MockNotificationRepository } from "@/infrastructure/repositories/mock";
import { mockStore } from "@/infrastructure/repositories/mock/store";
import type { Notification } from "@/domain/entities";

function base(partial: Partial<Notification> & Pick<Notification, "id" | "type" | "title">): Notification {
  return {
    userId: "user-a",
    message: "body",
    priority: "Medium",
    category: "Budget",
    actionLabel: "View",
    relatedPlanId: null,
    entityType: "Budget",
    entityId: null,
    targetUrl: null,
    isRead: false,
    readAt: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("notification read lifecycle (click → read → navigate)", () => {
  beforeEach(() => {
    mockStore.notifications = [
      base({
        id: "n-approval",
        type: "Approval",
        title: "Budget awaiting approval",
        priority: "High",
        category: "Approval",
        actionLabel: "Review Budget",
        relatedPlanId: "plan-89",
        entityId: "plan-89",
        targetUrl: "/budgets/plan-89",
      }),
      base({
        id: "n-finance-queue",
        type: "FinanceQueue",
        title: "Finance review required",
        priority: "High",
        category: "Finance",
        actionLabel: "Review Finance Item",
        relatedPlanId: "plan-456",
        entityId: "plan-456",
        targetUrl: "/finance?planId=plan-456",
      }),
      base({
        id: "n-outcome",
        type: "Outcome",
        title: "Budget finalized",
        category: "Outcome",
        actionLabel: "View Details",
        relatedPlanId: "plan-89",
        entityId: "plan-89",
        targetUrl: "/budgets/plan-89",
      }),
      base({
        id: "n-admin-user",
        type: "AdminUser",
        title: "User created",
        category: "Administration",
        actionLabel: "View User",
        entityType: "User",
        entityId: "user-45",
        targetUrl: "/admin/users/user-45",
      }),
      base({
        id: "n-fy",
        type: "FiscalYear",
        title: "Fiscal year requires closure",
        category: "FiscalYear",
        actionLabel: "Manage Fiscal Years",
        entityType: "FiscalYear",
        entityId: "fy-1",
        targetUrl: "/admin/fiscal-years",
      }),
    ];
  });

  it("navigates via targetUrl (click destination contract)", () => {
    expect(notificationDestination(mockStore.notifications[0]!)).toBe(
      "/budgets/plan-89"
    );
    expect(notificationDestination(mockStore.notifications[1]!)).toBe(
      "/finance?planId=plan-456"
    );
    expect(notificationDestination(mockStore.notifications[3]!)).toBe(
      "/admin/users/user-45"
    );
    expect(notificationDestination(mockStore.notifications[4]!)).toBe(
      "/admin/fiscal-years"
    );
    expect(
      notificationDestination({
        targetUrl: null,
        relatedPlanId: "plan-fallback",
      })
    ).toBe("/budgets/plan-fallback");
  });

  it("reading an Approval marks readAt but keeps it active (opening ≠ handled)", async () => {
    const repo = new MockNotificationRepository();
    await markNotificationRead(repo, "user-a", "n-approval");

    const active = await repo.listByUser("user-a");
    const approval = active.find((n) => n.id === "n-approval");
    expect(approval).toBeTruthy();
    expect(approval!.isRead).toBe(true);
    expect(approval!.readAt).toBeTruthy();
    expect(approval!.resolvedAt).toBeFalsy();
    // Badge semantics: active unresolved count still includes the read Approval.
    expect(active.some((n) => n.id === "n-approval")).toBe(true);
  });

  it("reading an Outcome acknowledges it (moves off active into history)", async () => {
    const repo = new MockNotificationRepository();
    await markNotificationRead(repo, "user-a", "n-outcome");

    const active = await repo.listByUser("user-a");
    expect(active.map((n) => n.id)).not.toContain("n-outcome");

    const history = await repo.listByUser("user-a", { includeResolved: true });
    const outcome = history.find((n) => n.id === "n-outcome");
    expect(outcome?.resolvedAt).toBeTruthy();
    expect(outcome?.isRead).toBe(true);
  });

  it("readAll marks everything read but only auto-resolves informational FYIs", async () => {
    const repo = new MockNotificationRepository();
    await markAllNotificationsRead(repo, "user-a");

    const active = await repo.listByUser("user-a");
    const activeIds = active.map((n) => n.id).sort();
    // Actionable work remains: Approval, FinanceQueue, FiscalYear.
    expect(activeIds).toEqual(
      ["n-approval", "n-finance-queue", "n-fy"].sort()
    );
    expect(active.every((n) => n.isRead)).toBe(true);

    const history = await repo.listByUser("user-a", { includeResolved: true });
    const historyIds = history.map((n) => n.id).sort();
    expect(historyIds).toEqual(["n-admin-user", "n-outcome"].sort());
  });

  it("workflow targetUrls use existing portal routes only", () => {
    const knownPrefixes = [
      "/budgets/",
      "/finance",
      "/admin/users/",
      "/admin/fiscal-years",
    ];
    for (const n of mockStore.notifications) {
      const dest = notificationDestination(n);
      expect(dest).toBeTruthy();
      expect(
        knownPrefixes.some((p) => dest === p || dest!.startsWith(p))
      ).toBe(true);
    }
  });
});
