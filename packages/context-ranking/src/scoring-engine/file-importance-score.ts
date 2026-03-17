import type { ContextCandidate } from "../candidate-generator/candidate.types.js";
import type { ScoringContext } from "./scoring.types.js";

const ROUTES = 0.2;
const CONTROLLERS = 0.2;
const SERVICES = 0.15;
const UTILS = 0.05;

/**
 * File importance by path pattern. Returns 0–0.2.
 */
export function computeFileImportanceScore(
  candidate: ContextCandidate,
  _context: ScoringContext,
): number {
  const file = candidate.file ?? "";
  if (!file) return 0;
  const normalized = file.replace(/\\/g, "/");
  if (normalized.includes("routes/")) return ROUTES;
  if (normalized.includes("controllers/")) return CONTROLLERS;
  if (normalized.includes("services/")) return SERVICES;
  if (normalized.includes("utils/")) return UTILS;
  return 0;
}
