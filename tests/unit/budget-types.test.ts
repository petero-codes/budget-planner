import { describe, expect, it } from "vitest";

import {

  BUDGET_CATEGORY_CATALOG,

  BUDGET_CATEGORY_CODES,

  BudgetCategory,

  budgetCategoryAtIndex,

  budgetCategoryDistribution,

  budgetCategoryFilterOptions,

  budgetCategoryLabel,

  budgetCategoryOrder,

  budgetCategorySelectOptions,

  defaultBudgetCategory,

  emptyBudgetCategorySummary,

  addToBudgetCategorySummary,
  addToLegacyBudgetCategorySummary,
  emptyLegacyBudgetCategorySummary,
  legacyBudgetCategoryDistribution,
  isBudgetCategory,

  isLegacyBudgetCategoryValue,

} from "@/domain/constants/budget-types";



describe("budget category catalog (BR-12)", () => {

  it("stores RECURRENT, MAJOR, CAPEX codes with distinct labels", () => {

    expect(BUDGET_CATEGORY_CODES).toEqual(["RECURRENT", "MAJOR", "CAPEX"]);

    expect(budgetCategoryLabel("CAPEX")).toBe("Capital Expenditure");

    expect(budgetCategoryLabel("RECURRENT")).toBe("Recurrent");

  });



  it("exposes enum-like codes via BudgetCategory", () => {

    expect(BudgetCategory.CAPEX).toBe("CAPEX");

    expect(isBudgetCategory(BudgetCategory.MAJOR)).toBe(true);

  });



  it("orders categories explicitly — not by array index", () => {

    expect(budgetCategoryOrder("RECURRENT")).toBe(1);

    expect(budgetCategoryOrder("MAJOR")).toBe(2);

    expect(budgetCategoryOrder("CAPEX")).toBe(3);

    expect(

      [...BUDGET_CATEGORY_CATALOG].sort(

        (a, b) => a.order - b.order

      )[2]?.code

    ).toBe("CAPEX");

  });



  it("accepts only catalog codes — never loose strings", () => {

    for (const e of BUDGET_CATEGORY_CATALOG) {

      expect(isBudgetCategory(e.code)).toBe(true);

    }

    for (const bad of [

      "Recurrent",

      "capex",

      "Capex",

      "CAP EX",

      "Primary",

      "Supplementary",

      "OPEX",

      "REPEX",

      "",

    ]) {

      expect(isBudgetCategory(bad)).toBe(false);

    }

  });



  it("treats legacy values as read-only display", () => {

    expect(isLegacyBudgetCategoryValue("Primary")).toBe(true);

    expect(budgetCategoryLabel("Primary")).toBe("Primary");

    expect(defaultBudgetCategory()).toBe("RECURRENT");

  });



  it("builds select and filter options from catalog labels", () => {

    expect(budgetCategorySelectOptions()[2]?.label).toBe("Capital Expenditure");

    expect(budgetCategoryFilterOptions()[0]?.label).toBe("All categories");

  });



  it("cycles catalog codes by explicit order", () => {

    expect(budgetCategoryAtIndex(0)).toBe("RECURRENT");

    expect(budgetCategoryAtIndex(2)).toBe("CAPEX");

    expect(budgetCategoryAtIndex(3)).toBe("RECURRENT");

  });



  it("computes distribution percentages", () => {

    const s = emptyBudgetCategorySummary();

    addToBudgetCategorySummary(s, "CAPEX", 420);

    addToBudgetCategorySummary(s, "RECURRENT", 150);

    addToBudgetCategorySummary(s, "Primary", 50);

    const dist = budgetCategoryDistribution(s);

    expect(dist.find((d) => d.code === "CAPEX")?.percent).toBe(73.7);

    expect(dist.find((d) => d.code === "RECURRENT")?.percent).toBe(26.3);

  });

  it("aggregates legacy categories separately from catalog", () => {
    const legacy = emptyLegacyBudgetCategorySummary();
    addToLegacyBudgetCategorySummary(legacy, "Primary", 100);
    addToLegacyBudgetCategorySummary(legacy, "Primary", 50);
    addToLegacyBudgetCategorySummary(legacy, "RECURRENT", 999);
    const rows = legacyBudgetCategoryDistribution(legacy);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      code: "Primary",
      label: "Primary",
      count: 2,
      amount: 150,
    });
  });

});

