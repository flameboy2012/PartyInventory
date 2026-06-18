"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { AddCharacterDialog } from "@/components/party/add-character-dialog";
import { AddItemDialog } from "@/components/party/add-item-dialog";
import { PartyHeader } from "@/components/party/party-header";
import { PartyItemsTable } from "@/components/party/party-items-table";
import type { ItemResponse, PartyResponse } from "@/lib/api/types";

export default function PartyPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: party,
    error: partyError,
    isLoading: partyLoading,
    mutate: mutateParty,
  } = useSWR<PartyResponse>(`/api/parties/${id}`);
  const { data: items, mutate: mutateItems } = useSWR<ItemResponse[]>(
    `/api/parties/${id}/items`,
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← All parties
      </Link>

      {partyLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {partyError && (
        <p className="mt-8 text-sm text-destructive">Couldn&apos;t load this party.</p>
      )}

      {party && (
        <div className="mt-4 space-y-6">
          <PartyHeader party={party} />

          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Party items</h2>
            <div className="flex gap-2">
              <AddCharacterDialog partyId={party.id} onAdded={() => mutateParty()} />
              <AddItemDialog partyId={party.id} onAdded={() => mutateItems()} />
            </div>
          </div>

          <PartyItemsTable
            partyId={party.id}
            items={items ?? []}
            onChanged={() => mutateItems()}
          />
        </div>
      )}
    </main>
  );
}
