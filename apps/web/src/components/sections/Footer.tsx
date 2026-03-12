"use client";

import Link from "next/link";

const FOOTER_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#architecture", label: "Architecture" },
  { href: "#", label: "Docs" },
  { href: "https://github.com", label: "GitHub", external: true },
  { href: "#", label: "Community" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/5 bg-[#030304] py-14">
      <div className="noise-overlay absolute inset-0" />
      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 px-6 md:flex-row">
        <Link
          href="/"
          className="font-semibold tracking-tight text-zinc-100 transition-colors hover:text-cyan-400"
        >
          Viper AI
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-8">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="text-sm text-zinc-500 transition-colors hover:text-cyan-400"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
