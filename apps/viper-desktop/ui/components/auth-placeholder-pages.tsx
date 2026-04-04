/**
 * In-app entry to web auth: opens the marketing app in the system browser with ?source=desktop.
 * After sign-in, the browser redirects to viper://auth/callback?code=… and Electron completes the session.
 */

import type { ReactNode } from "react";
import { ArrowLeft, ExternalLink, LogIn, UserPlus } from "lucide-react";
import { useAppRoute } from "../contexts/app-route-context";
import { getWebAppLoginUrl, getWebAppSignupUrl } from "../lib/web-app-auth-url";

function AuthShell({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: React.ReactNode;
}) {
  const { navigate } = useAppRoute();

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center px-6 py-12"
      style={{ background: "var(--viper-bg)", color: "#e5e7eb" }}
    >
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-[13px] text-[#9ca3af] hover:text-[#e5e7eb] mb-8 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Viper
        </button>
        <div
          className="rounded-xl border p-8 shadow-xl"
          style={{
            borderColor: "var(--viper-border)",
            background: "var(--viper-sidebar)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.35)",
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(59,130,246,0.15)" }}
            >
              {icon}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#f9fafb] tracking-tight">{title}</h1>
              <p className="text-[13px] text-[#9ca3af] mt-0.5">{subtitle}</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginPlaceholderPage() {
  const { navigate } = useAppRoute();

  const openBrowser = () => {
    const open = window.viper?.shell?.openExternal;
    if (open) void open(getWebAppLoginUrl());
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Complete sign-in in your browser — you will return to the IDE automatically."
      icon={<LogIn size={20} className="text-[var(--viper-accent)]" />}
    >
      <p className="text-[13px] text-[#9ca3af] leading-relaxed">
        We open the Viper web app so you can use email, Google, or password sign-in securely. When you are
        done, the app reopens here with your account.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          type="button"
          onClick={openBrowser}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--viper-accent)", color: "#0b0f17" }}
        >
          <ExternalLink size={16} />
          Open sign in in browser
        </button>
        <button
          type="button"
          onClick={() => navigate("/register")}
          className="flex-1 rounded-lg border border-[var(--viper-border)] px-4 py-2.5 text-[13px] font-medium text-[#e5e7eb] hover:bg-white/5"
        >
          Create account
        </button>
      </div>
      <p className="text-[11px] text-[#6b7280] pt-2 leading-relaxed">
        Requires the <code className="text-[#9ca3af]">viper://</code> protocol (registered when you install the
        app). Dev: run a production build once or test with the app already running.
      </p>
    </AuthShell>
  );
}

export function RegisterPlaceholderPage() {
  const { navigate } = useAppRoute();

  const openBrowser = () => {
    const open = window.viper?.shell?.openExternal;
    if (open) void open(getWebAppSignupUrl());
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Register in the browser, then sign in from the IDE when you are ready."
      icon={<UserPlus size={20} className="text-[var(--viper-accent)]" />}
    >
      <p className="text-[13px] text-[#9ca3af] leading-relaxed">
        Account creation and email verification happen on the web. After you verify your email, use Sign in
        here to open the browser again and finish in the IDE.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <button
          type="button"
          onClick={openBrowser}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium transition-opacity hover:opacity-90"
          style={{ background: "var(--viper-accent)", color: "#0b0f17" }}
        >
          <ExternalLink size={16} />
          Open sign up in browser
        </button>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--viper-border)] px-4 py-2.5 text-[13px] font-medium text-[#e5e7eb] hover:bg-white/5"
        >
          <LogIn size={16} />
          Sign in instead
        </button>
      </div>
    </AuthShell>
  );
}
