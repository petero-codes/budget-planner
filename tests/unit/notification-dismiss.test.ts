import { describe, expect, it, beforeEach } from "vitest";
import { MockNotificationRepository } from "@/infrastructure/repositories/mock";
import { mockStore } from "@/infrastructure/repositories/mock/store";

describe("notification dismiss ownership", () => {
  beforeEach(() => {
    mockStore.notifications = [
      {
        id: "n-owner",
        userId: "user-a",
        type: "BudgetSubmitted",
        title: "Mine",
        body: "body",
        relatedPlanId: "plan-1",
        isRead: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "n-other",
        userId: "user-b",
        type: "BudgetSubmitted",
        title: "Theirs",
        body: "body",
        relatedPlanId: "plan-2",
        isRead: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
  });

  it("soft-clears only notifications owned by the caller", async () => {
    const repo = new MockNotificationRepository();
    await repo.dismiss("n-other", "user-a");
    expect(mockStore.notifications.every((n) => !n.isCleared)).toBe(true);

    await repo.dismiss("n-owner", "user-a");
    expect(mockStore.notifications.find((n) => n.id === "n-owner")?.isCleared).toBe(
      true
    );
    expect(
      mockStore.notifications.find((n) => n.id === "n-other")?.isCleared
    ).toBeFalsy();
    // Soft-clear retains rows; inbox excludes cleared for owner.
    const inbox = await repo.listByUser("user-a");
    expect(inbox.map((n) => n.id)).toEqual([]);
    expect(mockStore.notifications.map((n) => n.id).sort()).toEqual([
      "n-other",
      "n-owner",
    ]);
  });
});
