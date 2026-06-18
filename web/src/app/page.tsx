"use client";

import useSWR from "swr";
import type { PartySummary } from "@/lib/api/types";
import { CreatePartyDialog } from "@/components/parties/create-party-dialog";
import { JoinPartyDialog } from "@/components/parties/join-party-dialog";
import { PartiesTable } from "@/components/parties/parties-table";

export default function HomePage() {
  const { data: parties, error, isLoading } = useSWR<PartySummary[]>("/api/parties");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Party Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Manage your D&amp;D party&apos;s shared loot.
          </p>
        </div>
        <div className="flex gap-2">
          <CreatePartyDialog />
          <JoinPartyDialog />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Parties</h2>
        {isLoading && (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        )}
        {error && (
          <p className="py-8 text-center text-sm text-destructive">
            Couldn&apos;t reach the API. Is it running?
          </p>
        )}
        {parties && <PartiesTable parties={parties} />}
      </section>
    </main>
  );
}
