"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetVirtualKeyboardProvider,
} from "@/components/ui/sheet";
import type { ItemRarity, ItemType } from "@/lib/api/types";
import { ITEM_RARITIES, ITEM_RARITY_LABELS, ITEM_TYPES } from "@/lib/item-options";
import { useMediaQuery } from "@/lib/use-media-query";

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
  const isDesktop = useMediaQuery("(min-width: 768px)");
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

  // One set of fields, rendered inside whichever container the breakpoint calls for.
  const fields = (
    <div className="grid gap-3.5 py-4">
      <div className="grid gap-2">
        <Label htmlFor="item-name">Name</Label>
        <Input
          id="item-name"
          size="touch"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="item-type">Type</Label>
          <Select value={type} onValueChange={(value) => setType(value as ItemType)}>
            <SelectTrigger id="item-type" size="touch" className="w-full">
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
            <SelectTrigger id="item-rarity" size="touch" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ITEM_RARITIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {ITEM_RARITY_LABELS[option]}
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
            size="touch"
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
            size="touch"
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
            size="touch"
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
  );

  const submitButton = (
    <Button type="submit" size="touch" disabled={submitting || name.trim().length === 0}>
      {submitting ? "Adding…" : "Add item"}
    </Button>
  );

  const trigger = (
    <Button
      onClick={() => setOpen(true)}
      className="fixed right-4 bottom-5 z-30 size-14 rounded-4xl p-0 shadow-[0_6px_20px_rgb(0_0_0/0.22)] md:static md:size-auto md:h-9 md:rounded-lg md:px-3 md:shadow-none"
    >
      <Plus className="size-6 md:size-4" />
      <span className="sr-only md:not-sr-only">Add item</span>
    </Button>
  );

  if (isDesktop) {
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add an item</DialogTitle>
                <DialogDescription>Add an item to {locationLabel}.</DialogDescription>
              </DialogHeader>
              {fields}
              <DialogFooter>{submitButton}</DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      {trigger}
      {/* Six fields and a software keyboard: let the drawer keep the focused field in view. The
          provider reads the drawer's root context, so it belongs inside `Sheet`, not around it. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetVirtualKeyboardProvider>
          <SheetContent>
            <form onSubmit={handleSubmit}>
              <SheetHeader>
                <SheetTitle>Add an item</SheetTitle>
                <SheetDescription>Add an item to {locationLabel}.</SheetDescription>
              </SheetHeader>
              {fields}
              <SheetFooter>{submitButton}</SheetFooter>
            </form>
          </SheetContent>
        </SheetVirtualKeyboardProvider>
      </Sheet>
    </>
  );
}
