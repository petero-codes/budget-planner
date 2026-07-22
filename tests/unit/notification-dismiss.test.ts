import { describe, expect, it, beforeEach } from "vitest";
import { MockNotificationRepository } from "@/infrastructure/repositories/mock";
import { mockStore } from "@/infrastructure/repositories/mock/store";

describe("notification archive ownership + pending safety", () => {
  beforeEach(() => {
    mockStore.notifications = [
      {
        id: "n-owner-resolved",
        userId: "user-a",
        type: "Outcome",
        title: "Mine (resolved)",
        message: "body",
        priority: "Medium",
        category: "Outcome",
        actionLabel: "View Budget",
        relatedPlanId: "plan-1",
        entityType: "Budget",
        entityId: "plan-1",
        targetUrl: "/budgets/plan-1",
        isRead: true,
        readAt: "2026-01-02T00:00:00.000Z",
        resolvedAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "n-owner-pending",
        userId: "user-a",
        type: "Approval",
        title: "Mine (still pending)",
        message: "body",
        priority: "High",
        category: "Approval",
        actionLabel: "Review Budget",
        relatedPlanId: "plan-2",
        entityType: "Budget",
        entityId: "plan-2",
        targetUrl: "/budgets/plan-2",
        isRead: true,
        readAt: "2026-01-02T00:00:00.000Z",
        resolvedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "n-other-resolved",
        userId: "user-b",
        type: "Outcome",
        title: "Theirs (resolved)",
        message: "body",
        priority: "Medium",
        category: "Outcome",
        actionLabel: "View Budget",
        relatedPlanId: "plan-3",
        entityType: "Budget",
        entityId: "plan-3",
        targetUrl: "/budgets/plan-3",
        isRead: false,
        resolvedAt: "2026-01-02T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
  });

  it("archives only resolved notifications owned by the caller", async () => {
    const repo = new MockNotificationRepository();

    // Cannot touch another user's notification (IDOR-safe).
    await repo.archiveResolved("n-other-resolved", "user-a");
    expect(
      mockStore.notifications.find((n) => n.id === "n-other-resolved")?.isCleared
    ).toBeFalsy();

    // Refuses to archive still-pending (unresolved) work — never hide a to-do.
    await repo.archiveResolved("n-owner-pending", "user-a");
    expect(
      mockStore.notifications.find((n) => n.id === "n-owner-pending")?.isCleared
    ).toBeFalsy();

    // Archives an own, already-resolved notification.
    await repo.archiveResolved("n-owner-resolved", "user-a");
    expect(
      mockStore.notifications.find((n) => n.id === "n-owner-resolved")?.isCleared
    ).toBe(true);
  });

  it("active list excludes resolved + archived; history includes resolved only", async () => {
    const repo = new MockNotificationRepository();

    // Active = unresolved, un-archived.
    const active = await repo.listByUser("user-a");
    expect(active.map((n) => n.id)).toEqual(["n-owner-pending"]);

    // History = resolved, un-archived.
    const history = await repo.listByUser("user-a", { includeResolved: true });
    expect(history.map((n) => n.id)).toEqual(["n-owner-resolved"]);

    // Archiving removes it from history too.
    await repo.archiveResolved("n-owner-resolved", "user-a");
    const historyAfter = await repo.listByUser("user-a", {
      includeResolved: true,
    });
    expect(historyAfter.map((n) => n.id)).toEqual([]);
  });

  it("records who completed workflow-owned work", async () => {
    const repo = new MockNotificationRepository();
    await repo.resolveForPlan("plan-2", {
      types: ["Approval"],
      resolvedBy: "manager-1",
    });

    const resolved = mockStore.notifications.find(
      (n) => n.id === "n-owner-pending"
    );
    expect(resolved?.resolvedAt).toBeTruthy();
    expect(resolved?.resolvedBy).toBe("manager-1");
  });
});
