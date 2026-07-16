/** Add calendar days (business-day logic deferred). */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function computeFinanceDueDates(fromIso: string): {
  claimDueAt: string;
  reviewDueAt: string;
} {
  const claimDays = Number(process.env.FINANCE_CLAIM_DUE_DAYS ?? 2);
  const reviewDays = Number(process.env.FINANCE_REVIEW_DUE_DAYS ?? 5);
  return {
    claimDueAt: addDays(fromIso, claimDays),
    reviewDueAt: addDays(fromIso, reviewDays),
  };
}

export function isOverdue(dueAt: string | null, now = new Date()): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < now.getTime();
}
