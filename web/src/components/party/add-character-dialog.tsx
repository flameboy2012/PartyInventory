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

export function AddCharacterDialog({
  partyId,
  onAdded,
}: {
  partyId: string;
  onAdded: () => void;
}) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [level, setLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await api.POST("/api/parties/{partyId}/characters", {
      params: { path: { partyId } },
      body: {
        name: name.trim(),
        class: className.trim() || null,
        level: level.trim() ? Number(level) : null,
      },
    });
    setSubmitting(false);

    if (result.error) {
      setError("Could not add the character. Check the fields and try again.");
      return;
    }

    onAdded();
    setOpen(false);
    setName("");
    setClassName("");
    setLevel("");
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Add character
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add a character</DialogTitle>
              <DialogDescription>Add a player character to this party.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="char-name">Name</Label>
                <Input
                  id="char-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="char-class">Class</Label>
                  <Input
                    id="char-class"
                    value={className}
                    onChange={(event) => setClassName(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="char-level">Level</Label>
                  <Input
                    id="char-level"
                    type="number"
                    min={1}
                    value={level}
                    onChange={(event) => setLevel(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || name.trim().length === 0}>
                {submitting ? "Adding…" : "Add character"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
