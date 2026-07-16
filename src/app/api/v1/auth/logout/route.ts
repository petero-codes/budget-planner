import { NextResponse } from "next/server";
import { SESSION_COOKIE, setMemoryUserId } from "@/infrastructure/session";

export async function POST() {
  setMemoryUserId("");
  const res = NextResponse.json({ data: { ok: true } });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
