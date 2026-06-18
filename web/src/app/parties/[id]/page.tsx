"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import type { PartyResponse } from "@/lib/api/types";

export default function PartyPage() {
  const { id } = useParams<{ id: string }>();
  const { data: party, error, isLoading } = useSWR<PartyResponse>(`/api/parties/${id}`);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← All parties
      </Link>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="mt-8 text-sm text-destructive">Couldn&apos;t load this party.</p>}

      {party && (
        <div className="mt-4">
          <h1 className="text-2xl font-semibold tracking-tight">{party.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share code:{" "}
            <span className="font-mono font-medium text-foreground">{party.joinCode}</span>
          </p>
          <p className="mt-8 text-sm text-muted-foreground">
            {party.characters.length} character(s). The full inventory UI is coming next.
          </p>
        </div>
      )}
    </main>
  );
}
