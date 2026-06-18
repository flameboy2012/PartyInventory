"use client";

import { CreatePartyDialog } from "@/components/parties/create-party-dialog";
import { JoinPartyDialog } from "@/components/parties/join-party-dialog";
import { PartiesTable } from "@/components/parties/parties-table";
import { useRememberedParties } from "@/lib/remembered-parties";

export default function HomePage() {
  const { parties, loaded, remember, forget } = useRememberedParties();

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
          <CreatePartyDialog onCreated={remember} />
          <JoinPartyDialog onJoined={remember} />
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Your parties</h2>
        {!loaded ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <PartiesTable parties={parties} onForget={forget} />
        )}
      </section>
    </main>
  );
}
