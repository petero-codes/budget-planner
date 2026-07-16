import { describe, it, expect, beforeEach } from "vitest";
import { ConcurrencyConflictError } from "@/application/concurrency-error";
import { IDS } from "@/infrastructure/repositories/mock/seed";
import { resetMockStore } from "@/infrastructure/repositories/mock/store";
import {
  approvalService,
  budgetPlanService,
  repos,
} from "@/infrastructure/di";
import {
  isTransientSqlError,
  withSqlRetry,
} from "@/infrastructure/repositories/sql/sql-retry";

describe("Optimistic concurrency on BudgetPlan.save", () => {
  beforeEach(() => {
    resetMockStore();
  });

  it("rejects a stale-version save with ConcurrencyConflictError", async () => {
    const patrick = (await repos.users.getById(IDS.patrick))!;
    const plan = await budgetPlanService.createDraft(patrick, {
      budgetType: "Primary",
      fiscalYearId: IDS.fy2027,
      fromPeriod: "2026-07-01",
      toPeriod: "2027-06-30",
      costCenterId: IDS.ccRelMgmt,
      lines: [{ glAccountId: "gl-860206", amount: 100000 }],
    });

    const stale = structuredClone(plan);
    // First writer wins and increments version in the repository.
    const updated = await repos.budgets.save({
      ...plan,
      description: "first writer",
    });
    expect(updated.version).toBe(plan.version + 1);

    await expect(
      repos.budgets.save({
        ...stale,
        description: "stale writer",
      })
    ).rejects.toBeInstanceOf(ConcurrencyConflictError);
  });

  it("concurrent approve calls: exactly one succeeds, one conflicts", async () => {
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

    const results = await Promise.allSettled([
      approvalService.approve(plan.id, peter, "A"),
      approvalService.approve(plan.id, peter, "B"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect(rejected[0]!.status).toBe("rejected");
    if (rejected[0]!.status === "rejected") {
      expect(rejected[0]!.reason).toBeInstanceOf(ConcurrencyConflictError);
      expect((rejected[0]!.reason as ConcurrencyConflictError).code).toBe(
        "BUDGET_CONFLICT"
      );
    }

    const final = await repos.budgets.getById(plan.id);
    expect(final?.currentApproverId).toBe(IDS.joyce);
    expect(final?.status).toBe("InApproval");
  });
});

describe("SQL transient retry helper", () => {
  it("retries transient errors then succeeds", async () => {
    let attempts = 0;
    const result = await withSqlRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        const err = Object.assign(new Error("deadlock"), { number: 1205 });
        throw err;
      }
      return "ok";
    }, "corr-test");
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry constraint / business errors", async () => {
    let attempts = 0;
    await expect(
      withSqlRetry(async () => {
        attempts += 1;
        const err = Object.assign(new Error("unique violation"), {
          number: 2627,
        });
        throw err;
      })
    ).rejects.toThrow(/unique violation/);
    expect(attempts).toBe(1);
  });

  it("classifies known transient numbers", () => {
    expect(isTransientSqlError(Object.assign(new Error("x"), { number: 1205 }))).toBe(
      true
    );
    expect(isTransientSqlError(Object.assign(new Error("x"), { number: 40501 }))).toBe(
      true
    );
    expect(isTransientSqlError(Object.assign(new Error("x"), { number: 2627 }))).toBe(
      false
    );
  });
});
