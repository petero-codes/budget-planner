import type { Notification } from "@/domain/entities";

/** Deep-link target when the user opens a notification (WF-011). Pure — safe everywhere. */
export function notificationDestination(
  n: Pick<Notification, "targetUrl" | "relatedPlanId">
): string | null {
  if (n.targetUrl) return n.targetUrl;
  if (n.relatedPlanId) return `/budgets/${n.relatedPlanId}`;
  return null;
}
