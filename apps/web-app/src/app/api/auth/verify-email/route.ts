import { NextResponse } from "next/server";
import { getServerBackendUrl } from "@/lib/backend-url";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const base = getServerBackendUrl();
  const res = await fetch(
    `${base.replace(/\/$/, "")}/auth/verify-email?token=${encodeURIComponent(token)}`,
    { method: "GET", cache: "no-store" },
  );
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
