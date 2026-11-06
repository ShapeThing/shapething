// Network first for the app itself (same origin GET requests), falling back to the last cached copy
// when offline. Wikidata and Wikipedia responses are cached by the app (src/sparql/fetchJson.ts).
const CACHE_NAME = "influence-app-v2";
// Every path of the app is the same page, so the last page loaded can stand in for any of them.
const APP_SHELL = "/__app-shell";

self.addEventListener("activate", (event) => {
  // The previous version of the app cached every request in "cache".
  event.waitUntil(caches.delete("cache"));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const isNavigation = request.mode === "navigate";

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(isNavigation ? APP_SHELL : request, response.clone());
        }
        return response;
      } catch (error) {
        const cached = await caches.match(isNavigation ? APP_SHELL : request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
