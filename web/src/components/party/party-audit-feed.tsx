"use client";

import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import type { AuditEntryResponse, AuditFeedResponse } from "@/lib/api/types";

/**
 * Entries per request. Asked for explicitly rather than left to the server's default, so this
 * page size can be changed here alone.
 */
const PAGE_SIZE = 50;

/** SWR key for a party's newest page, so the party page can revalidate it on a change ping. */
export function auditFeedKey(partyId: string) {
  return `/api/parties/${partyId}/audit?take=${PAGE_SIZE}`;
}

/** Pages already loaded belong to one party, so mount this with `key={partyId}`. */
export function PartyAuditFeed({ partyId }: { partyId: string }) {
  const { data, error, isLoading } = useSWR<AuditFeedResponse>(auditFeedKey(partyId));
  const [olderPages, setOlderPages] = useState<AuditFeedResponse[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const entries = dedupeById([...(data?.entries ?? []), ...olderPages.flatMap((p) => p.entries)]);
  const cursor =
    olderPages.length > 0 ? olderPages[olderPages.length - 1].nextCursor : (data?.nextCursor ?? null);

  async function loadOlder() {
    if (!cursor) return;
    setLoadingOlder(true);
    try {
      const response = await fetch(
        `${auditFeedKey(partyId)}&before=${encodeURIComponent(cursor)}`,
      );
      if (response.ok) {
        const page = (await response.json()) as AuditFeedResponse;
        setOlderPages((pages) => [...pages, page]);
      }
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <section className="space-y-3" aria-label="History">
      <h2 className="text-sm font-medium text-muted-foreground">History</h2>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">Couldn&apos;t load this party&apos;s history.</p>}

      {!isLoading && !error && entries.length === 0 && (
        <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
          Nothing has changed yet. Actions you take show up here.
        </p>
      )}

      {entries.length > 0 && (
        <ol className="divide-y rounded-lg border">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 px-3 py-2 text-sm">
              <span className="font-medium">{entry.actorName}</span>
              <span>{entry.detail}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {relativeTime(entry.occurredAt)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {cursor && (
        <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>
          {loadingOlder ? "Loading…" : "Load older"}
        </Button>
      )}
    </section>
  );
}

/** The newest page can overlap an already-loaded older page once new entries arrive. */
function dedupeById(entries: AuditEntryResponse[]): AuditEntryResponse[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function relativeTime(iso: string): string {
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";

  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["week", 604800],
    ["month", 2629800],
    ["year", 31557600],
  ];

  let [unit, size] = units[0];
  for (const [nextUnit, nextSize] of units) {
    if (seconds >= nextSize) [unit, size] = [nextUnit, nextSize];
  }

  return format.format(-Math.round(seconds / size), unit);
}
