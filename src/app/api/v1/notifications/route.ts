/**
 * Notifications API — WF-011 / K-001
 * GET  → active (unresolved) or ?view=history
 * PATCH → mark one / all read (does not resolve)
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, repos } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/application/notification-task-actions";

/**
 * GET  /api/v1/notifications            → active (unresolved) to-do list
 * GET  /api/v1/notifications?view=history → resolved history
 */
export async function GET(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const includeResolved = req.nextUrl.searchParams.get("view") === "history";
    const data = await repos.notifications.listByUser(user.id, {
      includeResolved,
    });
    return NextResponse.json({ data, correlationId });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: e instanceof Error ? e.message : "Not signed in",
          correlationId,
        },
      },
      { status: 401 }
    );
  }
}

/**
 * POST /api/v1/notifications?action=read&id=... → mark one read (and acknowledge
 *   it if it is informational; actionable work stays until the workflow resolves it)
 * POST /api/v1/notifications?action=readAll      → mark all active read + acknowledge FYIs
 */
export async function POST(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const action = req.nextUrl.searchParams.get("action") ?? "read";

    if (action === "readAll") {
      await markAllNotificationsRead(repos.notifications, user.id);
      return NextResponse.json({ data: { ok: true }, correlationId });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION", message: "id is required", correlationId },
        },
        { status: 422 }
      );
    }

    await markNotificationRead(repos.notifications, user.id, id);
    return NextResponse.json({ data: { ok: true }, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}

/**
 * DELETE /api/v1/notifications?id=... → archive a resolved notification from
 *   history. Refuses to remove still-pending (unresolved) work.
 */
export async function DELETE(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        {
          error: { code: "VALIDATION", message: "id is required", correlationId },
        },
        { status: 422 }
      );
    }
    await repos.notifications.archiveResolved(id, user.id);
    return NextResponse.json({ data: { ok: true }, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}
