"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { useApi } from "@/components/api-provider";
import { EditItemDialog } from "@/components/party/edit-item-dialog";
import { MoveItemDialog } from "@/components/party/move-item-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CharacterSummary, ItemRarity, ItemResponse } from "@/lib/api/types";
import { ITEM_RARITIES, ITEM_RARITY_LABELS, ITEM_RARITY_ORDER } from "@/lib/item-options";
import { cn } from "@/lib/utils";

const SORTS = {
  rarity: "Rarity",
  name: "Name",
  value: "Value",
  quantity: "Quantity",
} as const;

type SortKey = keyof typeof SORTS;

/**
 * The collapsed row is a grid at both breakpoints, so every field is rendered once.
 *
 * Phone: two rows — name and quantity on the first, the rarity/type/value meta line on the
 * second, the chevron spanning both. From md up the meta line becomes `display: contents`, so its
 * children join the parent grid and the whole row lines up as columns.
 */
const ROW_GRID =
  "grid w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-x-3 gap-y-1 " +
  "md:grid-cols-[minmax(0,1fr)_7rem_6rem_7rem_3.5rem_1rem] md:gap-x-4 md:gap-y-0";

export function PartyItemsTable({
  partyId,
  characters,
  items,
  onChanged,
}: {
  partyId: string;
  characters: CharacterSummary[];
  items: ItemResponse[];
  onChanged: () => void;
}) {
  const api = useApi();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("rarity");
  const [movingItem, setMovingItem] = useState<ItemResponse | null>(null);
  const [editingItem, setEditingItem] = useState<ItemResponse | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ItemResponse | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(item: ItemResponse) {
    setDeleting(true);
    await api.DELETE("/api/parties/{partyId}/items/{itemId}", {
      params: { path: { partyId, itemId: item.id } },
    });
    setDeleting(false);
    setConfirmDelete(null);
    setExpandedId(null);
    onChanged();
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No items here yet.</p>
    );
  }

  // Ordering only reorders — the set shown never changes.
  const sorted = [...items].sort(compareBy(sort));
  const totalWeight = items.reduce(
    (sum, item) => sum + Number(item.weight) * Number(item.quantity),
    0,
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-0.5 pt-4 pb-1.5">
        <p className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"} · {formatNumber(totalWeight)} lb
        </p>
        <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
          <SelectTrigger size="touch" aria-label="Sort items by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SORTS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(
          ROW_GRID,
          "hidden border-b border-foreground px-1 pb-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground md:grid",
        )}
      >
        <span>Item</span>
        <span>Rarity</span>
        <span>Type</span>
        <span className="text-right">Value</span>
        <span className="text-right">Qty</span>
        <span />
      </div>

      {/* Bottom padding so the last row clears the floating add button on a phone. */}
      <ul aria-label="Items" className="pb-24 md:pb-0">
        {sorted.map((item) => {
          const open = expandedId === item.id;
          const quantity = Number(item.quantity);
          const value = `${formatNumber(Number(item.valueGp))} gp${quantity > 1 ? " each" : ""}`;

          return (
            <li key={item.id} className={cn("border-b", open && "bg-muted/60")}>
              <button
                type="button"
                aria-expanded={open}
                // Opening a row closes whichever was open, so at most one is ever open.
                onClick={() => setExpandedId(open ? null : item.id)}
                className={cn(
                  ROW_GRID,
                  "min-h-[54px] px-2 py-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-0 md:px-1 md:py-3",
                )}
              >
                <span className="col-start-1 row-start-1 min-w-0 truncate text-[15px] leading-5 font-medium md:col-start-auto md:row-start-auto md:text-sm">
                  {item.name}
                </span>

                <span className="col-span-2 col-start-1 row-start-2 flex min-w-0 items-center gap-[7px] text-[12.5px] leading-[17px] text-muted-foreground md:contents">
                  <RarityTag rarity={item.rarity} />
                  <span className="min-w-0 truncate md:text-sm">{item.type}</span>
                  <span className="min-w-0 truncate tabular-nums before:mr-[7px] before:content-['·'] md:text-right md:text-sm md:before:content-none">
                    {value}
                  </span>
                </span>

                <span
                  className={cn(
                    "col-start-2 row-start-1 justify-self-end text-[15px] font-medium tabular-nums before:content-['×'] md:col-start-auto md:row-start-auto md:text-right md:text-sm md:before:content-none",
                    open ? "text-foreground" : "text-muted-foreground md:text-foreground",
                  )}
                >
                  {quantity}
                </span>

                <ChevronDown
                  aria-hidden
                  className={cn(
                    "col-start-3 row-span-2 row-start-1 size-4 shrink-0 self-center transition-transform md:col-start-auto md:row-span-1 md:row-start-auto",
                    open ? "rotate-180 text-muted-foreground" : "text-ring",
                  )}
                />
              </button>

              {open && (
                <div className="px-2 pb-3 md:px-1">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12.5px] leading-5">
                    <Detail label="Weight" value={`${formatNumber(Number(item.weight))} lb`} />
                    <Detail label="Value" value={`${formatNumber(Number(item.valueGp))} gp`} />
                    <Detail label="Type" value={item.type} />
                    <Detail label="Equipped" value={item.equipped ? "Yes" : "No"} />
                  </dl>
                  {item.description && (
                    <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="touch"
                      className="flex-1 md:flex-none"
                      onClick={() => setMovingItem(item)}
                    >
                      Give to…
                    </Button>
                    <Button
                      variant="outline"
                      size="touch"
                      className="flex-1 md:flex-none"
                      onClick={() => setEditingItem(item)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="touch"
                      className="w-11 px-0 md:w-8"
                      aria-label={`Delete ${item.name}`}
                      onClick={() => setConfirmDelete(item)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="hidden gap-2 pt-3 text-[11.5px] text-muted-foreground md:flex md:items-center">
        Rarity scale
        {ITEM_RARITIES.map((rarity) => (
          <RarityTag key={rarity} rarity={rarity} />
        ))}
      </p>

      {editingItem && (
        <EditItemDialog
          partyId={partyId}
          item={editingItem}
          onSaved={() => {
            onChanged();
            setEditingItem(null);
          }}
          onClose={() => setEditingItem(null)}
        />
      )}

      {movingItem && (
        <MoveItemDialog
          partyId={partyId}
          item={movingItem}
          characters={characters}
          onMoved={() => {
            onChanged();
            setMovingItem(null);
          }}
          onClose={() => setMovingItem(null)}
        />
      )}

      {confirmDelete && (
        <Dialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setConfirmDelete(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {confirmDelete.name}?</DialogTitle>
              <DialogDescription>
                This removes {confirmDelete.name} from this inventory. The party history keeps a
                record of it.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="touch" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="touch"
                disabled={deleting}
                onClick={() => handleDelete(confirmDelete)}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

const TAG_BASE =
  "inline-flex h-5 shrink-0 items-center rounded-4xl px-2 text-[11.5px] font-medium whitespace-nowrap";

/** Colour never carries the rarity alone — the name is always present as text. */
const TAG_COLOURS: Record<Exclude<ItemRarity, "Common">, string> = {
  Uncommon: "bg-rarity-uncommon/12 text-rarity-uncommon-fg",
  Rare: "bg-rarity-rare/12 text-rarity-rare-fg",
  VeryRare: "bg-rarity-very-rare/12 text-rarity-very-rare-fg",
  Legendary: "bg-rarity-legendary/14 text-rarity-legendary-fg",
  Artifact: "bg-rarity-artifact/12 text-rarity-artifact-fg",
};

export function RarityTag({ rarity, className }: { rarity: ItemRarity; className?: string }) {
  return (
    <span
      className={cn(
        TAG_BASE,
        // Common is the quiet default, so ordinary gear doesn't compete for attention.
        rarity === "Common" ? "border border-border text-foreground" : TAG_COLOURS[rarity],
        className,
      )}
    >
      {ITEM_RARITY_LABELS[rarity]}
    </span>
  );
}

function compareBy(sort: SortKey) {
  return (a: ItemResponse, b: ItemResponse): number => {
    switch (sort) {
      case "rarity":
        return (
          ITEM_RARITY_ORDER[b.rarity] - ITEM_RARITY_ORDER[a.rarity] ||
          a.name.localeCompare(b.name)
        );
      case "value":
        return Number(b.valueGp) - Number(a.valueGp) || a.name.localeCompare(b.name);
      case "quantity":
        return Number(b.quantity) - Number(a.quantity) || a.name.localeCompare(b.name);
      case "name":
        return a.name.localeCompare(b.name);
    }
  };
}

/** Trims the trailing zeros a weight or value picks up, so 41 doesn't read as 41.00. */
function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toLocaleString();
}
