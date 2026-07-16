import { NextResponse } from "next/server";

export async function POST() {
  const correlationId = crypto.randomUUID();
  return NextResponse.json(
    {
      error: {
        code: "ADMIN_PROVISIONED_ACCOUNTS",
        message: "Accounts are created by the System Administrator.",
        correlationId,
      },
    },
    { status: 403 }
  );
}
