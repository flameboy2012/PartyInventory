"use client";

import { useState } from "react";
import { useApi } from "@/components/api-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CharacterSummary, ItemResponse } from "@/lib/api/types";

const STASH = "stash";

export function MoveItemDialog({
  partyId,
  item,
  characters,
  onMoved,
  onClose,
}: {
  partyId: string;
  item: ItemResponse;
  characters: CharacterSummary[];
  onMoved: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const currentValue = item.characterId ?? STASH;
  const destinations = [
    { value: STASH, label: "Party stash" },
    ...characters.map((character) => ({ value: character.id, label: character.name })),
  ].filter((destination) => destination.value !== currentValue);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function move(destination: string) {
    setError(null);
    setSubmitting(true);
    const result = await api.PUT("/api/parties/{partyId}/items/{itemId}", {
      params: { path: { partyId, itemId: item.id } },
      body: {
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        valueGp: item.valueGp,
        weight: item.weight,
        type: item.type,
        rarity: item.rarity,
        equipped: false, // moving to another inventory unequips the item
        characterId: destination === STASH ? null : destination,
      },
    });
    setSubmitting(false);

    if (result.error) {
      setError("Could not move the item. Try again.");
      return;
    }

    onMoved();
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {item.name}</DialogTitle>
          <DialogDescription>Choose where to move this item.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {destinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nowhere else to move it yet — add a character first.
            </p>
          ) : (
            destinations.map((destination) => (
              <Button
                key={destination.value}
                variant="outline"
                className="justify-start"
                disabled={submitting}
                onClick={() => move(destination.value)}
              >
                {destination.label}
              </Button>
            ))
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
