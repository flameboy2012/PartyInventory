"use client";

import { useState } from "react";
import { useApi } from "@/components/api-provider";
import { Button } from "@/components/ui/button";
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
import type { ItemRarity, ItemType } from "@/lib/api/types";

const ITEM_TYPES: ItemType[] = [
  "Weapon",
  "Armor",
  "Potion",
  "Scroll",
  "Gear",
  "Treasure",
  "Other",
];
const ITEM_RARITIES: ItemRarity[] = [
  "Common",
  "Uncommon",
  "Rare",
  "VeryRare",
  "Legendary",
  "Artifact",
];

export function AddItemDialog({
  partyId,
  characterId,
  locationLabel,
  onAdded,
}: {
  partyId: string;
  characterId: string | null;
  locationLabel: string;
  onAdded: () => void;
}) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [type, setType] = useState<ItemType>("Gear");
  const [rarity, setRarity] = useState<ItemRarity>("Common");
  const [valueGp, setValueGp] = useState("0");
  const [weight, setWeight] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setQuantity("1");
    setType("Gear");
    setRarity("Common");
    setValueGp("0");
    setWeight("0");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await api.POST("/api/parties/{partyId}/items", {
      params: { path: { partyId } },
      body: {
        name: name.trim(),
        description: null,
        quantity: Number(quantity) || 1,
        valueGp: Number(valueGp) || 0,
        weight: Number(weight) || 0,
        type,
        rarity,
        equipped: false,
        characterId,
      },
    });
    setSubmitting(false);

    if (result.error) {
      setError("Could not add the item. Check the fields and try again.");
      return;
    }

    onAdded();
    setOpen(false);
    reset();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add item</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add an item</DialogTitle>
              <DialogDescription>Add an item to {locationLabel}.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="item-name">Name</Label>
                <Input
                  id="item-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="item-type">Type</Label>
                  <Select value={type} onValueChange={(value) => setType(value as ItemType)}>
                    <SelectTrigger id="item-type" className="w-full">
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
                  <Label htmlFor="item-rarity">Rarity</Label>
                  <Select value={rarity} onValueChange={(value) => setRarity(value as ItemRarity)}>
                    <SelectTrigger id="item-rarity" className="w-full">
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
                  <Label htmlFor="item-qty">Quantity</Label>
                  <Input
                    id="item-qty"
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="item-value">Value (gp)</Label>
                  <Input
                    id="item-value"
                    type="number"
                    min={0}
                    step="0.01"
                    value={valueGp}
                    onChange={(event) => setValueGp(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="item-weight">Weight (lb)</Label>
                  <Input
                    id="item-weight"
                    type="number"
                    min={0}
                    step="0.1"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || name.trim().length === 0}>
                {submitting ? "Adding…" : "Add item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
