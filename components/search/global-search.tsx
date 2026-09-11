"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

type Group = { id: string; label: string; sub: string; path: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ serviceCalls: Group[]; equipment: Group[]; customers: Group[]; sites: Group[]; engineers: Group[] } | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); setOpen(false); return; }
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const d = await res.json();
          setResults(d.results);
          setOpen(true);
        } else setResults(null);
      } catch { setResults(null); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  function onSelect(path: string) {
    setOpen(false);
    setQ("");
    router.push(path);
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search Call ID, Equipment, Serial, Customer..." value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => { if (results) setOpen(true); }} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }} className="pl-8" />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-96 overflow-auto">
          {loading ? <p className="p-3 text-sm text-muted-foreground">Searching...</p> : !results ? <p className="p-3 text-sm text-muted-foreground">Type at least 2 characters</p> : (
            <>
              {Object.entries({ "SERVICE CALLS": results.serviceCalls, EQUIPMENT: results.equipment, CUSTOMERS: results.customers, SITES: results.sites, ENGINEERS: results.engineers }).map(([label, arr]) => (
                (arr as Group[]).length > 0 && (
                  <div key={label} className="p-2">
                    <p className="text-xs font-semibold text-muted-foreground px-2 py-1">{label}</p>
                    {(arr as Group[]).map((r) => (
                      <div key={r.id} onClick={() => onSelect(r.path)} className="px-2 py-2 hover:bg-muted rounded cursor-pointer">
                        <p className="text-sm font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                      </div>
                    ))}
                  </div>
                )
              ))}
              {Object.values(results).every((a) => (a as Group[]).length === 0) && <p className="p-3 text-sm text-muted-foreground">No results found</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
