export const SUPPORT_ISSUE_CATEGORIES = [
  "General",
  "Bug",
  "Budget",
  "Approval",
  "Finance",
  "Performance",
  "Security",
  "Other",
] as const;

export const SUPPORT_ISSUE_PRIORITIES = ["Low", "Medium", "High"] as const;

export const SUPPORT_ISSUE_STATUSES = [
  "Open",
  "Assigned",
  "InProgress",
  "Resolved",
  "Closed",
] as const;

export function formatSupportReference(
  yearLabel: number,
  sequence: number
): string {
  return `SUP-${yearLabel}-${String(sequence).padStart(5, "0")}`;
}
