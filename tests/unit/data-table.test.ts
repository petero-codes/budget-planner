/**
 * Vitest — DataTable is presentation-only; cover sort/filter/pagination helpers
 * via rendering would need RTL. Keep a smoke import + type-level contract here.
 */
import { describe, expect, it } from "vitest";
import { DataTable } from "@/components/ui/data-table";

describe("DataTable", () => {
  it("exports a client table component", () => {
    expect(typeof DataTable).toBe("function");
  });
});
