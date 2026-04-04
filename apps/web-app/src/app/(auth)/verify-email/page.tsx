"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";

function VerifyInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "err">(() =>
    token ? "loading" : "err",
  );
  const [message, setMessage] = useState(() =>
    token ? "" : "Missing verification token in the link.",
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as { error?: string; message?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatus("err");
          setMessage(typeof data.error === "string" ? data.error : "Verification failed.");
          return;
        }
        setStatus("ok");
        setMessage(typeof data.message === "string" ? data.message : "Email verified.");
      } catch {
        if (!cancelled) {
          setStatus("err");
          setMessage("Network error.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthCard
      title="Verify email"
      subtitle={
        status === "loading"
          ? "Confirming your address…"
          : status === "ok"
            ? message
            : message
      }
    >
      {status === "ok" ? (
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-md bg-white py-2.5 text-sm font-medium text-black hover:bg-neutral-200 transition-colors"
        >
          Sign in
        </Link>
      ) : status === "err" ? (
        <Link href="/signup" className="text-sm text-white/70 underline-offset-4 hover:underline">
          Try signing up again
        </Link>
      ) : null}
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthCard title="Verify email" subtitle="Loading…">
          <span />
        </AuthCard>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
