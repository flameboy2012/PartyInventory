import { useCallback, useSyncExternalStore } from "react";

/** A party the user has created or joined, remembered locally for quick re-entry. */
export type RememberedParty = {
  id: string;
  name: string;
  joinCode?: string;
  /** The display name this player uses in this party. Scoped per party by design. */
  actorName?: string;
  lastOpenedAt: string; // ISO timestamp
};

const STORAGE_KEY = "party-inventory:remembered-parties";

const NONE: RememberedParty[] = [];

// Storage is the source of truth, and it is also read from outside React (the API client looks up
// the actor name on every write), so components subscribe to it rather than mirroring it in state.
// useSyncExternalStore compares snapshots by identity, so the parsed list is cached against the
// raw string it came from.
let cachedRaw: string | null = null;
let cachedParties: RememberedParty[] = NONE;

const listeners = new Set<() => void>();

function read(): RememberedParty[] {
  if (typeof window === "undefined") return NONE;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return NONE;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedParties = raw ? (JSON.parse(raw) as RememberedParty[]) : NONE;
    } catch {
      cachedParties = NONE;
    }
  }

  return cachedParties;
}

function write(parties: RememberedParty[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parties));
  } catch {
    // Ignore storage being unavailable or full.
  }

  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// Storage is unreadable during server rendering and the hydrating render, so pages tell "nothing
// stored" apart from "not read yet" and avoid flashing the wrong UI.
const serverLoaded = () => false;
const clientLoaded = () => true;
const serverParties = () => NONE;

/**
 * The display name stored for one party on this device, or undefined when this player has not
 * named themselves here yet. A plain function rather than a hook, because the API client reads it
 * on every mutating request.
 */
export function getActorName(partyId: string): string | undefined {
  const stored = read().find((p) => p.id === partyId)?.actorName?.trim();
  return stored ? stored : undefined;
}

/** Stores the display name to send with this party's writes, leaving other parties alone. */
export function setActorName(partyId: string, actorName: string) {
  const parties = read();
  const existing = parties.find((p) => p.id === partyId);

  write(
    existing
      ? parties.map((p) => (p.id === partyId ? { ...p, actorName } : p))
      : [{ id: partyId, name: "", actorName, lastOpenedAt: new Date().toISOString() }, ...parties],
  );
}

/**
 * Tracks the parties the user has created/joined in browser storage. There is no global
 * directory of parties (that would leak ids and defeat the join code), so this local list
 * is how someone returns to a party they already has access to.
 */
export function useRememberedParties() {
  const parties = useSyncExternalStore(subscribe, read, serverParties);
  const loaded = useSyncExternalStore(subscribe, clientLoaded, serverLoaded);

  const remember = useCallback(
    (party: { id: string; name: string; joinCode?: string; actorName?: string }) => {
      const stored = read();
      const existing = stored.find((p) => p.id === party.id);
      write([
        // Spread the existing record first so re-opening a party keeps its actor name.
        { ...existing, ...party, lastOpenedAt: new Date().toISOString() },
        ...stored.filter((p) => p.id !== party.id),
      ]);
    },
    [],
  );

  const forget = useCallback((id: string) => {
    write(read().filter((p) => p.id !== id));
  }, []);

  return { parties, loaded, remember, forget };
}

/** The display name for one party, with the setter that stores it. */
export function useActorName(partyId: string) {
  const actorName = useSyncExternalStore(
    subscribe,
    () => getActorName(partyId),
    () => undefined,
  );
  const loaded = useSyncExternalStore(subscribe, clientLoaded, serverLoaded);

  const save = useCallback((name: string) => setActorName(partyId, name.trim()), [partyId]);

  return { actorName, loaded, save };
}
