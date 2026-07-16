import { describe, expect, it } from "vitest";
import { budgetApiError } from "@/lib/security/budget-api-error";

describe("budgetApiError", () => {
  it("maps Not signed in to 401 UNAUTHORIZED", async () => {
    const res = budgetApiError(new Error("Not signed in"), "corr-1");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("maps Current user not found to 401 UNAUTHORIZED", async () => {
    const res = budgetApiError(
      new Error("Current user not found — sign in again"),
      "corr-2"
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("keeps unexpected errors as 500 INTERNAL", async () => {
    const res = budgetApiError(new Error("boom"), "corr-3");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).toBe("boom");
  });

  it("sanitizes unexpected errors when production mode is forced", async () => {
    const { safeInternalMessage } = await import(
      "@/lib/security/safe-error-message"
    );
    expect(safeInternalMessage(new Error("SELECT * FROM secrets"), {
      forceProduction: true,
    })).not.toContain("SELECT");
    expect(
      safeInternalMessage(new Error("SELECT * FROM secrets"), {
        forceProduction: true,
      })
    ).toMatch(/unexpected error/i);
  });
});
