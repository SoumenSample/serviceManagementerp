"use client";
import { useEffect, useRef, useCallback } from "react";

// Global background tracker for engineers — runs on every dashboard page, not just /engineer
// Keeps shift alive and location updates while PWA is open, even when not on engineer dashboard

const INTERVAL_MS = 30 * 1000; // 30 sec for more responsive admin view

export function GlobalEngineerTracker({ role }: { role: string }) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const ensureShift = useCallback(async () => {
    const res = await fetch("/api/engineer/shift");
    if (res.ok) {
      const d = await res.json();
      if (d.shift?.status === "ACTIVE") return d.shift;
    }
    const res2 = await fetch("/api/engineer/shift", { method: "POST" });
    if (res2.ok) {
      const d = await res2.json();
      return d.shift;
    }
    return null;
  }, []);

  const checkRefreshRequest = useCallback(async () => {
    try {
      const res = await fetch("/api/engineer/shift");
      if (!res.ok) return false;
      const d = await res.json();
      const s = d.shift;
      if (!s || s.status !== "ACTIVE") return false;
      const reqAt = s.locationRefreshRequestedAt ? new Date(s.locationRefreshRequestedAt).getTime() : 0;
      const lastAt = s.lastLocationAt ? new Date(s.lastLocationAt).getTime() : 0;
      // If admin requested after last location, force capture
      if (reqAt > lastAt) return true;
    } catch {}
    return false;
  }, []);

  const sendLocation = useCallback(async (lat: number, lon: number, acc?: number) => {
    try {
      await fetch("/api/engineer/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon, accuracy: acc }),
      });
    } catch {}
  }, []);

  const startTracking = useCallback(async () => {
    if (role !== "engineer") return;
    const shift = await ensureShift();
    if (!shift || shift.status !== "ACTIVE") return;
    if (!navigator.geolocation) return;
    // secure context check
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
      console.warn("[Location] Not secure context - geolocation may be blocked");
    }
    // Clear previous
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);

    const doCapture = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => {
          if (err.code === 1) console.warn("[Location] permission denied");
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    };

    doCapture();
    intervalRef.current = setInterval(doCapture, INTERVAL_MS);
    // Poll for admin refresh requests every 10s
    const refreshPoll = setInterval(async () => {
      if (await checkRefreshRequest()) doCapture();
    }, 10000);
    (intervalRef as unknown as { refreshPoll?: NodeJS.Timeout }).refreshPoll = refreshPoll;
    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        () => {},
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
      );
    } catch {}
    const onVisible = () => {
      if (document.visibilityState === "visible") doCapture();
    };
    document.addEventListener("visibilitychange", onVisible);
    (globalThis as unknown as { __locVisibleHandler?: () => void }).__locVisibleHandler = onVisible;
  }, [role, ensureShift, sendLocation]);

  useEffect(() => {
    if (role !== "engineer") return;
    startTracking();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const rp = (intervalRef as unknown as { refreshPoll?: NodeJS.Timeout }).refreshPoll;
      if (rp) clearInterval(rp);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      const handler = (globalThis as unknown as { __locVisibleHandler?: () => void }).__locVisibleHandler;
      if (handler) document.removeEventListener("visibilitychange", handler);
    };
  }, [role, startTracking]);

  return null; // invisible
}
