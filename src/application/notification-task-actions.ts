/**
 * Notification task actions
 *
 * Responsibility
 * --------------
 * Shared read / mark-all-read helpers and deep-link destination resolution.
 * Click → read; work completion → resolved (elsewhere in workflow services).
 *
 * Does NOT:
 * - create or resolve workflow tasks (ApprovalService / FinanceService / …)
 * - change badge semantics (badge = resolvedAt IS NULL — K-001)
 *
 * Business Rules: BR-33…37
 * Workflows: WF-011
 * Knowledge: K-001, K-009
 * Dependencies: INotificationRepository
 */

import "server-only";

import {
  isActionableNotification,
  type Notification,
} from "@/domain/entities";
import type { INotificationRepository } from "@/infrastructure/repositories/interfaces";
import { notificationDestination } from "@/lib/shared/notification-destination";

export { notificationDestination };

/**
 * Mark one notification read. Informational FYIs are acknowledged (resolved);
 * actionable tasks stay active until workflow completion.
 */
export async function markNotificationRead(
  notifications: INotificationRepository,
  userId: string,
  id: string
): Promise<void> {
  const active = await notifications.listByUser(userId);
  const target = active.find((n) => n.id === id);
  await notifications.markRead(id, userId);
  if (target && !isActionableNotification(target.type)) {
    await notifications.resolveOwn(id, userId);
  }
}

/**
 * Mark all active notifications read. Bulk-acknowledge informational FYIs only;
 * never auto-resolve pending actionable work.
 */
export async function markAllNotificationsRead(
  notifications: INotificationRepository,
  userId: string
): Promise<void> {
  await notifications.markAllRead(userId);
  const active = await notifications.listByUser(userId);
  for (const n of active) {
    if (!isActionableNotification(n.type)) {
      await notifications.resolveOwn(n.id, userId);
    }
  }
}
