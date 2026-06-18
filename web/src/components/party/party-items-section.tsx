"use client";

import { useState } from "react";
import { AddCharacterDialog } from "@/components/party/add-character-dialog";
import { AddItemDialog } from "@/components/party/add-item-dialog";
import { PartyItemsTable } from "@/components/party/party-items-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ItemResponse, PartyResponse } from "@/lib/api/types";

const STASH = "stash";

export function PartyItemsSection({
  party,
  items,
  onItemsChanged,
  onCharactersChanged,
}: {
  party: PartyResponse;
  items: ItemResponse[];
  onItemsChanged: () => void;
  onCharactersChanged: () => void;
}) {
  const [active, setActive] = useState<string>(STASH);

  // Fall back to the stash if the active character was removed.
  const activeTab =
    active === STASH || party.characters.some((c) => c.id === active) ? active : STASH;

  const activeCharacterId = activeTab === STASH ? null : activeTab;
  const activeCharacter = party.characters.find((c) => c.id === activeTab);
  const locationLabel = activeCharacter ? activeCharacter.name : "the party stash";

  const visibleItems = items.filter((item) =>
    activeCharacterId === null
      ? item.characterId == null
      : item.characterId === activeCharacterId,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={(value) => setActive(value as string)}>
          <TabsList>
            <TabsTrigger value={STASH}>Stash</TabsTrigger>
            {party.characters.map((character) => (
              <TabsTrigger key={character.id} value={character.id}>
                {character.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <AddCharacterDialog partyId={party.id} onAdded={onCharactersChanged} />
          <AddItemDialog
            partyId={party.id}
            characterId={activeCharacterId}
            locationLabel={locationLabel}
            onAdded={onItemsChanged}
          />
        </div>
      </div>

      <PartyItemsTable
        partyId={party.id}
        characters={party.characters}
        items={visibleItems}
        onChanged={onItemsChanged}
      />
    </div>
  );
}
