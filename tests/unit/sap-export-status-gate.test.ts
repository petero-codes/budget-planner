import { describe, expect, it } from "vitest";
import { isSapCsvExportableStatus } from "@/domain/rules/sap-exportable-status";

describe("isSapCsvExportableStatus (BR-28)", () => {
  it("allows Finalized and legacy Approved", () => {
    expect(isSapCsvExportableStatus("Finalized")).toBe(true);
    expect(isSapCsvExportableStatus("Approved")).toBe(true);
  });

  it("rejects in-flight and non-export terminal statuses", () => {
    for (const s of [
      "Draft",
      "InApproval",
      "PendingFinance",
      "FinanceReview",
      "Returned",
      "Rejected",
    ]) {
      expect(isSapCsvExportableStatus(s)).toBe(false);
    }
  });
});
