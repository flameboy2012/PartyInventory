"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Wallet } from "lucide-react";
import { AddCharacterDialog } from "@/components/party/add-character-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { CoinPurse } from "@/lib/api/types";
import { formatCoins } from "@/lib/money";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** The party stash and every character, described the same way so one list renders them all. */
export type Holder = {
  id: string;
  name: string;
  /** `null` for the party stash, which gets a wallet icon instead of initials. */
  initials: string | null;
  /** e.g. `L5 Rogue`, shown before the carried summary. Empty for the stash. */
  detail: string;
  itemCount: number;
  coins: CoinPurse;
};

/** `6 items · 143 gp · 12 sp` — what a holder is carrying, so a player can choose without switching. */
export function carriedSummary(holder: Holder): string {
  const items = `${holder.itemCount} ${holder.itemCount === 1 ? "item" : "items"}`;
  return [holder.detail, items, formatCoins(holder.coins)].filter(Boolean).join(" · ");
}

export function HolderPicker({
  holders,
  selectedId,
  onSelect,
  partyId,
  onCharacterAdded,
}: {
  holders: Holder[];
  selectedId: string;
  onSelect: (holderId: string) => void;
  partyId: string;
  onCharacterAdded: () => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [open, setOpen] = useState(false);
  const selected = holders.find((holder) => holder.id === selectedId) ?? holders[0];

  // One list, rendered inside whichever container is active.
  const list = (
    <HolderList
      holders={holders}
      selectedId={selected.id}
      onSelect={(holderId) => {
        onSelect(holderId);
        setOpen(false);
      }}
      partyId={partyId}
      onCharacterAdded={(characterId) => {
        onCharacterAdded();
        onSelect(characterId);
        setOpen(false);
      }}
    />
  );

  const triggerContent = (
    <>
      <HolderAvatar holder={selected} className="size-9.5 md:size-9" />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] leading-5 font-medium md:text-[14.5px]">
          {selected.name}
        </span>
        <span className="block truncate text-[12.5px] leading-[17px] text-muted-foreground">
          {carriedSummary(selected)}
        </span>
      </span>
      <ChevronsUpDown className="size-[18px] shrink-0 text-muted-foreground" />
    </>
  );

  const triggerClassName =
    "flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 outline-none transition-colors hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:w-auto md:min-w-[300px]";

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger data-slot="holder-picker-trigger" className={triggerClassName}>
          {triggerContent}
        </PopoverTrigger>
        <PopoverContent className="p-2">{list}</PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      <button
        type="button"
        data-slot="holder-picker-trigger"
        onClick={() => setOpen(true)}
        className={triggerClassName}
      >
        {triggerContent}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader className="px-2 pt-1 pb-1">
            <SheetTitle className="text-[15px] font-semibold">Whose inventory?</SheetTitle>
          </SheetHeader>
          {list}
        </SheetContent>
      </Sheet>
    </>
  );
}

function HolderList({
  holders,
  selectedId,
  onSelect,
  partyId,
  onCharacterAdded,
}: {
  holders: Holder[];
  selectedId: string;
  onSelect: (holderId: string) => void;
  partyId: string;
  onCharacterAdded: (characterId: string) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div>
      <ul aria-label="Holders" className="max-h-[50dvh] overflow-y-auto">
        {holders.map((holder) => {
          const isSelected = holder.id === selectedId;
          return (
            <li key={holder.id}>
              <button
                type="button"
                aria-current={isSelected ? "true" : undefined}
                onClick={() => onSelect(holder.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
                  isSelected && "bg-muted",
                )}
              >
                <HolderAvatar holder={holder} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] leading-5 font-medium">
                    {holder.name}
                  </span>
                  <span className="block truncate text-[12.5px] leading-[17px] text-muted-foreground">
                    {carriedSummary(holder)}
                  </span>
                </span>
                {isSelected && <Check className="size-[18px] shrink-0" />}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-2 border-t pt-2">
        <AddCharacterDialog
          partyId={partyId}
          open={addOpen}
          onOpenChange={setAddOpen}
          onAdded={(character) => onCharacterAdded(character.id)}
        />
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-medium outline-none transition-colors hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-10"
        >
          <Plus className="size-[17px]" />
          Add character
        </button>
      </div>
    </div>
  );
}

function HolderAvatar({ holder, className }: { holder: Holder; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-4xl text-[13px] font-medium",
        holder.initials === null
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground",
        className,
      )}
    >
      {holder.initials === null ? <Wallet className="size-[18px]" /> : holder.initials}
    </span>
  );
}

/** Up to two initials from a name, for the avatar circles. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
