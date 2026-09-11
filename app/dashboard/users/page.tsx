"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { createUserSchema } from "@/lib/validators";
import Link from "next/link";

type User = { _id: string; name: string; email: string; role: string; mobile?: string; isActive: boolean; createdAt: string };

export default function UsersPage() {
  const [items, setItems] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [active, setActive] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const form = useForm<any>({ resolver: zodResolver(createUserSchema), defaultValues: { role: "engineer", isActive: true } });

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (q) params.set("q", q);
    if (role !== "all") params.set("role", role);
    if (active !== "all") params.set("active", active);
    const res = await fetch(`/api/users?${params.toString()}`);
    if (res.ok) { const d = await res.json(); setItems(d.items); setTotalPages(d.totalPages); }
    else if (res.status === 403) alert("Forbidden: users.manage required");
  }
  useEffect(() => { load(); }, [q, role, active, page]);

  return (
    <div className="space-y-6">
      <PageHeader title="Users & Roles" description="Create engineer for Phase 6 testing • role is source of authorization" action={<Button onClick={() => setOpen(true)}>Create User</Button>} />
      <Card><CardContent className="pt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Search name, email, phone..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="max-w-xs" />
          <Select value={role} onValueChange={(v) => { setRole(v as string); setPage(1); }}><SelectTrigger className="w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger><SelectContent><SelectItem value="all">All Roles</SelectItem><SelectItem value="super_admin">Super Admin</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="coordinator">Coordinator</SelectItem><SelectItem value="engineer">Engineer</SelectItem><SelectItem value="accounts">Accounts</SelectItem></SelectContent></Select>
          <Select value={active} onValueChange={(v) => { setActive(v as string); setPage(1); }}><SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="true">Active</SelectItem><SelectItem value="false">Inactive</SelectItem></SelectContent></Select>
        </div>
        {items.length === 0 ? <EmptyState title="No users" description="Create first user" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((u) => (
              <TableRow key={u._id}>
                <TableCell className="font-medium">{u.name}</TableCell><TableCell className="text-xs">{u.email}</TableCell><TableCell><Badge variant="outline">{u.role}</Badge></TableCell><TableCell className="text-xs">{u.mobile || "-"}</TableCell><TableCell><Badge variant={u.isActive ? "default" : "secondary"}>{u.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell className="text-xs">{new Date(u.createdAt).toLocaleDateString()}</TableCell><TableCell className="flex gap-1"><Link href={`/dashboard/users/${u._id}`}><Button size="xs" variant="outline">View</Button></Link><Button size="xs" variant={u.isActive ? "destructive" : "default"} onClick={async () => {
                  const res = await fetch(`/api/users/${u._id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !u.isActive }) });
                  if (res.ok) load(); else alert("Failed: " + JSON.stringify(await res.json()));
                }}>{u.isActive ? "Deactivate" : "Activate"}</Button></TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
        <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(async (v: unknown) => {
              setLoading(true); const res = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }); setLoading(false);
              if (res.ok) { setOpen(false); load(); } else alert("Failed: " + JSON.stringify(await res.json()));
            })} className="space-y-3">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email *</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="mobile" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel>Role *</FormLabel><Select value={field.value ?? ""} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="super_admin">super_admin</SelectItem><SelectItem value="manager">manager</SelectItem><SelectItem value="coordinator">coordinator</SelectItem><SelectItem value="engineer">engineer</SelectItem><SelectItem value="accounts">accounts</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password *</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirm *</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={loading}>{loading ? "Creating..." : "Create"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
