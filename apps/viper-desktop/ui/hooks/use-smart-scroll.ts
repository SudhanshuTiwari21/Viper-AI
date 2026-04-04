import { useRef, useCallback, useEffect } from "react";

/**
 * Smart auto-scroll: scrolls to bottom only if user has NOT scrolled up.
 * Returns refs and a dependency-trigger function.
 */
export function useSmartScroll() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const lastScrollTop = useRef(0);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    isUserScrolledUp.current = distFromBottom > 80;
    lastScrollTop.current = scrollTop;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (isUserScrolledUp.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return { scrollContainerRef, bottomRef, scrollToBottom };
}
