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
import type { CoinPurse } from "@/lib/api/types";

const DENOMINATIONS = [
  { key: "platinum", label: "pp" },
  { key: "gold", label: "gp" },
  { key: "electrum", label: "ep" },
  { key: "silver", label: "sp" },
  { key: "copper", label: "cp" },
] as const;

type DenomKey = (typeof DENOMINATIONS)[number]["key"];

const num = (value: string | number) => Number(value) || 0;

export function CoinsDialog({
  partyId,
  characterId,
  mode,
  current,
  onDone,
  onClose,
}: {
  partyId: string;
  characterId: string | null;
  mode: "add" | "spend";
  current: CoinPurse;
  onDone: () => void;
  onClose: () => void;
}) {
  const api = useApi();
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

    const input = {
      copper: num(amounts.copper),
      silver: num(amounts.silver),
      electrum: num(amounts.electrum),
      gold: num(amounts.gold),
      platinum: num(amounts.platinum),
    };

    let errored: boolean;
    if (mode === "add") {
      // Adding = set the purse to its current value plus the entered amounts.
      const body = {
        copper: num(current.copper) + input.copper,
        silver: num(current.silver) + input.silver,
        electrum: num(current.electrum) + input.electrum,
        gold: num(current.gold) + input.gold,
        platinum: num(current.platinum) + input.platinum,
      };
      const result =
        characterId === null
          ? await api.PUT("/api/parties/{id}/coins", {
              params: { path: { id: partyId } },
              body,
            })
          : await api.PUT("/api/parties/{partyId}/characters/{characterId}/coins", {
              params: { path: { partyId, characterId } },
              body,
            });
      errored = Boolean(result.error);
    } else {
      const result =
        characterId === null
          ? await api.POST("/api/parties/{id}/coins/spend", {
              params: { path: { id: partyId } },
              body: input,
            })
          : await api.POST(
              "/api/parties/{partyId}/characters/{characterId}/coins/spend",
              { params: { path: { partyId, characterId } }, body: input },
            );
      errored = Boolean(result.error);
    }

    setSubmitting(false);
    if (errored) {
      setError(mode === "spend" ? "Not enough coins for that." : "Could not update the coins.");
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
            <DialogTitle>{mode === "add" ? "Add coins" : "Spend coins"}</DialogTitle>
            <DialogDescription>
              {mode === "add"
                ? "Add coins to this purse."
                : "Spend coins — higher denominations are broken down as needed."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2 py-4">
            {DENOMINATIONS.map((denom) => (
              <div key={denom.key} className="grid gap-1">
                <Label
                  htmlFor={`coin-${denom.key}`}
                  className="text-xs uppercase text-muted-foreground"
                >
                  {denom.label}
                </Label>
                <Input
                  id={`coin-${denom.key}`}
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
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : mode === "add" ? "Add coins" : "Spend coins"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
