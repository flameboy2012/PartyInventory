"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { ActorNamePrompt } from "@/components/party/actor-name-prompt";
import { auditFeedKey, PartyAuditFeed } from "@/components/party/party-audit-feed";
import { PartyHeader } from "@/components/party/party-header";
import { PartyItemsSection } from "@/components/party/party-items-section";
import type { CharacterResponse, ItemResponse, PartyResponse } from "@/lib/api/types";
import { useActorName, useRememberedParties } from "@/lib/remembered-parties";
import { usePartyRealtime } from "@/lib/use-party-realtime";

export default function PartyPage() {
  const { id } = useParams<{ id: string }>();
  const { mutate } = useSWRConfig();
  const { remember } = useRememberedParties();
  const { actorName, loaded: actorLoaded, save: saveActorName } = useActorName(id);
  const {
    data: party,
    error: partyError,
    isLoading: partyLoading,
    mutate: mutateParty,
  } = useSWR<PartyResponse>(`/api/parties/${id}`);
  const { data: characters, mutate: mutateCharacters } = useSWR<CharacterResponse[]>(
    `/api/parties/${id}/characters`,
  );
  const { data: items, mutate: mutateItems } = useSWR<ItemResponse[]>(
    `/api/parties/${id}/items`,
  );

  // Revalidate everything when another player changes this party.
  usePartyRealtime(id, () => {
    void mutateParty();
    void mutateCharacters();
    void mutateItems();
    void mutate(auditFeedKey(id));
  });

  // Reads don't need an actor name, so the party loads first; writes do, so nothing that can
  // change the party is shown until this player has said who they are.
  const needsActorName = actorLoaded && !actorName;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← All parties
      </Link>

      {partyLoading && <p className="mt-8 text-sm text-muted-foreground">Loading…</p>}
      {partyError && (
        <p className="mt-8 text-sm text-destructive">Couldn&apos;t load this party.</p>
      )}

      {party && needsActorName && (
        <ActorNamePrompt
          partyName={party.name}
          onSubmit={(name) => {
            // Remember the party itself too: this may be the first time on this device, e.g. a
            // pasted link. The name is stored second so it survives that write.
            remember({ id: party.id, name: party.name, joinCode: party.joinCode });
            saveActorName(name);
          }}
        />
      )}

      {party && actorLoaded && actorName && (
        <div className="mt-4 space-y-6">
          <PartyHeader party={party} characters={characters ?? []} />
          <PartyItemsSection
            party={party}
            characters={characters ?? []}
            items={items ?? []}
            onItemsChanged={() => {
              void mutateItems();
              void mutate(auditFeedKey(id));
            }}
            onCharactersChanged={() => {
              void mutateCharacters();
              void mutate(auditFeedKey(id));
            }}
            onPartyChanged={() => {
              void mutateParty();
              void mutate(auditFeedKey(id));
            }}
          />
          <PartyAuditFeed key={id} partyId={id} />
        </div>
      )}
    </main>
  );
}
