"use client";

import { useApi } from "@/components/api-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ItemResponse } from "@/lib/api/types";

export function PartyItemsTable({
  partyId,
  items,
  onChanged,
}: {
  partyId: string;
  items: ItemResponse[];
  onChanged: () => void;
}) {
  const api = useApi();

  async function handleDelete(itemId: string) {
    await api.DELETE("/api/parties/{partyId}/items/{itemId}", {
      params: { path: { partyId, itemId } },
    });
    onChanged();
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No items here yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Rarity</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{item.name}</TableCell>
            <TableCell className="text-muted-foreground">{item.type}</TableCell>
            <TableCell>
              <Badge variant="outline">{item.rarity}</Badge>
            </TableCell>
            <TableCell className="text-right">{item.quantity}</TableCell>
            <TableCell className="text-right text-muted-foreground">
              {Number(item.valueGp)} gp
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
