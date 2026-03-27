import { useState, useEffect, useRef } from "react";

/**
 * Returns `true` only after `delayMs` has elapsed while `condition` stays truthy.
 * Resets immediately when `condition` becomes falsy.
 */
export function useDelayedVisible(condition: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (condition) {
      timerRef.current = setTimeout(() => setVisible(true), delayMs);
    } else {
      setVisible(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [condition, delayMs]);

  return visible;
}
