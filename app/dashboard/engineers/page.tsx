"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";

type Engineer = { _id: string; name: string; email: string; employeeId?: string; designation?: string; isActive?: boolean };

export default function EngineersPage() {
  const [items, setItems] = useState<Engineer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/engineers");
    if (res.ok) {
      const d = await res.json();
      setItems(d.items || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = items.filter((e) => {
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return e.name.toLowerCase().includes(term) || e.email.toLowerCase().includes(term) || (e.employeeId || "").toLowerCase().includes(term) || (e.designation || "").toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engineers"
        description="Operations → Engineers master — active field engineers for assignment"
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/engineer"><Button variant="outline">My Dashboard</Button></Link>
            <Link href="/dashboard/users"><Button variant="outline">Manage Users</Button></Link>
          </div>
        }
      />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-2">
            <Input placeholder="Search name, email, employee ID..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
            <Button variant="outline" onClick={load}>Refresh</Button>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground p-6">Loading engineers...</div>
          ) : filtered.length === 0 ? (
            <EmptyState title={items.length === 0 ? "No engineers" : "No matches"} description={items.length === 0 ? "Create users with role 'engineer' in Users & Roles" : `No engineers match "${q}"`} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.email}</TableCell>
                    <TableCell className="font-mono text-xs">{e.employeeId || "-"}</TableCell>
                    <TableCell>{e.designation || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={e.isActive === false ? "secondary" : "default"}>{e.isActive === false ? "INACTIVE" : "ACTIVE"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Link href={`/dashboard/engineer/profile`}><Button size="xs" variant="outline">View</Button></Link>
                        <Link href={`/dashboard/service-calls?engineer=${e._id}`}><Button size="xs" variant="outline">Calls</Button></Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="text-xs text-muted-foreground">Total: {filtered.length} / {items.length} engineers &middot; Data from <code>/api/engineers</code> (role=engineer, isActive=true)</div>
        </CardContent>
      </Card>
    </div>
  );
}
