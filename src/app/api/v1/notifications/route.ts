import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, repos } from "@/infrastructure/di";
import { readApiError } from "@/lib/security/read-api-error";

export async function GET() {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const data = await repos.notifications.listByUser(user.id);
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

export async function DELETE(req: NextRequest) {
  const correlationId = crypto.randomUUID();
  try {
    const user = await getCurrentUser();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION",
            message: "id is required",
            correlationId,
          },
        },
        { status: 422 }
      );
    }
    await repos.notifications.dismiss(id, user.id);
    return NextResponse.json({ data: { ok: true }, correlationId });
  } catch (e) {
    return readApiError(e, correlationId);
  }
}
