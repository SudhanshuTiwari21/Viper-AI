"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#architecture", label: "Architecture" },
  { href: "#agents", label: "Agents" },
  { href: "#", label: "Docs" },
  { href: "https://github.com", label: "GitHub", external: true },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed left-0 right-0 top-0 z-50">
      <motion.nav
        className="mx-4 mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/80 px-5 py-3 backdrop-blur-xl md:mx-6 md:px-6"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight text-zinc-100 transition-colors hover:text-cyan-400"
        >
          <span className="text-lg">Viper AI</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100 hover:shadow-[0_0_20px_rgba(0,212,255,0.08)]"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="#"
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-100"
          >
            Login
          </Link>
          <Link
            href="#control-center"
            className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-all hover:bg-cyan-500/30 hover:shadow-[0_0_24px_rgba(0,212,255,0.2)]"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-zinc-100 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </motion.nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 top-[72px] z-40 bg-black/60 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          >
            <motion.div
              className="mt-4 mx-4 rounded-2xl border border-white/10 bg-zinc-900/95 p-4 shadow-xl"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={(e) => e.stopPropagation()}
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  className="block rounded-lg px-4 py-3 text-zinc-300 hover:bg-white/5 hover:text-cyan-400"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="my-2 border-t border-white/10" />
              <Link
                href="#"
                className="block rounded-lg px-4 py-3 text-zinc-400"
                onClick={() => setMobileOpen(false)}
              >
                Login
              </Link>
              <Link
                href="#control-center"
                className="mt-2 block rounded-lg bg-cyan-500/20 px-4 py-3 text-center font-medium text-cyan-400"
                onClick={() => setMobileOpen(false)}
              >
                Get Started
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
