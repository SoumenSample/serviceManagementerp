"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Shift = {
  _id: string;
  shiftId: string;
  status: "ACTIVE" | "ENDED";
  startedAt: string;
  endedAt?: string;
  lastLocationAt?: string;
  lastLatitude?: number;
  lastLongitude?: number;
  lastAddress?: string;
  lastAccuracy?: number;
};

const CAPTURE_INTERVAL_MS = 30 * 1000; // 30 sec for faster admin feedback (spec 30-60)

export function LocationTracker() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [status, setStatus] = useState<"idle"|"active"|"permission_denied"|"unavailable"|"ended">("idle");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingQueue = useRef<{ latitude: number; longitude: number; accuracy?: number }[]>([]);

  const fetchShift = useCallback(async () => {
    const res = await fetch("/api/engineer/shift");
    if (res.ok) {
      const d = await res.json();
      setShift(d.shift);
      if (d.shift?.status === "ACTIVE") setStatus("active");
      else if (d.shift?.status === "ENDED") setStatus("ended");
      if (d.shift?.lastAddress) setAddress(d.shift.lastAddress);
      if (d.shift?.lastLocationAt) setLastUpdate(d.shift.lastLocationAt);
      return d.shift as Shift | null;
    }
    return null;
  }, []);

  const checkAttendanceActive = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/attendance");
      if (!res.ok) return false;
      const d = await res.json();
      return !!d.attendance && d.attendance.status === "ACTIVE";
    } catch { return false; }
  }, []);

  const ensureShift = useCallback(async () => {
    // Do not auto-create EngineerShift if Attendance is not ACTIVE (after explicit End Shift)
    const attendanceActive = await checkAttendanceActive();
    if (!attendanceActive) {
      // No active attendance -> treat as ended, don't create shift
      setStatus("ended");
      return null;
    }
    // Try to resume, else start
    let s = await fetchShift();
    if (!s) {
      const res = await fetch("/api/engineer/shift", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        s = d.shift;
        setShift(s);
        setStatus("active");
      }
    }
    return s;
  }, [fetchShift, checkAttendanceActive]);

  const sendLocation = useCallback(async (lat: number, lon: number, acc?: number) => {
    try {
      const res = await fetch("/api/engineer/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon, accuracy: acc }),
      });
      if (res.ok) {
        const d = await res.json();
        setLastUpdate(new Date().toISOString());
        if (d.shift?.lastAddress) setAddress(d.shift.lastAddress);
        setStatus("active");
        setErrorMsg(null);
        // flush queue
        if (pendingQueue.current.length) {
          const q = [...pendingQueue.current];
          pendingQueue.current = [];
          for (const item of q) {
            fetch("/api/engineer/location", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item),
            }).catch(() => pendingQueue.current.push(item));
          }
        }
      } else {
        const j = await res.json().catch(() => ({}));
        if (j.error?.includes("No active shift")) setStatus("ended");
        else pendingQueue.current.push({ latitude: lat, longitude: lon, accuracy: acc });
      }
    } catch {
      pendingQueue.current.push({ latitude: lat, longitude: lon, accuracy: acc });
      setErrorMsg("Network error, queued for retry");
    }
  }, []);

  const capture = useCallback(() => {
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" && window.location.hostname !== "0.0.0.0") {
      setStatus("unavailable");
      setErrorMsg("Geolocation requires HTTPS. Open the PWA via https:// or localhost. Current origin is not secure.");
      return;
    }
    if (!navigator.geolocation) {
      setStatus("unavailable");
      setErrorMsg("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        if (err.code === 1) {
          setStatus("permission_denied");
          setErrorMsg("Location permission denied. Please enable in browser/PWA settings. On Android Chrome: Site settings → Location → Allow. On iOS: Settings → Privacy → Location Services → Allow.");
        } else {
          setStatus("unavailable");
          setErrorMsg(err.message || "Unable to get location");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [sendLocation]);

  useEffect(() => {
    let mounted = true;
    ensureShift().then((s) => {
      if (!mounted) return;
      if (s?.status === "ACTIVE") {
        capture();
        intervalRef.current = setInterval(capture, CAPTURE_INTERVAL_MS);
      }
    });
    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ensureShift, capture]);

  // Resume on visibility change (PWA reopen)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible" && status === "active") {
        capture();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [capture, status]);

  const handleEndShift = async () => {
    if (!confirm("End your shift? Your location tracking will stop.")) return;
    // End Attendance (which also ends EngineerShift for engineers)
    const attRes = await fetch("/api/attendance/end", { method: "POST" });
    // Also ensure EngineerShift ended (idempotent, attendance/end already does it)
    await fetch("/api/engineer/shift/end", { method: "POST" }).catch(() => {});
    if (attRes.ok) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStatus("ended");
      const d = await attRes.json();
      // refresh shift state
      await fetchShift();
    } else {
      alert("Failed to end shift");
    }
  };

  const handleStartNewShift = async () => {
    // Create new Attendance first (login-like), then shift
    try {
      await fetch("/api/attendance", { method: "POST" }).catch(() => {});
    } catch {}
    await ensureShift();
    capture();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(capture, CAPTURE_INTERVAL_MS);
  };

  if (status === "permission_denied") {
    return (
      <Card className="border-amber-300 bg-amber-50/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">📍 Location Sharing</CardTitle><CardDescription className="text-amber-800">Permission denied</CardDescription></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p className="text-amber-900">Location permission is required for shift tracking. Please enable location permission in your browser/PWA settings.</p>
          <Button size="sm" variant="outline" onClick={() => { setStatus("idle"); capture(); }}>Retry Permission</Button>
        </CardContent>
      </Card>
    );
  }

  if (status === "ended") {
    return (
      <Card className="border-muted">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">📍 Location Sharing</CardTitle><CardDescription>Shift ended</CardDescription></CardHeader>
        <CardContent className="text-sm">
           <p className="flex items-center gap-2">⚪ <span>Shift Ended — Location sharing stopped.</span> <Badge variant="outline">ENDED</Badge></p>
          {lastUpdate && <p className="text-xs text-muted-foreground mt-2">Last updated: {new Date(lastUpdate).toLocaleString()}<br />{address || ""}</p>}
          <Button size="sm" className="mt-3" onClick={handleStartNewShift}>Start New Shift</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={status === "active" ? "border-green-300 bg-green-50/30" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">📍 Location Sharing {status === "active" ? <Badge className="bg-green-600">🟢 Active</Badge> : <Badge variant="outline">Starting...</Badge>}</CardTitle>
        <CardDescription>{status === "active" ? "Your location is being shared during your shift." : "Getting your location..."}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        {errorMsg && status === "unavailable" && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">Unable to update your location. We&apos;ll retry automatically.<br />{errorMsg}</p>}
        <div className="text-xs">
          <p className="text-muted-foreground">Last updated:</p>
          <p className="font-medium">{lastUpdate ? new Date(lastUpdate).toLocaleString() : "—"}</p>
          <p className="text-muted-foreground mt-1">Location:</p>
          <p className="font-medium">{address || (shift?.lastLatitude ? `${shift.lastLatitude.toFixed(5)}, ${shift.lastLongitude?.toFixed(5)}` : "—")}</p>
          {shift?.lastAccuracy && <p className="text-[11px] text-muted-foreground">Accuracy: ±{Math.round(shift.lastAccuracy)} m</p>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={capture}>Update Location Now</Button>
          <Button size="sm" variant="destructive" onClick={handleEndShift} className="w-full sm:w-auto">End Shift</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Tracking every ~30 sec while PWA is active (global tracker also runs on all pages). Refresh resumes automatically. Stale data is never shown as live. If offline, check: HTTPS, permission Allow, and that admin panel refreshes every 20 sec.</p>
      </CardContent>
    </Card>
  );
}
