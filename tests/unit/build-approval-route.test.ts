import { describe, it, expect, beforeEach } from "vitest";
import { buildApprovalRoute, ApprovalRouteError } from "@/domain/rules/build-approval-route";
import type { User } from "@/domain/entities";
import { IDS, users } from "@/infrastructure/repositories/mock/seed";
import { resetMockStore } from "@/infrastructure/repositories/mock/store";
import {
  approvalService,
  budgetPlanService,
  repos,
  setCurrentUserId,
} from "@/infrastructure/di";

function mapFromUsers(list: User[]) {
  return new Map(list.map((u) => [u.id, u]));
}

describe("buildApprovalRoute", () => {
  it("builds 3-level style route for assistant under Peter: Peter then Joyce", () => {
    const route = buildApprovalRoute(IDS.patrick, mapFromUsers(users));
    expect(route.map((r) => r.approverId)).toEqual([IDS.peter, IDS.joyce]);
  });

  it("builds 2-level route for manager: Joyce only", () => {
    const route = buildApprovalRoute(IDS.peter, mapFromUsers(users));
    expect(route.map((r) => r.approverId)).toEqual([IDS.joyce]);
  });

  it("builds 1-level route for direct report to Joyce", () => {
    const route = buildApprovalRoute(IDS.chris, mapFromUsers(users));
    expect(route.map((r) => r.approverId)).toEqual([IDS.joyce]);
  });

  it("returns empty route for root node", () => {
    const route = buildApprovalRoute(IDS.joyce, mapFromUsers(users));
    expect(route).toEqual([]);
  });

  it("fails on circular hierarchy", () => {
    const circular = structuredClone(users);
    const joyce = circular.find((u) => u.id === IDS.joyce)!;
    const peter = circular.find((u) => u.id === IDS.peter)!;
    joyce.managerId = peter.id;
    expect(() => buildApprovalRoute(IDS.patrick, mapFromUsers(circular))).toThrow(
      ApprovalRouteError
    );
  });

  it("fails on inactive manager", () => {
    const inactive = structuredClone(users);
    inactive.find((u) => u.id === IDS.peter)!.active = false;
    expect(() =>
      buildApprovalRoute(IDS.patrick, mapFromUsers(inactive))
    ).toThrow(/inactive/i);
  });
});

describe("ApprovalService", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("submits assistant budget to Peter then Joyce", async () => {
    setCurrentUserId(IDS.patrick);
    const patrick = (await repos.users.getById(IDS.patrick))!;
    const plan = await budgetPlanService.createDraft(patrick, {
      budgetType: "Primary",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccRelMgmt,
      lines: [{ glAccountId: "gl-860206", amount: 100000 }],
    });
    const submitted = await approvalService.submit(plan.id, patrick);
    expect(submitted.status).toBe("InApproval");
    expect(submitted.currentApproverId).toBe(IDS.peter);

    const peter = (await repos.users.getById(IDS.peter))!;
    const afterPeter = await approvalService.approve(plan.id, peter);
    expect(afterPeter.currentApproverId).toBe(IDS.joyce);

    const joyce = (await repos.users.getById(IDS.joyce))!;
    const final = await approvalService.approve(plan.id, joyce);
    expect(final.status).toBe("Approved");
    expect(final.currentApproverId).toBeNull();
  });

  it("auto-approves root node on submit", async () => {
    const joyce = (await repos.users.getById(IDS.joyce))!;
    const plan = await budgetPlanService.createDraft(joyce, {
      budgetType: "Primary",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccGm,
      lines: [{ glAccountId: "gl-860206", amount: 50000 }],
    });
    const submitted = await approvalService.submit(plan.id, joyce);
    expect(submitted.status).toBe("Approved");
  });

  it("rejects with comment back to Draft", async () => {
    const patrick = (await repos.users.getById(IDS.patrick))!;
    const plan = await budgetPlanService.createDraft(patrick, {
      budgetType: "Primary",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccRelMgmt,
      lines: [{ glAccountId: "gl-860206", amount: 100000 }],
    });
    await approvalService.submit(plan.id, patrick);
    const peter = (await repos.users.getById(IDS.peter))!;
    const rejected = await approvalService.reject(
      plan.id,
      peter,
      "Reduce software licences"
    );
    expect(rejected.status).toBe("Draft");
  });
});
