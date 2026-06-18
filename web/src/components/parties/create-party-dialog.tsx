"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function CreatePartyDialog({
  onCreated,
}: {
  onCreated: (party: { id: string; name: string; joinCode: string }) => void;
}) {
  const api = useApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await api.POST("/api/parties", { body: { name: name.trim() } });
    setSubmitting(false);

    if (result.error || !result.data) {
      setError("Could not create the party. Try a different name.");
      return;
    }

    onCreated({
      id: result.data.id,
      name: result.data.name,
      joinCode: result.data.joinCode,
    });
    setOpen(false);
    setName("");
    router.push(`/parties/${result.data.id}`);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Create party</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create a party</DialogTitle>
              <DialogDescription>
                Start a new party and get a share code to invite others.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="party-name">Party name</Label>
              <Input
                id="party-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="The Brave Adventurers"
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || name.trim().length === 0}>
                {submitting ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
