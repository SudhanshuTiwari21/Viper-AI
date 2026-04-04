"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { AuthInput } from "@/components/auth/AuthInput";
import { Button } from "@/components/ui/button";
import { getPublicBackendUrl } from "@/lib/backend-url";
import { persistAccessToken } from "@/lib/auth-client";
import { isDesktopAuthReturnIntent, setDesktopAuthReturnIntent } from "@/lib/desktop-auth-return";
import { redirectToDesktopIdeIfNeeded } from "@/lib/desktop-handoff";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const source = searchParams.get("source");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  useEffect(() => {
    if (source === "desktop" || source === "viper-desktop") {
      setDesktopAuthReturnIntent();
    }
  }, [source]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setVerifyMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        details?: { fieldErrors?: Record<string, string[]> };
        verificationRequired?: boolean;
        message?: string;
        accessToken?: string;
      };
      if (!res.ok) {
        const flat = data.details?.fieldErrors;
        const first =
          flat && typeof flat === "object"
            ? Object.values(flat).flat()[0]
            : typeof data.error === "string"
              ? data.error
              : "Registration failed.";
        setError(first);
        return;
      }
      if (data.verificationRequired) {
        const base =
          data.message ??
          "We sent a verification link to your email. After verifying, you can sign in.";
        const extra = isDesktopAuthReturnIntent()
          ? " Then open Sign in from the Viper desktop app (with the same browser session) or visit the login link from the app again."
          : "";
        setVerifyMsg(base + extra);
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
  const loginHref =
    source === "desktop" || source === "viper-desktop" ? "/login?source=desktop" : "/login";

  return (
    <AuthCard
      title="Create account"
      subtitle="Passwords are hashed with Argon2id. Use a strong unique password (10+ chars, mixed case and numbers)."
    >
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200/90"
        >
          {error}
        </div>
      ) : null}
      {verifyMsg ? (
        <div
          role="status"
          className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100/90"
        >
          {verifyMsg}
        </div>
      ) : null}

      <a
        href={googleUrl}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-white/20 bg-white/[0.06] py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        Sign up with Google
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
          <label htmlFor="name" className="mb-1.5 block text-xs font-medium text-white/50">
            Display name <span className="text-white/30">(optional)</span>
          </label>
          <AuthInput
            id="name"
            name="displayName"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-white/35">10+ characters with upper, lower, and a number.</p>
        </div>
        <Button type="submit" disabled={loading} className="w-full h-10 font-medium">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-white/50">
        Already have an account?{" "}
        <Link href={loginHref} className="text-white underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="text-white/50 text-sm font-sans">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
