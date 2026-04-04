"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { persistAccessToken } from "@/lib/auth-client";
import { redirectToDesktopIdeIfNeeded } from "@/lib/desktop-handoff";

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [msg, setMsg] = useState(() =>
    code ? "Completing sign-in…" : "Missing sign-in code. Try again from the login page.",
  );

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/oauth/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await res.json()) as { error?: string; accessToken?: string };
        if (cancelled) return;
        if (!res.ok) {
          setMsg(typeof data.error === "string" ? data.error : "Sign-in failed.");
          return;
        }
        if (data.accessToken) persistAccessToken(data.accessToken);
        if (data.accessToken && (await redirectToDesktopIdeIfNeeded(data.accessToken))) {
          return;
        }
        router.replace("/");
        router.refresh();
      } catch {
        if (!cancelled) setMsg("Network error.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  return (
    <AuthCard title="Google sign-in" subtitle={msg}>
      <p className="text-sm text-white/50">
        <Link href="/login" className="text-white underline-offset-4 hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
}

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-4">
        <Link href="/" className="text-sm text-white/60 hover:text-white transition-colors">
          ← Home
        </Link>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <Suspense
          fallback={
            <AuthCard title="Google sign-in" subtitle="Loading…">
              <span />
            </AuthCard>
          }
        >
          <CallbackInner />
        </Suspense>
      </main>
    </div>
  );
}
