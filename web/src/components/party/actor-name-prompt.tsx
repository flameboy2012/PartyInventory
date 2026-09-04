"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Asks who is at the keyboard before a party's data is shown. The name is what the history
 * records against every change made from this device, and it is remembered per party.
 */
export function ActorNamePrompt({
  partyName,
  onSubmit,
}: {
  partyName: string;
  onSubmit: (actorName: string) => void;
}) {
  const [name, setName] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length > 0) onSubmit(name.trim());
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Who are you?</CardTitle>
        <CardDescription>
          Your name is shown next to the changes you make in {partyName}. Only this browser
          remembers it, and you can use a different name in another party.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-2">
          <Label htmlFor="actor-name">Your name</Label>
          <Input
            id="actor-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Scott"
            maxLength={60}
            autoFocus
          />
          <div>
            <Button type="submit" className="mt-2" disabled={name.trim().length === 0}>
              Continue
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
