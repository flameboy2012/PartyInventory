"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tracks a media query, for the two surfaces that swap primitive between breakpoints rather than
 * restyle one.
 *
 * The server snapshot is `false`, so a `(min-width: 768px)` query gives the phone answer during
 * SSR and hydration. The phone is the primary target and renders without a flash; the desktop
 * pays one reconciliation instead. `useSyncExternalStore` swaps in the real value after
 * hydration, so the two renders never disagree.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
