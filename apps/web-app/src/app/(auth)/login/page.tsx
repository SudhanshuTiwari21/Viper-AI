"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { Button } from "@/components/ui/button";
import { getPublicBackendUrl } from "@/lib/backend-url";
import { persistAccessToken } from "@/lib/auth-client";
import { setDesktopAuthReturnIntent } from "@/lib/desktop-auth-return";
import { redirectToDesktopIdeIfNeeded } from "@/lib/desktop-handoff";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  const oauthError = searchParams.get("error");
  const oauthMessage =
    oauthError === "oauth_denied"
      ? "Google sign-in was cancelled."
      : oauthError === "oauth_invalid"
        ? "Invalid OAuth response. Try again."
        : oauthError
          ? (() => {
              try {
                return decodeURIComponent(oauthError.replace(/\+/g, " "));
              } catch {
                return oauthError;
              }
            })()
          : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(oauthMessage);

  useEffect(() => {
    if (source === "desktop" || source === "viper-desktop") {
      setDesktopAuthReturnIntent();
    }
  }, [source]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string; accessToken?: string };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Sign-in failed.");
        return;
      }
      if (data.accessToken) persistAccessToken(data.accessToken);
      if (data.accessToken && (await redirectToDesktopIdeIfNeeded(data.accessToken))) {
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  const googleUrl = `${getPublicBackendUrl().replace(/\/$/, "")}/auth/google/start`;

  return (
    <AuthCard
      title="Sign in"
      subtitle="Use your Viper account. OAuth and email credentials are protected with Argon2id and rotating refresh tokens."
    >
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200/90"
        >
          {error}
        </div>
      ) : null}

      <a
        href={googleUrl}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/[0.06] py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </a>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wider">
          <span className="bg-[#09090b] px-2 text-white/40">or email</span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-white/50">
            Email
          </label>
          <AuthInput
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-white/50">
            Password
          </label>
          <AuthInput
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full h-10 font-medium">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-white/50">
        No account?{" "}
        <Link
          href={
            source === "desktop" || source === "viper-desktop" ? "/signup?source=desktop" : "/signup"
          }
          className="text-white underline-offset-4 hover:underline"
        >
          Create one
        </Link>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-white/50 text-sm font-sans">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
