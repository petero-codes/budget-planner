import { NextResponse } from "next/server";

export async function POST() {
  const correlationId = crypto.randomUUID();
  return NextResponse.json(
    {
      error: {
        code: "ADMIN_PASSWORD_RESET",
        message: "Password resets are handled by the System Administrator.",
        correlationId,
      },
    },
    { status: 403 }
  );
}
