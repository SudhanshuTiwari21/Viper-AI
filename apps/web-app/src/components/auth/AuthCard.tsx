import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div
      className="w-full max-w-[420px] rounded-xl border border-white/10 bg-black/40 p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_48px_rgba(0,0,0,0.45)]"
      style={{ backdropFilter: "blur(12px)" }}
    >
      <h1 className="font-[family-name:var(--font-orbitron)] text-xl tracking-tight text-white">{title}</h1>
      {subtitle ? <p className="mt-2 text-sm text-white/55 leading-relaxed font-sans">{subtitle}</p> : null}
      <div className="mt-8 space-y-5 font-sans">{children}</div>
    </div>
  );
}
