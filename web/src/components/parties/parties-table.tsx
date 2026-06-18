"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { RememberedParty } from "@/lib/remembered-parties";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PartiesTable({
  parties,
  onForget,
}: {
  parties: RememberedParty[];
  onForget: (id: string) => void;
}) {
  const router = useRouter();

  if (parties.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No parties yet. Create one, or join with a share code.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Share code</TableHead>
          <TableHead className="text-right">Last opened</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {parties.map((party) => (
          <TableRow
            key={party.id}
            className="cursor-pointer"
            onClick={() => router.push(`/parties/${party.id}`)}
          >
            <TableCell className="font-medium">{party.name}</TableCell>
            <TableCell className="font-mono text-muted-foreground">
              {party.joinCode ?? "—"}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {new Date(party.lastOpenedAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onForget(party.id);
                }}
              >
                Forget
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
