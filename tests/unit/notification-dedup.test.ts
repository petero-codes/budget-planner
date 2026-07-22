import { describe, expect, it, beforeEach } from "vitest";
import { markNotificationRead } from "@/application/notification-task-actions";
import { MockNotificationRepository } from "@/infrastructure/repositories/mock";
import { mockStore } from "@/infrastructure/repositories/mock/store";
import type { Notification } from "@/domain/entities";

function task(
  partial: Partial<Notification> & Pick<Notification, "id">
): Notification {
  return {
    userId: "manager-1",
    type: "Approval",
    title: "Budget awaiting your approval",
    message: "body",
    priority: "High",
    category: "Approval",
    actionLabel: "Review Budget",
    relatedPlanId: "plan-173",
    entityType: "Budget",
    entityId: "plan-173",
    targetUrl: "/budgets/plan-173?action=approve",
    isRead: false,
    readAt: null,
    resolvedAt: null,
    resolvedBy: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("duplicate-task prevention (K-009: one active notification per task)", () => {
  beforeEach(() => {
    mockStore.notifications = [];
  });

  it("creating the same active task twice keeps a single active notification", async () => {
    const repo = new MockNotificationRepository();
    await repo.create(task({ id: "n-1" }));
    await repo.create(task({ id: "n-2" }));

    const active = await repo.listByUser("manager-1");
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe("n-1");
  });

  it("a resolved task does not block a new task for the same plan", async () => {
    const repo = new MockNotificationRepository();
    await repo.create(task({ id: "n-1" }));
    await repo.resolveForPlan("plan-173", { userId: "manager-1" });
    // e.g. budget returned and resubmitted → a fresh approval task is legitimate
    await repo.create(task({ id: "n-2" }));

    const active = await repo.listByUser("manager-1");
    expect(active).toHaveLength(1);
    expect(active[0]!.id).toBe("n-2");
  });

  it("same task for different recipients is not deduplicated", async () => {
    const repo = new MockNotificationRepository();
    await repo.create(task({ id: "n-1", userId: "finance-a" }));
    await repo.create(task({ id: "n-2", userId: "finance-b" }));

    expect(await repo.listByUser("finance-a")).toHaveLength(1);
    expect(await repo.listByUser("finance-b")).toHaveLength(1);
  });

  it("different plans for the same recipient are not deduplicated", async () => {
    const repo = new MockNotificationRepository();
    await repo.create(task({ id: "n-1" }));
    await repo.create(
      task({ id: "n-2", relatedPlanId: "plan-999", entityId: "plan-999" })
    );

    expect(await repo.listByUser("manager-1")).toHaveLength(2);
  });

  it("informational notifications may repeat (only actionable tasks dedupe)", async () => {
    const repo = new MockNotificationRepository();
    const outcome = (id: string) =>
      task({
        id,
        type: "Outcome",
        category: "Outcome",
        title: "Budget returned",
        actionLabel: "View Budget",
        targetUrl: "/budgets/plan-173",
      });
    await repo.create(outcome("n-1"));
    await repo.create(outcome("n-2"));

    expect(await repo.listByUser("manager-1")).toHaveLength(2);
  });

  it("clicking (reading) a task twice never duplicates it or resolves it", async () => {
    const repo = new MockNotificationRepository();
    await repo.create(task({ id: "n-1" }));

    await markNotificationRead(repo, "manager-1", "n-1");
    await markNotificationRead(repo, "manager-1", "n-1");

    const active = await repo.listByUser("manager-1");
    expect(active).toHaveLength(1);
    expect(active[0]!.isRead).toBe(true);
    expect(active[0]!.resolvedAt).toBeFalsy();
    expect(mockStore.notifications).toHaveLength(1);
  });

  it("badge invariant: active count equals unresolved rows in the store", async () => {
    const repo = new MockNotificationRepository();
    await repo.create(task({ id: "n-1" }));
    await repo.create(
      task({ id: "n-2", relatedPlanId: "plan-2", entityId: "plan-2" })
    );
    await repo.resolveForPlan("plan-2", { userId: "manager-1" });

    const active = await repo.listByUser("manager-1");
    const unresolvedInStore = mockStore.notifications.filter(
      (n) => n.userId === "manager-1" && !n.resolvedAt && !n.isCleared
    );
    expect(active.length).toBe(unresolvedInStore.length);
    expect(active.length).toBe(1);
  });
});
