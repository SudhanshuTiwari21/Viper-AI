"use client";

import { motion, AnimatePresence } from "framer-motion";

type ArchitecturePanelProps = {
  title: string;
  description: string;
  isOpen: boolean;
  onClose: () => void;
};

export function ArchitecturePanel({
  title,
  description,
  isOpen,
  onClose,
}: ArchitecturePanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            className="relative max-w-md rounded-xl border border-cyan-500/30 bg-zinc-900/95 p-6 shadow-[0_0_40px_rgba(0,212,255,0.15)]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-cyan-400">{title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{description}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
