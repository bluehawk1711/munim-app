// Munim service worker — offline app shell + immutable static assets.
//
// Scope (intentionally minimal):
//   - Precache the bare shell ("/") on install. Build-hashed /_next/static
//     chunks CANNOT be precached at hand-written-SW level (their URLs change
//     every build), so they are runtime-cached instead (see fetch below).
//   - Network-first for GET navigations, falling back to the cached shell so
//     the app still opens (rendered) with no connection. The cached shell is
//     refreshed after every successful online navigation so the fallback
//     never goes stale between SW version bumps.
//   - Cache-first, with caching on miss, for same-origin immutable static
//     assets (content-hashed /_next/static/*, /_next/image, /icons/*,
//     /logo.svg). Once the app has loaded online once, an offline cold open
//     serves both the shell HTML AND its scripts/styles from cache.
//
// NOT in scope (by design): API responses are NEVER cached and neither are
// /_next/data/*, cross-origin requests, or non-GET requests — live data must
// always come from the server.
//
// Bump the version when the caching logic itself changes; this busts the
// cache (old caches are deleted on activate).

const CACHE_NAME = "munim-shell-v2";
const SHELL_URL = "/";

// Same-origin immutable static assets, safe to cache forever (URLs are
// content-hashed per build; /icons/ + /logo.svg only change on redeploy,
// which bumps CACHE_NAME anyway). Everything NOT matched here — /api/*,
// /_next/data/*, cross-origin — is left to the network untouched.
function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/logo.svg"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // `cache: "reload"` bypasses the HTTP cache so we precache a fresh copy
      // of the shell rather than whatever the browser disk cache holds. The
      // hashed chunks are deliberately NOT precached here — they are
      // runtime-cached on first load (see fetch below).
      cache.add(new Request(SHELL_URL, { cache: "reload" }))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Non-GET requests are never ours — they go straight to the network.
  if (request.method !== "GET") return;

  // Branch 1: immutable static assets → CACHE-FIRST. Serve from the versioned
  // cache when present; otherwise fetch from the network, cache a clone (only
  // if `response.ok`), and return the response.
  if (isStaticAsset(new URL(request.url))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          // Clone before returning — a Response body can be read only once.
          cache.put(request, response.clone()).catch(() => {
            /* cache write failure must never break the request */
          });
        }
        return response;
      })
    );
    return;
  }

  // Branch 2: same-origin GET navigations → NETWORK-FIRST, falling back to the
  // cached shell so an offline open still renders the app. Anything else
  // (/api/*, /_next/data/*, cross-origin) never reaches this branch.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          // Keep the cached shell fresh for the next offline open.
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(SHELL_URL, copy))
            .catch(() => {
              /* cache write failure must never break the navigation */
            });
        }
        return response;
      })
      .catch(async () => {
        const shell = await caches.match(SHELL_URL);
        if (shell) return shell;
        // Nothing cached yet (first install raced the navigation) — surface a
        // clear offline page rather than the browser's opaque network error.
        return new Response("You are offline. Munim needs a connection for live data.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});
