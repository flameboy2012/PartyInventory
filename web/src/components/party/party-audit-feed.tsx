"use client";

import { useState } from "react";
import useSWR from "swr";
import { initialsOf } from "@/components/party/holder-picker";
import { Button } from "@/components/ui/button";
import type { AuditAction, AuditEntryResponse, AuditFeedResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Entries per request. Asked for explicitly rather than left to the server's default, so this
 * page size can be changed here alone.
 */
const PAGE_SIZE = 50;

/** SWR key for a party's newest page, so the party page can revalidate it on a change ping. */
export function auditFeedKey(partyId: string) {
  return `/api/parties/${partyId}/audit?take=${PAGE_SIZE}`;
}

type Category = "items" | "coins" | "characters";
type Filter = "all" | Category;

/**
 * Every recorded action falls into exactly one category, so narrowing never hides a change from
 * all of them. Keyed exhaustively: a thirteenth action on the API is a compile error here rather
 * than an entry that silently disappears from every filter.
 */
const ACTION_CATEGORY: Record<AuditAction, Category> = {
  ItemAdded: "items",
  ItemEdited: "items",
  ItemMoved: "items",
  ItemDeleted: "items",
  PartyCoinsSet: "coins",
  PartyCoinsSpent: "coins",
  CoinsTransferred: "coins",
  CharacterCoinsSet: "coins",
  CharacterCoinsSpent: "coins",
  CharacterCreated: "characters",
  CharacterEdited: "characters",
  CharacterDeleted: "characters",
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "items", label: "Items" },
  { value: "coins", label: "Coins" },
  { value: "characters", label: "Characters" },
];

/** Pages already loaded belong to one party, so mount this with `key={partyId}`. */
export function PartyAuditFeed({ partyId }: { partyId: string }) {
  const { data, error, isLoading } = useSWR<AuditFeedResponse>(auditFeedKey(partyId));
  const [olderPages, setOlderPages] = useState<AuditFeedResponse[]>([]);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const entries = dedupeById([...(data?.entries ?? []), ...olderPages.flatMap((p) => p.entries)]);
  const cursor =
    olderPages.length > 0 ? olderPages[olderPages.length - 1].nextCursor : (data?.nextCursor ?? null);

  // Narrowing applies to the pages loaded so far, not to the party's whole history.
  const shown = filter === "all" ? entries : entries.filter((e) => ACTION_CATEGORY[e.action] === filter);
  const days = groupByDay(shown);

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
    <section className="mt-3 space-y-3" aria-label="History">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "inline-flex h-11 items-center rounded-4xl border px-3.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8",
              filter === value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">Couldn&apos;t load this party&apos;s history.</p>}

      {/* Say plainly what the window is, so a narrowed view is never read as the whole record. */}
      {filter !== "all" && !isLoading && !error && (
        <p className="text-xs text-muted-foreground">
          {shown.length} of {entries.length} loaded changes
        </p>
      )}

      {!isLoading && !error && entries.length === 0 && (
        <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">
          Nothing has changed yet. Actions you take show up here.
        </p>
      )}

      {days.map((day) => (
        <div key={day.key}>
          <h3 className="border-b border-foreground pt-2 pb-1.5 text-[10.5px] uppercase tracking-[0.07em] text-ring md:flex md:justify-between">
            <span>{day.label}</span>
            <span className="hidden md:inline">
              {day.entries.length} {day.entries.length === 1 ? "change" : "changes"}
            </span>
          </h3>
          <ol>
            {day.entries.map((entry) => (
              <li
                key={entry.id}
                className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 border-b px-2 py-2.5 md:grid-cols-[36px_minmax(0,1fr)_130px] md:items-center md:px-1 md:py-3"
              >
                <span
                  aria-hidden
                  className="flex size-[30px] items-center justify-center self-start rounded-4xl bg-muted text-[11px] font-medium md:size-9 md:self-center"
                >
                  {initialsOf(entry.actorName)}
                </span>
                <span className="min-w-0">
                  {/* The server's wording, rendered verbatim — the layout is built around it. */}
                  <span className="block text-sm leading-[19px]">{entry.detail}</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
                    {entry.actorName}
                    <span className="md:hidden"> · {timeLabel(entry.occurredAt)}</span>
                  </span>
                </span>
                <span className="hidden text-right text-[12.5px] text-muted-foreground md:block">
                  {timeLabel(entry.occurredAt)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}

      {cursor && (
        <Button
          variant="outline"
          size="touch"
          className="w-full md:w-auto"
          onClick={loadOlder}
          disabled={loadingOlder}
        >
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

type Day = { key: string; label: string; entries: AuditEntryResponse[] };

/** Entries arrive newest first, so the days come out newest first without re-sorting. */
function groupByDay(entries: AuditEntryResponse[]): Day[] {
  const days: Day[] = [];
  for (const entry of entries) {
    const date = new Date(entry.occurredAt);
    const key = dayKey(date);
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, label: dayLabel(date), entries: [entry] });
  }
  return days;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(date: Date): string {
  const today = new Date();
  if (dayKey(date) === dayKey(today)) return "Today";

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** Relative while it is still today; a clock time once it isn't. */
function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (dayKey(date) === dayKey(new Date())) return relativeTime(iso);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
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
