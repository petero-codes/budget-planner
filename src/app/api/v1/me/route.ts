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
        unreadNotifications: notifications.filter((n) => !n.isRead).length,
        // Server-only env; never rely on process.env in client bundles for this gate.
        developmentToolkitEnabled: isDevelopmentToolkitEnabled(),
      },
      correlationId,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Not signed in";
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
    if (message.includes("Current user not found") || message === "Not signed in") {
      res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    }
    return res;
  }
}
