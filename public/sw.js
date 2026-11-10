/* farmOS service worker: offline app shell only. API responses and HTML pages are never cached. */
// Bump on every SW change: activate deletes every other cache, so stale CSS/JS from old builds goes away.
const VERSION = "farmos-v4"; // v4: sprout brand icons
const SHELL = ["/offline.html", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/brand/farmos-logo.svg", "/brand/farmos-logo-dark.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skipWaiting") self.skipWaiting();
});

const put = (req, res) => {
  if (res.ok && res.type === "basic") {
    const copy = res.clone();
    caches.open(VERSION).then((c) => c.put(req, copy));
  }
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // private data: always network

  // Navigations (HTML): always network, never cached. Offline page only when the network is gone.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match("/offline.html")));
    return;
  }
  // Content-hashed build assets are immutable: cache first is safe.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => put(req, res))));
    return;
  }
  // Icons and brand marks are not hashed: network first, cache only as an offline fallback.
  if (url.pathname.startsWith("/icons/") || url.pathname.startsWith("/brands/") || url.pathname === "/icon.svg") {
    e.respondWith(fetch(req).then((res) => put(req, res)).catch(() => caches.match(req)));
  }
});
