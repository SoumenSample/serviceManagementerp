// Minimal service worker for PWA installability — no aggressive caching
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  // Network-first, fallback to cache not needed for this phase
  return;
});
