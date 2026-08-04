import { useEffect, useRef, useState } from "react";

/**
 * Skeletons that appear for a single frame are worse than no skeleton at all:
 * the layout snaps twice and the eye reads it as a glitch. This hook gives every
 * query skeleton the same two guards the router uses for route transitions:
 *
 *  - `delayMs`  — nothing is shown for the first 150ms, so a fast query (empty
 *                 tables, warm cache) renders straight to content.
 *  - `minMs`    — once a skeleton IS shown it stays for at least 400ms, so a
 *                 query that resolves at 160ms does not flash.
 */
export function useDelayedLoading(
  isLoading: boolean,
  { delayMs = 150, minMs = 400 }: { delayMs?: number; minMs?: number } = {},
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      if (visible) return;
      timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, delayMs);
    } else if (visible) {
      const elapsed = shownAt.current ? Date.now() - shownAt.current : minMs;
      const remaining = Math.max(0, minMs - elapsed);
      timer = setTimeout(() => {
        shownAt.current = null;
        setVisible(false);
      }, remaining);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, visible, delayMs, minMs]);

  return visible;
}
