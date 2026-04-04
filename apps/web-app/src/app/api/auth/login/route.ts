import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerBackendUrl } from "@/lib/backend-url";

const REFRESH_COOKIE = "viper_refresh";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const base = getServerBackendUrl();
  const res = await fetch(`${base.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }
  const refreshToken = typeof data.refreshToken === "string" ? data.refreshToken : "";
  if (refreshToken) {
    const jar = await cookies();
    jar.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
  }
  return NextResponse.json(
    {
      user: data.user,
      accessToken: data.accessToken,
      expiresIn: data.expiresIn,
    },
    { status: res.status },
  );
}
