"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";

type Inv = { _id: string; part: { partNumber: string; name: string; minimumStockLevel: number }; location: string; quantityOnHand: number; quantityReserved: number; quantityAvailable: number };

export default function InventoryPage() {
  const [items, setItems] = useState<Inv[]>([]);
  const [low, setLow] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selected, setSelected] = useState<Inv | null>(null);
  const [qty, setQty] = useState("");
  const [type, setType] = useState("IN");

  async function load() {
    const res = await fetch(`/api/inventory${low ? "?low=true" : ""}`);
    if (res.ok) setItems((await res.json()).items);
  }
  useEffect(() => { load(); }, [low]);

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="On Hand - Reserved = Available • derived low-stock" />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="flex gap-2">
          <Button variant={low ? "default" : "outline"} size="sm" onClick={() => setLow(!low)}>{low ? "All Stock" : "Low Stock Only"}</Button>
        </div>
        {items.length === 0 ? <EmptyState title="No inventory" description="Parts create inventory on MAIN location" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Part</TableHead><TableHead>Location</TableHead><TableHead>On Hand</TableHead><TableHead>Reserved</TableHead><TableHead>Available</TableHead><TableHead>Min</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((i) => {
              const st = i.quantityAvailable <= 0 ? "OUT_OF_STOCK" : i.quantityAvailable <= i.part.minimumStockLevel ? "LOW_STOCK" : "AVAILABLE";
              return <TableRow key={i._id}><TableCell className="font-mono text-xs">{i.part.partNumber}</TableCell><TableCell>{i.part.name}</TableCell><TableCell>{i.location}</TableCell><TableCell>{i.quantityOnHand}</TableCell><TableCell>{i.quantityReserved}</TableCell><TableCell className="font-medium">{i.quantityAvailable}</TableCell><TableCell>{i.part.minimumStockLevel}</TableCell><TableCell><Badge variant={st === "AVAILABLE" ? "secondary" : "destructive"}>{st}</Badge></TableCell><TableCell><Button size="xs" variant="outline" onClick={() => { setSelected(i); setAdjustOpen(true); }}>Adjust</Button></TableCell></TableRow>;
            })}</TableBody>
          </Table>
        )}
      </CardContent></Card>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent><DialogHeader><DialogTitle>Stock Operation — {selected?.part.partNumber}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={type} onValueChange={(v) => setType(v as string)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IN">IN (receive)</SelectItem><SelectItem value="OUT">OUT (issue/use)</SelectItem><SelectItem value="ADJUSTMENT">ADJUSTMENT</SelectItem><SelectItem value="RETURN">RETURN</SelectItem></SelectContent></Select>
            <Input placeholder="Quantity" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button><Button onClick={async () => {
            if (!selected || !qty) return;
            const res = await fetch(`/api/inventory/${selected._id}/adjust`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, quantity: Number(qty) }) });
            if (res.ok) { setAdjustOpen(false); setQty(""); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
          }}>Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
