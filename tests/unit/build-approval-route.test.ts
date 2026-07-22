import { describe, it, expect, beforeEach } from "vitest";
import { buildApprovalRoute, ApprovalRouteError } from "@/domain/rules/build-approval-route";
import type { User } from "@/domain/entities";
import { IDS, users } from "@/infrastructure/repositories/mock/seed";
import { resetMockStore, mockStore } from "@/infrastructure/repositories/mock/store";
import {
  approvalService,
  budgetPlanService,
  repos,
} from "@/infrastructure/di";
import { setMemoryUserId } from "@/infrastructure/session";

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

  it("GM is sole approver when owner reports directly to Joyce", () => {
    const route = buildApprovalRoute(IDS.chris, mapFromUsers(users));
    expect(route.map((r) => r.approverId)).toEqual([IDS.joyce]);
    expect(route[0]?.role).toBe("gm");
  });

  it("throws when no GM exists in chain", () => {
    const solo = structuredClone(users);
    const joyce = solo.find((u) => u.id === IDS.joyce)!;
    joyce.managerId = IDS.peter;
    expect(() => buildApprovalRoute(IDS.joyce, mapFromUsers(solo))).toThrow(
      ApprovalRouteError
    );
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
    setMemoryUserId(IDS.patrick);
    const patrick = (await repos.users.getById(IDS.patrick))!;
    const plan = await budgetPlanService.createDraft(patrick, {
      budgetCategory: "RECURRENT",
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
    expect(final.status).toBe("PendingFinanceReview");
    expect(final.currentApproverId).toBeNull();
  });

  it("GM submit enters Finance queue directly", async () => {
    const joyce = (await repos.users.getById(IDS.joyce))!;
    const plan = await budgetPlanService.createDraft(joyce, {
      budgetCategory: "RECURRENT",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccGm,
      lines: [{ glAccountId: "gl-860206", amount: 50000 }],
    });
    const submitted = await approvalService.submit(plan.id, joyce);
    expect(submitted.status).toBe("PendingFinanceReview");
    expect(submitted.currentApproverId).toBeNull();
  });

  it("returns for revision with comment", async () => {
    const patrick = (await repos.users.getById(IDS.patrick))!;
    const plan = await budgetPlanService.createDraft(patrick, {
      budgetCategory: "RECURRENT",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccRelMgmt,
      lines: [{ glAccountId: "gl-860206", amount: 100000 }],
    });
    await approvalService.submit(plan.id, patrick);
    const peter = (await repos.users.getById(IDS.peter))!;
    const returned = await approvalService.returnForRevision(
      plan.id,
      peter,
      "Reduce software licences"
    );
    expect(returned.status).toBe("ReturnedForRevision");
    expect(
      mockStore.workflowHistory.some(
        (w) =>
          w.budgetVersionId === plan.id &&
          w.action === "Returned" &&
          w.stage === "ManagerReview"
      )
    ).toBe(true);
  });

  it("manager cannot reject; GM can reject permanently", async () => {
    const patrick = (await repos.users.getById(IDS.patrick))!;
    const plan = await budgetPlanService.createDraft(patrick, {
      budgetCategory: "RECURRENT",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccRelMgmt,
      lines: [{ glAccountId: "gl-860206", amount: 100000 }],
    });
    await approvalService.submit(plan.id, patrick);
    const peter = (await repos.users.getById(IDS.peter))!;
    await expect(
      approvalService.reject(plan.id, peter, "Exceeds annual allocation")
    ).rejects.toThrow(/General Manager/i);

    await approvalService.approve(plan.id, peter);
    const joyce = (await repos.users.getById(IDS.joyce))!;
    const rejected = await approvalService.reject(
      plan.id,
      joyce,
      "Exceeds annual allocation"
    );
    expect(rejected.status).toBe("Rejected");
    expect(
      mockStore.workflowHistory.some(
        (w) =>
          w.budgetVersionId === plan.id &&
          w.action === "Rejected" &&
          w.stage === "Rejected"
      )
    ).toBe(true);
    await expect(approvalService.submit(plan.id, patrick)).rejects.toThrow(
      /Draft or Returned/
    );
  });
});
