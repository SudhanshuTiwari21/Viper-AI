import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerBackendUrl } from "@/lib/backend-url";

const REFRESH_COOKIE = "viper_refresh";

export async function POST() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  jar.delete(REFRESH_COOKIE);
  if (refreshToken) {
    const base = getServerBackendUrl();
    await fetch(`${base.replace(/\/$/, "")}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
