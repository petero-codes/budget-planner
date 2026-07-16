import { describe, expect, it, beforeEach } from "vitest";
import { SupportIssueService } from "@/application/support-issue-service";
import { resetMockStore, mockStore } from "@/infrastructure/repositories/mock/store";
import {
  MockAuditLogRepository,
  MockNotificationRepository,
  MockSupportIssueRepository,
  MockUnitOfWork,
  MockUserRepository,
} from "@/infrastructure/repositories/mock";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import type { User } from "@/domain/entities";
import { __resetMockSupportScreenshots } from "@/infrastructure/repositories/mock/support-issue-repo";

function holder(): User {
  return mockStore.users.find((u) => u.id === IDS.peter)!;
}

function admin(): User {
  return mockStore.users.find((u) => u.id === IDS.admin)!;
}

describe("SupportIssueService", () => {
  beforeEach(() => {
    resetMockStore();
    __resetMockSupportScreenshots();
  });

  it("creates an issue with SUP-YYYY-##### reference and notifies SystemAdmin", async () => {
    const service = new SupportIssueService(
      new MockSupportIssueRepository(),
      new MockUserRepository(),
      new MockNotificationRepository(),
      new MockAuditLogRepository(),
      new MockUnitOfWork(),
      "0.1.0"
    );
    const issue = await service.create(holder(), {
      title: "Cannot submit budget",
      description: "Submit button stays disabled after filling all lines.",
      category: "Budget",
      priority: "High",
      pagePath: "/budgets/abc",
      pageLabel: "Budget Details",
      browser: "Chrome",
    });
    expect(issue.referenceNumber).toMatch(/^SUP-\d{4}-\d{5}$/);
    expect(issue.status).toBe("Open");
    expect(mockStore.supportIssues).toHaveLength(1);
    const adminNotifs = mockStore.notifications.filter(
      (n) => n.userId === IDS.admin && n.type === "SupportIssue"
    );
    expect(adminNotifs.length).toBeGreaterThanOrEqual(1);
  });

  it("lets reporter list own issues and admin update status", async () => {
    const issues = new MockSupportIssueRepository();
    const service = new SupportIssueService(
      issues,
      new MockUserRepository(),
      new MockNotificationRepository(),
      new MockAuditLogRepository(),
      new MockUnitOfWork(),
      "0.1.0"
    );
    const created = await service.create(holder(), {
      title: "Finance queue stuck",
      description: "Claimed budget never appears in finalize list.",
      category: "Finance",
      priority: "Medium",
    });
    const mine = await service.listMine(holder());
    expect(mine.map((i) => i.id)).toContain(created.id);

    const updated = await service.update(admin(), created.id, {
      status: "Resolved",
      adminNotes: "Finance queue configuration corrected.",
    });
    expect(updated.status).toBe("Resolved");
    expect(updated.closedAt).toBeTruthy();
    const userNotifs = mockStore.notifications.filter(
      (n) => n.userId === IDS.peter && n.type === "SupportIssue"
    );
    expect(userNotifs.some((n) => n.title.includes("Resolved"))).toBe(true);
  });
});
