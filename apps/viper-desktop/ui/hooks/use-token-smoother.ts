import { useState, useRef, useEffect, useCallback } from "react";

const FIRST_TOKEN_DELAY_MS = 200;

/**
 * Smooths raw token buffer with irregular chunk sizes, optional first-token delay,
 * and exposes `isCatchingUp` for cursor blink sync (hide while catching up).
 */
export function useTokenSmoother(rawBuffer: string | undefined): {
  text: string;
  isCatchingUp: boolean;
} {
  const [displayed, setDisplayed] = useState("");
  const [flushGateOpen, setFlushGateOpen] = useState(false);
  const targetRef = useRef("");
  const rafRef = useRef<number | undefined>(undefined);
  const prevLenWasZeroRef = useRef(true);
  const gateTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flushGateRef = useRef(false);

  useEffect(() => {
    const t = rawBuffer ?? "";
    targetRef.current = t;

    if (t.length === 0) {
      prevLenWasZeroRef.current = true;
      flushGateRef.current = false;
      setFlushGateOpen(false);
      setDisplayed("");
      if (gateTimerRef.current) {
        clearTimeout(gateTimerRef.current);
        gateTimerRef.current = undefined;
      }
      return;
    }

    if (prevLenWasZeroRef.current) {
      prevLenWasZeroRef.current = false;
      flushGateRef.current = false;
      setFlushGateOpen(false);
      gateTimerRef.current = setTimeout(() => {
        flushGateRef.current = true;
        setFlushGateOpen(true);
        gateTimerRef.current = undefined;
      }, FIRST_TOKEN_DELAY_MS);
    }
  }, [rawBuffer]);

  useEffect(() => {
    return () => {
      if (gateTimerRef.current) clearTimeout(gateTimerRef.current);
    };
  }, []);

  const flush = useCallback(() => {
    setDisplayed((prev) => {
      if (!flushGateRef.current) return prev;
      const target = targetRef.current;
      if (prev.length >= target.length) return target;
      const remaining = target.length - prev.length;
      const chunkSize = Math.min(Math.floor(Math.random() * 6) + 2, remaining);
      return target.slice(0, prev.length + chunkSize);
    });
    rafRef.current = requestAnimationFrame(flush);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(flush);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [flush]);

  const targetLen = rawBuffer?.length ?? 0;
  const isCatchingUp =
    targetLen > 0 && (!flushGateOpen || displayed.length < targetLen);

  const text =
    displayed.length > targetLen ? (rawBuffer ?? "") : displayed;

  return { text, isCatchingUp };
}
