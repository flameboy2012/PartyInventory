import type { CharacterResponse, PartyResponse } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";

export function PartyHeader({
  party,
  characters,
}: {
  party: PartyResponse;
  characters: CharacterResponse[];
}) {
  return (
    <div className="rounded-xl border p-5">
      <h1 className="text-2xl font-semibold tracking-tight">{party.name}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share code:{" "}
        <span className="font-mono font-medium text-foreground">{party.joinCode}</span>
      </p>

      <div className="mt-4">
        <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          Characters
        </p>
        {characters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No characters yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {characters.map((character) => (
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
