"use client";

import { motion } from "framer-motion";

type GlowCardProps = {
  children: React.ReactNode;
  className?: string;
  glow?: "blue" | "violet";
  hover?: boolean;
};

export function GlowCard({
  children,
  className = "",
  glow = "blue",
  hover = true,
}: GlowCardProps) {
  return (
    <motion.div
      className={`rounded-xl border bg-black/40 backdrop-blur-sm ${className} ${
        glow === "blue" ? "panel-glow border-cyan-500/20" : "panel-glow-violet border-violet-500/20"
      }`}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={
        hover
          ? {
              boxShadow:
                glow === "blue"
                  ? "0 0 0 1px rgba(0, 212, 255, 0.4), 0 0 40px rgba(0, 212, 255, 0.15)"
                  : "0 0 0 1px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.15)",
            }
          : undefined
      }
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
