"use client";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";

type Notif = { _id: string; title: string; message: string; isRead: boolean; createdAt: string; relatedModule?: string; relatedRecordId?: string; serviceCall?: string };

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/notifications/unread-count");
    if (res.ok) setCount((await res.json()).count);
    const res2 = await fetch("/api/notifications?limit=10");
    if (res2.ok) setItems((await res2.json()).items);
  }
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, []);
  useEffect(() => { if (open) load(); }, [open]);

  async function markRead(id: string, recordId?: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setCount((c) => Math.max(0, c - 1));
    if (recordId) window.location.href = `/dashboard/service-calls/${recordId}`;
  }
  async function markAll() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCount(0);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative"><Bell className="h-5 w-5" />{count > 0 && <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs">{count > 99 ? "99+" : count}</Badge>}</Button>} />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium">Notifications</span>
          <Button variant="ghost" size="xs" onClick={markAll}>Mark all read</Button>
        </div>
        <div className="max-h-80 overflow-auto">
          {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No notifications</p> : items.map((n) => (
            <div key={n._id} onClick={() => markRead(n._id, n.relatedRecordId || n.serviceCall)} className={`p-3 border-b hover:bg-muted/50 cursor-pointer ${!n.isRead ? "bg-muted/30" : ""}`}>
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
              <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()} {!n.isRead && <Badge variant="secondary" className="ml-1">New</Badge>}</p>
            </div>
          ))}
        </div>
        <div className="p-2 text-center"><Link href="/dashboard" className="text-xs text-primary underline">View dashboard</Link></div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
