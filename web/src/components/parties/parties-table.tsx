"use client";

import { useRouter } from "next/navigation";
import type { PartySummary } from "@/lib/api/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PartiesTable({ parties }: { parties: PartySummary[] }) {
  const router = useRouter();

  if (parties.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No parties yet. Create one to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Characters</TableHead>
          <TableHead className="text-right">Created</TableHead>
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
            <TableCell className="text-right">{party.characterCount}</TableCell>
            <TableCell className="text-right">
              {new Date(party.createdAt).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
