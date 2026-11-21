/* Elly K service worker.
 * - Static build assets: cache-first (immutable, hashed filenames).
 * - Student pages (/app/*): network-first, cached copy shown when offline
 *   (schedule, progress, profile, payment summary only – no payment actions).
 * - Staff pages, API, auth and all non-GET requests: network only.
 * - User cache is wiped at sign-in/sign-out.
 */
const VERSION = "ek-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const PRECACHE = ["/offline", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];
const OFFLINE_PAGES = ["/app", "/app/schedule", "/app/training", "/app/payments", "/app/profile"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_USER_CACHE") event.waitUntil(caches.delete(PAGES));
});

function isStudentPage(url) {
  return OFFLINE_PAGES.includes(url.pathname) || url.pathname.startsWith("/app/receipts/");
}

async function networkFirst(request, cacheKey) {
  const cache = await caches.open(PAGES);
  try {
    const res = await Promise.race([fetch(request), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 6000))]);
    if (res.ok && !res.redirected && res.type === "basic") cache.put(cacheKey, res.clone());
    return res;
  } catch {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    if (request.mode === "navigate") return (await caches.match("/offline")) || Response.error();
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) caches.open(STATIC).then((c) => c.put(req, res.clone()));
      return res;
    })));
    return;
  }
  if (url.pathname.startsWith("/api/")) return;

  const isRsc = req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
  if (isStudentPage(url) && (req.mode === "navigate" || isRsc)) {
    // Key RSC payloads separately from full HTML documents.
    const key = isRsc ? `${url.pathname}?__rsc` : url.pathname;
    event.respondWith(networkFirst(req, key));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline").then((r) => r || Response.error())));
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "Elly K", body: "You have a new notification", url: "/app/notifications" };
  try { data = { ...data, ...event.data.json() }; } catch { /* ignore */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: data.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app";
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((list) => {
    for (const c of list) if ("focus" in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
