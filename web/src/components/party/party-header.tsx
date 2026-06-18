import type { PartyResponse } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { formatCoins } from "@/lib/money";

export function PartyHeader({ party }: { party: PartyResponse }) {
  return (
    <div className="rounded-xl border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{party.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Share code:{" "}
            <span className="font-mono font-medium text-foreground">{party.joinCode}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Party gold</p>
          <p className="text-sm font-medium">{formatCoins(party.coins)}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          Characters
        </p>
        {party.characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No characters yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {party.characters.map((character) => (
              <Badge key={character.id} variant="secondary">
                {character.name}
                {character.level != null ? ` · L${character.level}` : ""}
                {character.class ? ` · ${character.class}` : ""}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
