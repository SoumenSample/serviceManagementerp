"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

type Mov = { _id: string; movementId: string; part: { partNumber: string; name: string }; movementType: string; quantity: number; referenceType?: string; referenceId?: string; performedBy?: { name: string }; createdAt: string };

export default function StockMovementsPage() {
  const [items, setItems] = useState<Mov[]>([]);
  useEffect(() => { fetch("/api/stock-movements?limit=20").then(async (r) => { if (r.ok) setItems((await r.json()).items); }); }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Stock Movements" description="Audit history — IN/OUT/RESERVE/RELEASE/ADJUSTMENT/RETURN — immutable" />
      <Card><CardContent className="pt-6">
        {items.length === 0 ? <EmptyState title="No movements" description="Stock changes create audit records" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Movement ID</TableHead><TableHead>Part</TableHead><TableHead>Type</TableHead><TableHead>Qty</TableHead><TableHead>Reference</TableHead><TableHead>By</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((m) => <TableRow key={m._id}><TableCell className="font-mono text-xs">{m.movementId}</TableCell><TableCell>{m.part.partNumber} • {m.part.name}</TableCell><TableCell><Badge variant={m.movementType === "OUT" ? "destructive" : m.movementType === "IN" ? "default" : "outline"}>{m.movementType}</Badge></TableCell><TableCell>{m.quantity}</TableCell><TableCell className="text-xs">{m.referenceType} {m.referenceId?.slice(0, 8)}</TableCell><TableCell className="text-xs">{m.performedBy?.name || "-"}</TableCell><TableCell className="text-xs">{new Date(m.createdAt).toLocaleString()}</TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}
