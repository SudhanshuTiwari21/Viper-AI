import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerBackendUrl } from "@/lib/backend-url";

const REFRESH_COOKIE = "viper_refresh";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function POST() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }
  const base = getServerBackendUrl();
  const res = await fetch(`${base.replace(/\/$/, "")}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    jar.delete(REFRESH_COOKIE);
    return NextResponse.json(data, { status: res.status });
  }
  const nextRefresh = typeof data.refreshToken === "string" ? data.refreshToken : "";
  if (nextRefresh) {
    jar.set(REFRESH_COOKIE, nextRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
  }
  return NextResponse.json({
    user: data.user,
    accessToken: data.accessToken,
    expiresIn: data.expiresIn,
  });
}
