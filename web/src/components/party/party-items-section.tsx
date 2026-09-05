"use client";

import { useState } from "react";
import { AddItemDialog } from "@/components/party/add-item-dialog";
import { CoinsDialog } from "@/components/party/coins-dialog";
import { HolderPicker, initialsOf, type Holder } from "@/components/party/holder-picker";
import { PartyItemsTable } from "@/components/party/party-items-table";
import { TransferCoinsDialog } from "@/components/party/transfer-coins-dialog";
import { Button } from "@/components/ui/button";
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

  // Fall back to the stash if the active character was removed, by this player or another.
  const activeHolderId =
    active === STASH || characters.some((c) => c.id === active) ? active : STASH;

  const activeCharacterId = activeHolderId === STASH ? null : activeHolderId;
  const activeCharacter = characters.find((c) => c.id === activeHolderId);
  const locationLabel = activeCharacter ? activeCharacter.name : "the party stash";
  const activeCoins: CoinPurse = activeCharacter ? activeCharacter.coins : party.coins;
  const onCoinsChanged = activeCharacterId === null ? onPartyChanged : onCharactersChanged;

  const visibleItems = items.filter((item) =>
    activeCharacterId === null
      ? item.characterId == null
      : item.characterId === activeCharacterId,
  );

  const holders: Holder[] = [
    {
      id: STASH,
      name: "Party stash",
      initials: null,
      detail: "",
      itemCount: items.filter((item) => item.characterId == null).length,
      coins: party.coins,
    },
    ...characters.map((character) => ({
      id: character.id,
      name: character.name,
      initials: initialsOf(character.name),
      detail: [
        character.level != null ? `L${character.level}` : "",
        character.class ?? "",
      ]
        .filter(Boolean)
        .join(" "),
      itemCount: items.filter((item) => item.characterId === character.id).length,
      coins: character.coins,
    })),
  ];

  const transferDestinations = [
    { value: STASH, label: "Party stash" },
    ...characters.map((c) => ({ value: c.id, label: c.name })),
  ].filter((purse) => purse.value !== activeHolderId);

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <HolderPicker
          holders={holders}
          selectedId={activeHolderId}
          onSelect={setActive}
          partyId={party.id}
          onCharacterAdded={onCharactersChanged}
        />

        {/* Wraps rather than overflows: a full purse of five denominations is wider than a
            390px phone once the three buttons are beside it. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2.5 md:flex-nowrap md:ml-auto md:py-2">
          <span className="min-w-0 font-mono text-[15px] font-medium tabular-nums md:text-sm">
            {formatCoins(activeCoins)}
          </span>
          <div className="ml-auto flex shrink-0 gap-1.5">
            <Button variant="outline" size="touch" onClick={() => setCoinMode("add")}>
              Add
            </Button>
            <Button variant="outline" size="touch" onClick={() => setCoinMode("spend")}>
              Spend
            </Button>
            {transferDestinations.length > 0 && (
              <Button variant="outline" size="touch" onClick={() => setTransferOpen(true)}>
                Send
              </Button>
            )}
          </div>
        </div>

        {/* One button: a floating action on a phone, part of this row from md up. */}
        <AddItemDialog
          partyId={party.id}
          characterId={activeCharacterId}
          locationLabel={locationLabel}
          onAdded={onItemsChanged}
        />
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
