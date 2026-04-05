import { useState, useEffect, useCallback } from "react";
import {
  fetchUsageSummary,
  type UsageSummaryResponse,
} from "../services/agent-api.js";

export interface UseWorkspaceUsageSummaryResult {
  /** Last successful summary; null before first load or when endpoint disabled (404). */
  usage: UsageSummaryResponse | null;
  /** True after VIPER_USAGE_UI_ENABLED off (404). */
  usageEndpointDisabled: boolean;
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Loads POST /usage/summary for the workspace (when enabled).
 * Errors keep the previous snapshot so chat UI does not flicker on transient failures.
 */
export function useWorkspaceUsageSummary(
  workspacePath: string | null | undefined,
): UseWorkspaceUsageSummaryResult {
  const [usage, setUsage] = useState<UsageSummaryResponse | null>(null);
  const [usageEndpointDisabled, setUsageEndpointDisabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!workspacePath?.trim()) {
      setUsage(null);
      setUsageEndpointDisabled(false);
      return;
    }
    setLoading(true);
    try {
      const result = await fetchUsageSummary(workspacePath);
      if (result === null) {
        setUsageEndpointDisabled(true);
        setUsage(null);
      } else {
        setUsageEndpointDisabled(false);
        setUsage(result);
      }
    } catch {
      // Keep prior usage; composer hint / tier lock degrade gracefully
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { usage, usageEndpointDisabled, loading, refetch };
}
