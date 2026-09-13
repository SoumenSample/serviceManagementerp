"use client";
import { useEffect, useState } from "react";
import { Bell, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";

type Notif = { _id: string; title: string; message: string; isRead: boolean; createdAt: string; relatedModule?: string; relatedRecordId?: string; serviceCall?: string };

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"inbox" | "trash">("inbox");

  async function load() {
    const res = await fetch("/api/notifications/unread-count");
    if (res.ok) setCount((await res.json()).count);
    const url = tab === "trash" ? "/api/notifications?limit=10&deletedOnly=true" : "/api/notifications?limit=10";
    const res2 = await fetch(url);
    if (res2.ok) setItems((await res2.json()).items);
  }
  useEffect(() => { load(); const id = setInterval(load, 30000); return () => clearInterval(id); }, [tab]);
  useEffect(() => { if (open) load(); }, [open, tab]);

  async function markRead(id: string, recordId?: string) {
    if (tab === "trash") return;
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
  async function softDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((n) => n._id !== id));
    // refresh count
    fetch("/api/notifications/unread-count").then(async (r) => { if (r.ok) setCount((await r.json()).count); });
  }
  async function permanentDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!confirm("Permanently delete this notification? This cannot be undone.")) return;
    await fetch(`/api/notifications/${id}?permanent=true`, { method: "DELETE" });
    setItems((prev) => prev.filter((n) => n._id !== id));
  }
  async function restore(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) });
    setItems((prev) => prev.filter((n) => n._id !== id));
  }
  async function deleteAll() {
    if (!confirm(tab === "trash" ? "Permanently delete all trashed notifications?" : "Move all notifications to trash?")) return;
    if (tab === "trash") await fetch("/api/notifications?permanent=true&deletedOnly=true", { method: "DELETE" });
    else await fetch("/api/notifications", { method: "DELETE" });
    load();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative"><Bell className="h-5 w-5" />{count > 0 && <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs">{count > 99 ? "99+" : count}</Badge>}</Button>} />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <span className="text-sm font-medium">Notifications</span>
          <div className="flex gap-1">
            {tab === "inbox" && <Button variant="ghost" size="xs" onClick={markAll}>Mark all read</Button>}
            <Button variant="ghost" size="xs" onClick={deleteAll} title={tab === "trash" ? "Purge all permanently" : "Delete all"}>{tab === "trash" ? "Empty trash" : "Delete all"}</Button>
          </div>
        </div>
        <div className="flex border-b">
          <button onClick={() => setTab("inbox")} className={`flex-1 py-1.5 text-xs font-medium ${tab === "inbox" ? "bg-muted" : ""}`}>Inbox</button>
          <button onClick={() => setTab("trash")} className={`flex-1 py-1.5 text-xs font-medium ${tab === "trash" ? "bg-muted" : ""}`}>Trash</button>
        </div>
        <div className="max-h-80 overflow-auto">
          {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{tab === "trash" ? "Trash is empty" : "No notifications"}</p> : items.map((n) => (
            <div key={n._id} onClick={() => markRead(n._id, n.relatedRecordId || n.serviceCall)} className={`p-3 border-b hover:bg-muted/50 cursor-pointer flex gap-2 ${!n.isRead && tab === "inbox" ? "bg-muted/30" : ""}`}>
              <div className="flex-1 min-w-0" >
                <p className="text-sm font-medium truncate">{n.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                <p className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()} {!n.isRead && tab === "inbox" && <Badge variant="secondary" className="ml-1">New</Badge>}</p>
              </div>
              <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                {tab === "inbox" ? (
                  <Button variant="ghost" size="xs" onClick={(e) => softDelete(e, n._id)} title="Delete (move to trash)"><Trash2 className="h-3.5 w-3.5" /></Button>
                ) : (
                  <>
                    <Button variant="ghost" size="xs" onClick={(e) => restore(e, n._id)} title="Restore"><Undo2 className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="xs" onClick={(e) => permanentDelete(e, n._id)} title="Permanently delete"><X className="h-3.5 w-3.5 text-destructive" /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 text-center  items-center">
          <Link href="/dashboard" className="text-xs text-primary underline">View dashboard</Link>
         
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
