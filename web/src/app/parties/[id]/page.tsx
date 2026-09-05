"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { ActorNamePrompt } from "@/components/party/actor-name-prompt";
import { auditFeedKey, PartyAuditFeed } from "@/components/party/party-audit-feed";
import { PartyHeader } from "@/components/party/party-header";
import { PartyItemsSection } from "@/components/party/party-items-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CharacterResponse, ItemResponse, PartyResponse } from "@/lib/api/types";
import { useActorName, useRememberedParties } from "@/lib/remembered-parties";
import { usePartyRealtime } from "@/lib/use-party-realtime";

/** `inventory` is the absence of the parameter, so an ordinary party link stays unchanged. */
type Tab = "inventory" | "history";

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
    <main className="mx-auto w-full max-w-3xl px-4 py-5 md:px-8 md:py-7">
      {/* Reachable at every width, and a 44px target on a phone like everything else here. */}
      <Link
        href="/"
        className="inline-flex h-11 items-center text-[13px] text-muted-foreground hover:underline md:h-auto"
      >
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
        <div className="mt-3">
          <PartyHeader party={party} />
          {/* `useSearchParams` client-renders the tree up to the nearest boundary, and a
              production build of a page that calls it without one fails. The boundary is what
              matters, not a file split, so the reader is a component in this same file. */}
          <Suspense fallback={<div className="mt-3.5 h-11 rounded-lg bg-muted md:h-9 md:w-64" />}>
            <PartyTabs
              inventory={
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
              }
              history={<PartyAuditFeed key={id} partyId={id} />}
            />
          </Suspense>
        </div>
      )}
    </main>
  );
}

function PartyTabs({ inventory, history }: { inventory: ReactNode; history: ReactNode }) {
  const searchParams = useSearchParams();
  // Anything unrecognised reads as the default rather than erroring.
  const tab: Tab = searchParams.get("tab") === "history" ? "history" : "inventory";

  function selectTab(next: string) {
    // `window.history.replaceState` integrates with the router and stays in sync with
    // `useSearchParams`. Replacing rather than pushing means Back leaves the party instead of
    // stepping through tab changes, and the URL updates client-side without a scroll.
    const url = next === "history" ? "?tab=history" : window.location.pathname;
    window.history.replaceState(null, "", url);
  }

  return (
    <Tabs value={tab} onValueChange={(value) => selectTab(value as string)} className="mt-3.5">
      {/* The tap target is the trigger, not the list: sizing the list to 44px left the triggers
          at 37px once its 3px padding and their 1px inset came off. So the triggers carry the
          height below `md` and the list grows to fit them. */}
      <TabsList className="h-auto! w-full md:h-9! md:w-fit">
        <TabsTrigger value="inventory" className="h-11 md:h-[calc(100%-1px)] md:px-5">
          Inventory
        </TabsTrigger>
        <TabsTrigger value="history" className="h-11 md:h-[calc(100%-1px)] md:px-5">
          History
        </TabsTrigger>
      </TabsList>
      <TabsContent value="inventory">{inventory}</TabsContent>
      <TabsContent value="history">{history}</TabsContent>
    </Tabs>
  );
}
