import { describe, expect, it } from "vitest";

/** Mirrors middleware SENSITIVE_PATH — keep in sync with src/middleware.ts */
const SENSITIVE_PATH =
  /\/(submit|approve|reject|return|claim|finalize|release|amend)$/;

describe("middleware sensitive path rate-limit matcher", () => {
  it.each([
    "/api/v1/budget-plans/x/submit",
    "/api/v1/budget-plans/x/approve",
    "/api/v1/budget-plans/x/reject",
    "/api/v1/budget-plans/x/return",
    "/api/v1/budget-plans/x/finance/claim",
    "/api/v1/budget-plans/x/finance/finalize",
    "/api/v1/budget-plans/x/finance/return",
    "/api/v1/budget-plans/x/finance/release",
    "/api/v1/budget-plans/x/amend",
  ])("matches %s", (path) => {
    expect(SENSITIVE_PATH.test(path)).toBe(true);
  });

  it.each([
    "/api/v1/budget-plans",
    "/api/v1/finance/escalations",
    "/api/v1/budget-plans/x/history",
  ])("does not match %s", (path) => {
    expect(SENSITIVE_PATH.test(path)).toBe(false);
  });
});
