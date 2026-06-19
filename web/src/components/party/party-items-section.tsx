"use client";

import { useState } from "react";
import { ArrowLeftRight, Minus, Plus } from "lucide-react";
import { AddCharacterDialog } from "@/components/party/add-character-dialog";
import { AddItemDialog } from "@/components/party/add-item-dialog";
import { CoinsDialog } from "@/components/party/coins-dialog";
import { TransferCoinsDialog } from "@/components/party/transfer-coins-dialog";
import { PartyItemsTable } from "@/components/party/party-items-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CharacterResponse, CoinPurse, ItemResponse, PartyResponse } from "@/lib/api/types";
import { formatCoins } from "@/lib/money";

const STASH = "stash";

export function PartyItemsSection({
  party,
  characters,
  items,
  onItemsChanged,
  onCharactersChanged,
  onPartyChanged,
}: {
  party: PartyResponse;
  characters: CharacterResponse[];
  items: ItemResponse[];
  onItemsChanged: () => void;
  onCharactersChanged: () => void;
  onPartyChanged: () => void;
}) {
  const [active, setActive] = useState<string>(STASH);
  const [coinMode, setCoinMode] = useState<"add" | "spend" | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  // Fall back to the stash if the active character was removed.
  const activeTab =
    active === STASH || characters.some((c) => c.id === active) ? active : STASH;

  const activeCharacterId = activeTab === STASH ? null : activeTab;
  const activeCharacter = characters.find((c) => c.id === activeTab);
  const locationLabel = activeCharacter ? activeCharacter.name : "the party stash";
  const activeCoins: CoinPurse = activeCharacter ? activeCharacter.coins : party.coins;
  const onCoinsChanged = activeCharacterId === null ? onPartyChanged : onCharactersChanged;

  const visibleItems = items.filter((item) =>
    activeCharacterId === null
      ? item.characterId == null
      : item.characterId === activeCharacterId,
  );

  const transferDestinations = [
    { value: STASH, label: "Party stash" },
    ...characters.map((c) => ({ value: c.id, label: c.name })),
  ].filter((purse) => purse.value !== activeTab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={activeTab} onValueChange={(value) => setActive(value as string)}>
          <TabsList>
            <TabsTrigger value={STASH}>Stash</TabsTrigger>
            {characters.map((character) => (
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

      <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">Coins</span>
        <span className="text-sm font-medium">{formatCoins(activeCoins)}</span>
        <div className="ml-auto flex gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Add coins"
            onClick={() => setCoinMode("add")}
          >
            <Plus />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Spend coins"
            onClick={() => setCoinMode("spend")}
          >
            <Minus />
          </Button>
          {transferDestinations.length > 0 && (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Transfer coins"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowLeftRight />
            </Button>
          )}
        </div>
      </div>

      <PartyItemsTable
        partyId={party.id}
        characters={characters}
        items={visibleItems}
        onChanged={onItemsChanged}
      />

      {coinMode && (
        <CoinsDialog
          partyId={party.id}
          characterId={activeCharacterId}
          mode={coinMode}
          current={activeCoins}
          onDone={onCoinsChanged}
          onClose={() => setCoinMode(null)}
        />
      )}

      {transferOpen && (
        <TransferCoinsDialog
          partyId={party.id}
          fromCharacterId={activeCharacterId}
          destinations={transferDestinations}
          onDone={() => {
            onPartyChanged();
            onCharactersChanged();
          }}
          onClose={() => setTransferOpen(false)}
        />
      )}
    </div>
  );
}
