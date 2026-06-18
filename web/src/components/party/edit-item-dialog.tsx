"use client";

import { useState } from "react";
import { useApi } from "@/components/api-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ItemRarity, ItemResponse, ItemType } from "@/lib/api/types";
import { ITEM_RARITIES, ITEM_TYPES } from "@/lib/item-options";

export function EditItemDialog({
  partyId,
  item,
  onSaved,
  onClose,
}: {
  partyId: string;
  item: ItemResponse;
  onSaved: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const inStash = item.characterId == null;
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [type, setType] = useState<ItemType>(item.type);
  const [rarity, setRarity] = useState<ItemRarity>(item.rarity);
  const [valueGp, setValueGp] = useState(String(item.valueGp));
  const [weight, setWeight] = useState(String(item.weight));
  const [equipped, setEquipped] = useState(item.equipped);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await api.PUT("/api/parties/{partyId}/items/{itemId}", {
      params: { path: { partyId, itemId: item.id } },
      body: {
        name: name.trim(),
        description: item.description,
        quantity: Number(quantity) || 1,
        valueGp: Number(valueGp) || 0,
        weight: Number(weight) || 0,
        type,
        rarity,
        equipped: inStash ? false : equipped, // stash items can't be equipped
        characterId: item.characterId, // editing keeps the item's location; use Move to relocate
      },
    });
    setSubmitting(false);

    if (result.error) {
      setError("Could not save the item. Check the fields and try again.");
      return;
    }

    onSaved();
  }

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit item</DialogTitle>
            <DialogDescription>Update this item&apos;s details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-type">Type</Label>
                <Select value={type} onValueChange={(value) => setType(value as ItemType)}>
                  <SelectTrigger id="edit-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-rarity">Rarity</Label>
                <Select value={rarity} onValueChange={(value) => setRarity(value as ItemRarity)}>
                  <SelectTrigger id="edit-rarity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_RARITIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="edit-qty">Quantity</Label>
                <Input
                  id="edit-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-value">Value (gp)</Label>
                <Input
                  id="edit-value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={valueGp}
                  onChange={(event) => setValueGp(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-weight">Weight (lb)</Label>
                <Input
                  id="edit-weight"
                  type="number"
                  min={0}
                  step="0.1"
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-equipped"
                  checked={inStash ? false : equipped}
                  disabled={inStash}
                  onCheckedChange={(value) => setEquipped(value === true)}
                />
                <Label
                  htmlFor="edit-equipped"
                  className={inStash ? "text-muted-foreground" : undefined}
                >
                  Equipped
                </Label>
              </div>
              {inStash && (
                <p className="text-xs text-muted-foreground">
                  Only items held by a character can be equipped.
                </p>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting || name.trim().length === 0}>
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
