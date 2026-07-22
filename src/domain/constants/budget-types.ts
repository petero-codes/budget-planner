/**
 * Canonical budget category catalog (BR-12).
 *
 * Single source of truth — import from here; never hardcode category codes.
 *
 * - **code** — stored in DB / API (`RECURRENT` | `MAJOR` | `CAPEX`)
 * - **label** / **shortLabel** — UI only; never persisted
 * - SAP interchange uses column name `BudgetType` with **code** values
 *
 * Legacy values (`Primary`, `Supplementary`, …) are read-only on historical
 * rows — never converted; the app will not generate them anymore.
 */

export const BUDGET_CATEGORY_CATALOG = [
  {
    code: "RECURRENT",
    label: "Recurrent",
    shortLabel: "Recurrent",
    order: 1,
    color: "emerald",
    description: "Ongoing operational spend that repeats each fiscal year.",
    active: true,
  },
  {
    code: "MAJOR",
    label: "Major",
    shortLabel: "Major",
    order: 2,
    color: "amber",
    description: "Significant one-off or programme spend requiring distinct tracking.",
    active: true,
  },
  {
    code: "CAPEX",
    label: "Capital Expenditure",
    shortLabel: "CAPEX",
    order: 3,
    color: "violet",
    description: "Capital assets and long-term investments.",
    active: true,
  },
] as const;

export type BudgetCategoryCode = (typeof BUDGET_CATEGORY_CATALOG)[number]["code"];

export type BudgetCategoryEntry = (typeof BUDGET_CATEGORY_CATALOG)[number];

/** Enum-like code access — use `BudgetCategory.CAPEX`, never `"CAPEX"` literals. */
export const BudgetCategory = Object.fromEntries(
  BUDGET_CATEGORY_CATALOG.map((e) => [e.code, e.code])
) as { [K in BudgetCategoryCode]: K };

/** @deprecated Use `BudgetCategory` instead. Removed in next major version. */
export const BudgetType = BudgetCategory;

/** Active entries sorted by `order` (never rely on array index). */
export const ACTIVE_BUDGET_CATEGORIES = [...BUDGET_CATEGORY_CATALOG]
  .filter((e) => e.active)
  .sort((a, b) => a.order - b.order);

/** Zod / validation tuple — derived from catalog. */
export const BUDGET_CATEGORY_CODES = ACTIVE_BUDGET_CATEGORIES.map(
  (e) => e.code
) as [BudgetCategoryCode, ...BudgetCategoryCode[]];

const BY_CODE = new Map<string, BudgetCategoryEntry>(
  BUDGET_CATEGORY_CATALOG.map((e) => [e.code, e])
);

/** Form field label. */
export const BUDGET_CATEGORY_FIELD_LABEL = "Budget Category";

/** Table column header. */
export const BUDGET_CATEGORY_COLUMN_LABEL = "Category";

/** Reports section title. */
export const BUDGET_CATEGORY_DISTRIBUTION_TITLE =
  "Distribution by Budget Category";

/** Finance dashboard section title. */
export const BUDGET_CATEGORY_DISTRIBUTION_HEADING =
  "Budget Category Distribution";

/** Legacy values — read-only audit history only. */
export const LEGACY_BUDGET_CATEGORY_VALUES = [
  "Primary",
  "Supplementary",
  "Recurrent",
  "Major",
  "OPEX",
  "REPEX",
] as const;

export function isBudgetCategory(value: string): value is BudgetCategoryCode {
  return BY_CODE.has(value);
}

/** @deprecated Use `isBudgetCategory` instead. Removed in next major version. */
export const isBudgetType = isBudgetCategory;

export function isLegacyBudgetCategoryValue(value: string): boolean {
  return !isBudgetCategory(value) && value.trim().length > 0;
}

export function defaultBudgetCategory(): BudgetCategoryCode {
  return ACTIVE_BUDGET_CATEGORIES[0]!.code;
}

/** @deprecated Use `defaultBudgetCategory` instead. Removed in next major version. */
export const defaultBudgetType = defaultBudgetCategory;

export function budgetCategoryLabel(codeOrLegacy: string): string {
  return BY_CODE.get(codeOrLegacy)?.label ?? codeOrLegacy;
}

export function budgetCategoryShortLabel(codeOrLegacy: string): string {
  return BY_CODE.get(codeOrLegacy)?.shortLabel ?? codeOrLegacy;
}

export function budgetCategoryColor(code: string): string {
  return BY_CODE.get(code)?.color ?? "neutral";
}

export function budgetCategoryDescription(code: string): string | null {
  return BY_CODE.get(code)?.description ?? null;
}

export function budgetCategoryOrder(code: string): number {
  return BY_CODE.get(code)?.order ?? 999;
}

export function budgetCategorySelectOptions(): {
  value: BudgetCategoryCode;
  label: string;
}[] {
  return ACTIVE_BUDGET_CATEGORIES.map((e) => ({
    value: e.code,
    label: e.label,
  }));
}

export function budgetCategoryFilterOptions(): {
  value: "all" | BudgetCategoryCode;
  label: string;
}[] {
  return [
    { value: "all", label: "All categories" },
    ...ACTIVE_BUDGET_CATEGORIES.map((e) => ({
      value: e.code,
      label: e.label,
    })),
  ];
}

export type BudgetCategorySummary = Record<
  BudgetCategoryCode,
  { count: number; amount: number }
>;

export function emptyBudgetCategorySummary(): BudgetCategorySummary {
  const summary = {} as BudgetCategorySummary;
  for (const e of ACTIVE_BUDGET_CATEGORIES) {
    summary[e.code] = { count: 0, amount: 0 };
  }
  return summary;
}

export function addToBudgetCategorySummary(
  summary: BudgetCategorySummary,
  budgetCategory: string,
  amount: number
): void {
  if (!isBudgetCategory(budgetCategory)) return;
  summary[budgetCategory].count += 1;
  summary[budgetCategory].amount += amount;
}

export function budgetCategoryDistribution(
  summary: BudgetCategorySummary
): {
  code: BudgetCategoryCode;
  label: string;
  shortLabel: string;
  color: string;
  count: number;
  amount: number;
  percent: number;
}[] {
  const total = ACTIVE_BUDGET_CATEGORIES.reduce(
    (s, e) => s + summary[e.code].amount,
    0
  );
  return ACTIVE_BUDGET_CATEGORIES.map((e) => {
    const row = summary[e.code];
    return {
      code: e.code,
      label: e.label,
      shortLabel: e.shortLabel,
      color: e.color,
      count: row.count,
      amount: row.amount,
      percent:
        total > 0 ? Math.round((row.amount / total) * 1000) / 10 : 0,
    };
  });
}

export function budgetCategoryAtIndex(index: number): BudgetCategoryCode {
  const entry =
    ACTIVE_BUDGET_CATEGORIES[index % ACTIVE_BUDGET_CATEGORIES.length];
  return entry!.code;
}

/** Finance dashboard legacy section (shown only when historical rows exist). */
export const LEGACY_BUDGET_CATEGORY_DISTRIBUTION_HEADING = "Legacy Categories";

export type LegacyBudgetCategoryRow = {
  code: string;
  label: string;
  count: number;
  amount: number;
};

export function emptyLegacyBudgetCategorySummary(): Map<
  string,
  { count: number; amount: number }
> {
  return new Map();
}

export function addToLegacyBudgetCategorySummary(
  summary: Map<string, { count: number; amount: number }>,
  budgetCategory: string,
  amount: number
): void {
  if (isBudgetCategory(budgetCategory)) return;
  const key = budgetCategory.trim();
  if (!key) return;
  const row = summary.get(key) ?? { count: 0, amount: 0 };
  row.count += 1;
  row.amount += amount;
  summary.set(key, row);
}

export function legacyBudgetCategoryDistribution(
  summary: Map<string, { count: number; amount: number }>
): LegacyBudgetCategoryRow[] {
  return Array.from(summary.entries())
    .map(([code, row]) => ({
      code,
      label: budgetCategoryLabel(code),
      count: row.count,
      amount: row.amount,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** @deprecated Use `budgetCategoryAtIndex` instead. Removed in next major version. */
export const budgetTypeAtIndex = budgetCategoryAtIndex;

/** @deprecated Use `BUDGET_CATEGORY_CODES` instead. Removed in next major version. */
export const BUDGET_TYPE_CODES = BUDGET_CATEGORY_CODES;

/** @deprecated Use `BUDGET_CATEGORY_CATALOG` instead. Removed in next major version. */
export const BUDGET_TYPE_CATALOG = BUDGET_CATEGORY_CATALOG;

/** @deprecated Use `BudgetCategorySummary` instead. Removed in next major version. */
export type BudgetTypeSummary = BudgetCategorySummary;

/** @deprecated Use `emptyBudgetCategorySummary` instead. Removed in next major version. */
export const emptyBudgetTypeSummary = emptyBudgetCategorySummary;

/** @deprecated Use `addToBudgetCategorySummary` instead. Removed in next major version. */
export const addToBudgetTypeSummary = addToBudgetCategorySummary;

/** @deprecated Use `budgetCategorySelectOptions` instead. Removed in next major version. */
export const budgetTypeSelectOptions = budgetCategorySelectOptions;

/** @deprecated Use `budgetCategoryFilterOptions` instead. Removed in next major version. */
export const budgetTypeFilterOptions = budgetCategoryFilterOptions;

/** Tailwind utility classes for category accent (cards / chips). */
export function budgetCategoryAccentClasses(code: string): {
  border: string;
  bg: string;
  ring: string;
  text: string;
} {
  const color = budgetCategoryColor(code);
  const map: Record<string, { border: string; bg: string; ring: string; text: string }> =
    {
      emerald: {
        border: "border-emerald-400/50",
        bg: "bg-emerald-50",
        ring: "ring-emerald-400/40",
        text: "text-emerald-800",
      },
      amber: {
        border: "border-amber-400/50",
        bg: "bg-amber-50",
        ring: "ring-amber-400/40",
        text: "text-amber-900",
      },
      violet: {
        border: "border-violet-400/50",
        bg: "bg-violet-50",
        ring: "ring-violet-400/40",
        text: "text-violet-900",
      },
      neutral: {
        border: "border-neutral-300",
        bg: "bg-neutral-50",
        ring: "ring-neutral-300",
        text: "text-neutral-800",
      },
    };
  return map[color] ?? map.neutral!;
}
