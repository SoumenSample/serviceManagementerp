"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { partSchema } from "@/lib/validators";

type Part = { _id: string; partId: string; partNumber: string; name: string; brand?: string; category?: string; minimumStockLevel: number; active: boolean; available: number; inventory?: { _id: string; quantityOnHand: number; quantityReserved: number } };

export default function PartsPage() {
  const [items, setItems] = useState<Part[]>([]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [loading, setLoading] = useState(false);
  const form = useForm<any>({ resolver: zodResolver(partSchema), defaultValues: { active: true, minimumStockLevel: 5, name: "", partNumber: "", initialStock: 0 } });
  const [stockOpen, setStockOpen] = useState(false);
  const [stockPart, setStockPart] = useState<Part | null>(null);
  const [stockQty, setStockQty] = useState("");
  const [stockType, setStockType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");

  async function load() {
    const res = await fetch(`/api/parts?q=${encodeURIComponent(q)}&page=${page}&limit=10`);
    if (res.ok) { const d = await res.json(); setItems(d.items); setTotalPages(d.totalPages); }
  }
  useEffect(() => { load(); }, [q, page]);

  function onAdd() { setEditing(null); form.reset({ partNumber: "", name: "", minimumStockLevel: 5, active: true, initialStock: 0 }); setOpen(true); }
  function onEdit(p: Part) { setEditing(p); form.reset({ partNumber: p.partNumber, name: p.name, description: (p as never as { description?: string }).description || "", category: p.category || "", brand: p.brand || "", minimumStockLevel: p.minimumStockLevel, active: p.active }); setOpen(true); }

  async function onStockAdjust() {
    if (!stockPart || !stockQty || Number(stockQty) <= 0) return alert("Enter valid quantity");
    // Need inventory _id — fetch from inventory API if not present
    let invId = stockPart.inventory?._id;
    if (!invId) {
      const res = await fetch(`/api/inventory`);
      if (res.ok) {
        const d = await res.json();
        const found = (d.items as { _id: string; part: { partNumber: string } }[]).find((i) => i.part.partNumber === stockPart.partNumber);
        invId = found?._id;
      }
    }
    if (!invId) return alert("Inventory record not found");
    const res = await fetch(`/api/inventory/${invId}/adjust`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: stockType, quantity: Number(stockQty) }) });
    if (res.ok) { setStockOpen(false); setStockQty(""); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
  }

  async function onSubmit(values: unknown) {
    setLoading(true);
    const url = editing ? `/api/parts/${editing._id}` : "/api/parts";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
    setLoading(false);
    if (res.ok) { setOpen(false); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
  }
  async function onDelete(id: string) {
    if (!confirm("Permanently delete this spare part? Inventory will be removed. This cannot be undone.")) return;
    const res = await fetch(`/api/parts/${id}`, { method: "DELETE" });
    if (res.ok) load(); else alert("Delete failed: " + JSON.stringify(await res.json()));
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Parts Master" description="SKU unique • PART-000001 • low-stock derived from inventory" action={<Button onClick={onAdd}>Add Part</Button>} />
      <Card><CardContent className="pt-6 space-y-4">
        <Input placeholder="Search SKU, name, PART-000001..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-sm" />
        {items.length === 0 ? <EmptyState title="No parts" description="Add first part" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Part ID</TableHead><TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Brand</TableHead><TableHead>Available</TableHead><TableHead>Min Stock</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((p) => {
              const st = p.available <= 0 ? "OUT_OF_STOCK" : p.available <= p.minimumStockLevel ? "LOW_STOCK" : "AVAILABLE";
              return (
                <TableRow key={p._id}>
                  <TableCell className="font-mono text-xs">{p.partId}</TableCell><TableCell className="font-mono text-xs">{p.partNumber}</TableCell><TableCell>{p.name}</TableCell><TableCell>{p.brand || "-"}</TableCell><TableCell className="font-medium">{p.available}</TableCell><TableCell>{p.minimumStockLevel}</TableCell><TableCell><Badge variant={st === "OUT_OF_STOCK" ? "destructive" : st === "LOW_STOCK" ? "destructive" : "secondary"}>{st}</Badge> {p.active ? "" : <Badge variant="outline">INACTIVE</Badge>}</TableCell><TableCell className="flex gap-1"><Button size="xs" variant="outline" onClick={() => onEdit(p)}>Edit</Button><Button size="xs" variant="secondary" onClick={() => { setStockPart(p); setStockType("IN"); setStockQty(""); setStockOpen(true); }}>Stock</Button><Button size="xs" variant="destructive" onClick={() => onDelete(p._id)}>Delete</Button></TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        )}
        <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editing ? "Edit Part" : "Add Part"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="partNumber" render={({ field }) => (<FormItem><FormLabel>SKU *</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="brand" render={({ field }) => (<FormItem><FormLabel>Brand</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="minimumStockLevel" render={({ field }) => (<FormItem><FormLabel>Min Stock</FormLabel><FormControl><Input type="number" min={0} value={(field.value as string) ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
              {!editing && <FormField control={form.control} name="initialStock" render={({ field }) => (<FormItem><FormLabel>Initial Stock (On Hand)</FormLabel><FormControl><Input type="number" min={0} value={(field.value as string) ?? 0} onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))} /></FormControl><FormMessage /><p className="text-xs text-muted-foreground">Creates MAIN inventory with this quantity. Use Stock button later to IN/OUT.</p></FormItem>)} />}
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? "Saving..." : editing ? "Update" : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust Stock — {stockPart?.partNumber} • {stockPart?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-xs text-muted-foreground">Available: {stockPart?.available ?? 0} • On Hand: {stockPart?.inventory?.quantityOnHand ?? 0} • Reserved: {stockPart?.inventory?.quantityReserved ?? 0}</div>
            <Select value={stockType} onValueChange={(v) => setStockType(v as typeof stockType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IN">IN (receive +)</SelectItem><SelectItem value="OUT">OUT (issue -)</SelectItem><SelectItem value="ADJUSTMENT">ADJUSTMENT (+)</SelectItem></SelectContent></Select>
            <Input placeholder="Quantity" type="number" min={1} value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            <p className="text-xs text-muted-foreground">Requires permission: {stockType==="IN"?"inventory.receive": stockType==="OUT"?"inventory.issue":"inventory.adjust"} (super_admin/manager). Coordinator/engineer cannot adjust.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setStockOpen(false)}>Cancel</Button><Button onClick={onStockAdjust}>Submit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
