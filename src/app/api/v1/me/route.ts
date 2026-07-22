import { NextResponse } from "next/server";
import {
  authorizationService,
  getCurrentUser,
  getRepositoryDriver,
  repos,
} from "@/infrastructure/di";
import { mockStore } from "@/infrastructure/repositories/mock/store";
import { isDevelopmentToolkitEnabled } from "@/lib/development-toolkit-access";
import { SESSION_COOKIE } from "@/infrastructure/session";

/**
 * GET /api/v1/me — session identity + badge count (unresolved notifications).
 * WF-016 / WF-011 (badge). Does not mutate.
 */
function isAuthFailure(message: string): boolean {
  return (
    message === "Not signed in" ||
    message.includes("Current user not found")
  );
}

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const positionPromise =
      getRepositoryDriver() === "sql"
        ? (() => {
            const sqlRepos = require("@/infrastructure/repositories/sql") as typeof import("@/infrastructure/repositories/sql");
            return sqlRepos.getPositionById(user.positionId);
          })()
        : Promise.resolve(
            mockStore.positions.find((p) => p.id === user.positionId) ?? null
          );
    const [notifications, position] = await Promise.all([
      repos.notifications.listByUser(user.id),
      positionPromise,
    ]);
    return NextResponse.json({
      data: {
        user,
        position,
        orgRole: authorizationService.resolveOrgRole(user),
        canExport: authorizationService.canExport(user),
        // Badge is a to-do count: active (unresolved) notifications, regardless
        // of read state. listByUser already excludes resolved/archived rows.
        unreadNotifications: notifications.length,
        // Server-only env; never rely on process.env in client bundles for this gate.
        developmentToolkitEnabled: isDevelopmentToolkitEnabled(),
      },
      correlationId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not signed in";
    if (isAuthFailure(message)) {
      const res = NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message,
            correlationId,
          },
        },
        { status: 401 }
      );
      // Clear orphaned cookie so middleware stops serving portal pages for a dead session.
      res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    // Infrastructure / schema failures must not look like "signed out".
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL",
          message:
            process.env.NODE_ENV === "production"
              ? "Unable to load session profile"
              : message,
          correlationId,
        },
      },
      { status: 500 }
    );
  }
}
