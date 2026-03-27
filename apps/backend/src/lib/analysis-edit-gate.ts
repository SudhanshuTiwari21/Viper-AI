import { runCodebaseAnalysisIfConfigured } from "../services/analysis-options.service.js";

/**
 * Shared wiring for `VIPER_REQUIRE_ANALYSIS_FOR_EDITS`: mutates `gateState.analysisReady`
 * when `runCodebaseAnalysisIfConfigured` settles (mirrors the main agentic path).
 *
 * Returns the same promise so callers can race it for warmup or attach background logs.
 */
export function attachAnalysisGateForEdits(
  workspacePath: string,
  repo_id: string,
  gateState: { analysisReady: boolean },
): ReturnType<typeof runCodebaseAnalysisIfConfigured> {
  const analysisPromise = runCodebaseAnalysisIfConfigured(workspacePath, repo_id);
  analysisPromise
    .then((ran) => {
      gateState.analysisReady = Boolean(ran);
    })
    .catch(() => {
      gateState.analysisReady = false;
    });
  return analysisPromise;
}
