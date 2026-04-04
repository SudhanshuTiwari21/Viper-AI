import { NextResponse } from "next/server";
import { getServerBackendUrl } from "@/lib/backend-url";

export async function POST(req: Request) {
  const authz = req.headers.get("authorization");
  if (!authz?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Authorization required." }, { status: 401 });
  }
  const base = getServerBackendUrl();
  const res = await fetch(`${base.replace(/\/$/, "")}/auth/desktop/handoff`, {
    method: "POST",
    headers: { Authorization: authz },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(data, { status: res.status });
}
