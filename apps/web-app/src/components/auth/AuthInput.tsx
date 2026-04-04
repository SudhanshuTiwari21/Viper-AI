import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function AuthInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2.5 text-sm text-white",
        "placeholder:text-white/35 outline-none transition-colors",
        "focus:border-white/40 focus:ring-1 focus:ring-white/20",
        "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
