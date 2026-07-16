import type { User } from "@/domain/entities";

/**
 * Dual gate: development Node env AND explicit opt-in flag.
 * Production builds never satisfy NODE_ENV=development.
 */
export function isDevelopmentToolkitEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.ENABLE_DEVELOPMENT_TOOLKIT === "true"
  );
}

export class DevelopmentToolkitNotFoundError extends Error {
  readonly status = 404;
  constructor(message = "Not Found") {
    super(message);
    this.name = "DevelopmentToolkitNotFoundError";
  }
}

/** Throws 404-shaped error unless toolkit is enabled and actor is SystemAdmin. */
export function assertDevelopmentToolkitAccess(actor: User): void {
  if (!isDevelopmentToolkitEnabled()) {
    throw new DevelopmentToolkitNotFoundError();
  }
  if (!actor.roleCodes.includes("SystemAdmin")) {
    throw new DevelopmentToolkitNotFoundError();
  }
}

export function isDevelopmentToolkitPath(pathname: string): boolean {
  return (
    pathname === "/admin/development" ||
    pathname.startsWith("/admin/development/") ||
    pathname === "/api/v1/development" ||
    pathname.startsWith("/api/v1/development/")
  );
}
