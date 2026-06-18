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

export function JoinPartyDialog({
  onJoined,
}: {
  onJoined: (party: { id: string; name: string; joinCode: string }) => void;
}) {
  const api = useApi();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await api.POST("/api/parties/join", {
      body: { joinCode: code.trim() },
    });
    setSubmitting(false);

    if (result.error || !result.data) {
      setError("No party found for that code.");
      return;
    }

    onJoined({
      id: result.data.id,
      name: result.data.name,
      joinCode: result.data.joinCode,
    });
    setOpen(false);
    setCode("");
    router.push(`/parties/${result.data.id}`);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Join party
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Join a party</DialogTitle>
              <DialogDescription>Enter the share code you were given.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="join-code">Share code</Label>
              <Input
                id="join-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
                autoFocus
                className="font-mono"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || code.trim().length === 0}>
                {submitting ? "Joining…" : "Join"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
