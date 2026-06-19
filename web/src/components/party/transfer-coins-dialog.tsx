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

const DENOMINATIONS = [
  { key: "platinum", label: "pp" },
  { key: "gold", label: "gp" },
  { key: "electrum", label: "ep" },
  { key: "silver", label: "sp" },
  { key: "copper", label: "cp" },
] as const;

type DenomKey = (typeof DENOMINATIONS)[number]["key"];

const num = (value: string) => Number(value) || 0;

export function TransferCoinsDialog({
  partyId,
  fromCharacterId,
  destinations,
  onDone,
  onClose,
}: {
  partyId: string;
  fromCharacterId: string | null;
  destinations: { value: string; label: string }[];
  onDone: () => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [dest, setDest] = useState(destinations[0]?.value ?? "stash");
  const [amounts, setAmounts] = useState<Record<DenomKey, string>>({
    platinum: "0",
    gold: "0",
    electrum: "0",
    silver: "0",
    copper: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await api.POST("/api/parties/{id}/coins/transfer", {
      params: { path: { id: partyId } },
      body: {
        fromCharacterId,
        toCharacterId: dest === "stash" ? null : dest,
        copper: num(amounts.copper),
        silver: num(amounts.silver),
        electrum: num(amounts.electrum),
        gold: num(amounts.gold),
        platinum: num(amounts.platinum),
      },
    });

    setSubmitting(false);
    if (result.error) {
      setError("Couldn't transfer — the source may not have enough coins.");
      return;
    }

    onDone();
    onClose();
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
            <DialogTitle>Transfer coins</DialogTitle>
            <DialogDescription>
              Move coins to another purse — higher denominations are broken down as needed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="transfer-dest">To</Label>
              <select
                id="transfer-dest"
                value={dest}
                onChange={(event) => setDest(event.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {destinations.map((destination) => (
                  <option key={destination.value} value={destination.value}>
                    {destination.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {DENOMINATIONS.map((denom) => (
                <div key={denom.key} className="grid gap-1">
                  <Label
                    htmlFor={`transfer-${denom.key}`}
                    className="text-xs uppercase text-muted-foreground"
                  >
                    {denom.label}
                  </Label>
                  <Input
                    id={`transfer-${denom.key}`}
                    type="number"
                    min={0}
                    value={amounts[denom.key]}
                    onChange={(event) =>
                      setAmounts((prev) => ({ ...prev, [denom.key]: event.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Transferring…" : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
