import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b] text-white flex flex-col">
      <header className="border-b border-white/10 px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity">
          <Logo />
          <span className="text-sm text-white/60 font-sans">Back to home</span>
        </Link>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">{children}</main>
    </div>
  );
}
