import { NextResponse } from "next/server";
import { AuthorizationError } from "@/application/authorization-service";
import { getCurrentUser, repos } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    if (!user.permissionCodes.includes("audit.view")) {
      throw new AuthorizationError("Missing permission: audit.view");
    }
    const data = await repos.audits.list();
    return NextResponse.json({ data, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}
