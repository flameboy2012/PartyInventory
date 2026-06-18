import { useCallback, useEffect, useState } from "react";

/** A party the user has created or joined, remembered locally for quick re-entry. */
export type RememberedParty = {
  id: string;
  name: string;
  joinCode?: string;
  lastOpenedAt: string; // ISO timestamp
};

const STORAGE_KEY = "party-inventory:remembered-parties";

function read(): RememberedParty[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RememberedParty[]) : [];
  } catch {
    return [];
  }
}

function write(parties: RememberedParty[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parties));
  } catch {
    // Ignore storage being unavailable or full.
  }
}

/**
 * Tracks the parties the user has created/joined in browser storage. There is no global
 * directory of parties (that would leak ids and defeat the join code), so this local list
 * is how someone returns to a party they already has access to.
 */
export function useRememberedParties() {
  const [parties, setParties] = useState<RememberedParty[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setParties(read());
    setLoaded(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setParties(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const remember = useCallback(
    (party: { id: string; name: string; joinCode?: string }) => {
      setParties((prev) => {
        const next = [
          { ...party, lastOpenedAt: new Date().toISOString() },
          ...prev.filter((p) => p.id !== party.id),
        ];
        write(next);
        return next;
      });
    },
    [],
  );

  const forget = useCallback((id: string) => {
    setParties((prev) => {
      const next = prev.filter((p) => p.id !== id);
      write(next);
      return next;
    });
  }, []);

  return { parties, loaded, remember, forget };
}
